import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { PROPERTY_PARAMETERS } from './property-parameters.js';
import { inTimeZone, localTimes, offsetOf } from './time-zone.js';

const MINUTES_PER_HOUR = 60;
const LARGEST_OFFSET_MINUTES = 23 * MINUTES_PER_HOUR + 59;
const LARGEST_SECOND = 59;
const ZERO_OFFSET_NAME = 'GMT';
const TIME_ZONES = [...Intl.supportedValuesOf('timeZone'), 'UTC'];
const EARLIEST_INSTANT = new Date('1900-01-01T00:00:00.000Z');
const LATEST_INSTANT = new Date('2100-12-31T23:59:59.999Z');
const LOCAL_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/;
const INSTANT_WEIGHT = 6;
const REACHABLE_WEIGHT = 3;
const MAX_ITEMS = 3;
const MAX_KEYS = 4;
const MAX_PATHS = 4;
const MAX_PATH_STEPS = 3;
const EVERY_ITEM = Symbol('every item');
const INHERITED_KEYS = ['constructor', '__proto__', 'toString', 'hasOwnProperty'];
const PATH_KEYS: readonly string[] = ['at', 'visits', 'events', 'timezone', ...INHERITED_KEYS];
const BODY_KEYS = [...PATH_KEYS, 'visits[]', 'at.events'];
const TIME_ZONE_PATH: Path = [{ key: 'timezone', everyItem: false }];

const INSTANT_FORMATS: readonly ((date: Date) => string)[] = [
  (date) => date.toISOString(),
  (date) => date.toISOString().replace(/\.\d{3}Z$/, 'Z'),
  (date) => date.toISOString().replace(/Z$/, '999Z'),
];

interface PathStep {
  readonly key: string;
  readonly everyItem: boolean;
}

type Path = readonly PathStep[];
type Location = readonly (string | number)[];

const isUtcInstant = (value: unknown): boolean => z.iso.datetime().safeParse(value).success;

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

function offsetText(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const magnitude = Math.abs(minutes);
  const hours = Math.floor(magnitude / MINUTES_PER_HOUR);
  return `${sign}${twoDigits(hours)}:${twoDigits(magnitude % MINUTES_PER_HOUR)}`;
}

function offsetName(minutes: number, seconds: number | undefined): string {
  if (seconds === undefined) {
    return minutes === 0 ? ZERO_OFFSET_NAME : `${ZERO_OFFSET_NAME}${offsetText(minutes)}`;
  }
  return `${ZERO_OFFSET_NAME}${offsetText(minutes)}:${twoDigits(seconds)}`;
}

function pathText(path: Path): string {
  return path.map((step) => (step.everyItem ? `${step.key}[]` : step.key)).join('.');
}

function isOnPath(location: Location, path: Path): boolean {
  const pattern = path.flatMap((step) => (step.everyItem ? [step.key, EVERY_ITEM] : [step.key]));
  return (
    pattern.length === location.length &&
    pattern.every((part, index) =>
      part === EVERY_ITEM ? typeof location[index] === 'number' : part === location[index],
    )
  );
}

function leafLocations(value: unknown, location: Location): readonly Location[] {
  if (Array.isArray(value)) {
    return value.flatMap((item: unknown, index) => leafLocations(item, [...location, index]));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, item]) => leafLocations(item, [...location, key]));
  }
  return [location];
}

function pathTo(location: Location): Path | undefined {
  return location.reduce<Path | undefined>((path, part) => {
    if (path === undefined) {
      return undefined;
    }
    if (typeof part === 'string') {
      return PATH_KEYS.includes(part) ? [...path, { key: part, everyItem: false }] : undefined;
    }
    const last = path.at(-1);
    return last === undefined || last.everyItem
      ? undefined
      : [...path.slice(0, -1), { key: last.key, everyItem: true }];
  }, []);
}

function isPath(path: Path | undefined): path is Path {
  return path !== undefined;
}

function expectedBody(
  value: unknown,
  location: Location,
  onPath: (location: Location) => boolean,
  rewrite: (instant: string) => string,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item: unknown, index) =>
      expectedBody(item, [...location, index], onPath, rewrite),
    );
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        expectedBody(item, [...location, key], onPath, rewrite),
      ]),
    );
  }
  return typeof value === 'string' && onPath(location) && isUtcInstant(value)
    ? rewrite(value)
    : value;
}

function asJson(value: unknown): unknown {
  const parsed: unknown = JSON.parse(JSON.stringify(value));
  return parsed;
}

function namesTimeZoneAsText(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'timezone' in value &&
    typeof value.timezone === 'string'
  );
}

const timeZone = fc.constantFrom(...TIME_ZONES);
const moment = fc.date({ min: EARLIEST_INSTANT, max: LATEST_INSTANT, noInvalidDate: true });
const utcInstant = fc
  .tuple(moment, fc.constantFrom(...INSTANT_FORMATS))
  .map(([date, format]) => format(date));
const leaf = fc.oneof(
  { arbitrary: utcInstant, weight: INSTANT_WEIGHT },
  fc.string(),
  fc.integer(),
  fc.boolean(),
  fc.constant(null),
);
const { record, fields } = fc.letrec<{
  tree: unknown;
  list: unknown[];
  record: Record<string, unknown>;
  fields: Record<string, unknown>;
}>((tie) => ({
  tree: fc.oneof({ depthSize: 'small' }, leaf, tie('list'), tie('record')),
  list: fc.array(tie('tree'), { maxLength: MAX_ITEMS }),
  record: fc.dictionary(fc.constantFrom(...BODY_KEYS), tie('tree'), { maxKeys: MAX_KEYS }),
  fields: fc.dictionary(fc.constantFrom(...PATH_KEYS), tie('tree'), {
    minKeys: 1,
    maxKeys: MAX_KEYS,
  }),
}));
const anyPath = fc.array(
  fc.record({ key: fc.constantFrom(...PATH_KEYS), everyItem: fc.boolean() }),
  { minLength: 1, maxLength: MAX_PATH_STEPS },
);
const timeline = fc
  .tuple(fc.oneof(fields, record), timeZone)
  .map(([values, zone]) => ({ zone, sent: asJson({ ...values, timezone: zone }) }))
  .chain(({ zone, sent }) => {
    const reachable = leafLocations(sent, [])
      .filter((location) => !isOnPath(location, TIME_ZONE_PATH))
      .map(pathTo)
      .filter(isPath);
    const path =
      reachable.length === 0
        ? anyPath
        : fc.oneof({ arbitrary: fc.constantFrom(...reachable), weight: REACHABLE_WEIGHT }, anyPath);
    return fc.record({
      zone: fc.constant(zone),
      sent: fc.constant(sent),
      paths: fc.array(path, { minLength: 1, maxLength: MAX_PATHS }),
    });
  });

describe('offsetOf, for every offset a time zone can name', () => {
  it('reads back the hours and minutes the offset was written with, dropping any seconds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -LARGEST_OFFSET_MINUTES, max: LARGEST_OFFSET_MINUTES }),
        fc.option(fc.integer({ min: 0, max: LARGEST_SECOND }), { nil: undefined }),
        (minutes, seconds) => {
          expect(offsetOf(offsetName(minutes, seconds))).toEqual({
            minutes,
            text: offsetText(minutes),
          });
        },
      ),
      PROPERTY_PARAMETERS,
    );
  });
});

describe('inTimeZone, for every time zone and UTC instant', () => {
  it('writes a local time with its offset that names the same instant', () => {
    fc.assert(
      fc.property(timeZone, utcInstant, (zone, instant) => {
        const local = inTimeZone(zone)(instant);

        expect(local).toMatch(LOCAL_TIME);
        expect(Date.parse(local)).toBe(Date.parse(instant));
      }),
      PROPERTY_PARAMETERS,
    );
  });
});

describe('localTimes, for any body and any paths', () => {
  it('rewrites only the UTC instants at the given paths and leaves every other value as it was', () => {
    fc.assert(
      fc.property(timeline, ({ zone, sent, paths }) => {
        const sentText = JSON.stringify(sent);
        const onPath = (location: Location): boolean =>
          paths.some((path) => isOnPath(location, path));

        const written = localTimes(paths.map(pathText))(sent);

        expect(written).toEqual(expectedBody(sent, [], onPath, inTimeZone(zone)));
        expect(JSON.stringify(sent)).toBe(sentText);
      }),
      PROPERTY_PARAMETERS,
    );
  });

  it('rewrites nothing more when it runs again on its own output', () => {
    fc.assert(
      fc.property(timeline, ({ sent, paths }) => {
        const rewrite = localTimes(paths.map(pathText));
        const once = rewrite(sent);

        expect(rewrite(once)).toEqual(once);
      }),
      PROPERTY_PARAMETERS,
    );
  });

  it('returns a body that names no time zone as text exactly as it was given', () => {
    const withoutTimeZone = fc.oneof(
      fc.jsonValue().filter((value) => !namesTimeZoneAsText(value)),
      fc
        .tuple(
          record,
          fc.jsonValue().filter((value) => typeof value !== 'string'),
        )
        .map(([fields, timezone]) => asJson({ ...fields, timezone })),
    );

    fc.assert(
      fc.property(withoutTimeZone, fc.array(anyPath, { maxLength: MAX_PATHS }), (sent, paths) => {
        expect(localTimes(paths.map(pathText))(sent)).toBe(sent);
      }),
      PROPERTY_PARAMETERS,
    );
  });
});

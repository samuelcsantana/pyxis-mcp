import { z } from 'zod';

const OFFSET_NAME_PREFIX = 'GMT';
const ZERO_OFFSET = '+00:00';
const NEGATIVE = '-';
const TIME_SEPARATOR = ':';
const UTC_DESIGNATOR = 'Z';
const MINUTES_PER_HOUR = 60;
const MILLISECONDS_PER_MINUTE = 60_000;
const EVERY_ITEM = '[]';
const PATH_SEPARATOR = '.';

const utcInstant = z.iso.datetime();

export interface UtcOffset {
  readonly minutes: number;
  readonly text: string;
}

type Rewrite = (instant: string) => string;

export function offsetOf(offsetName: string): UtcOffset {
  const start = OFFSET_NAME_PREFIX.length;
  const text = offsetName.slice(start, start + ZERO_OFFSET.length) || ZERO_OFFSET;
  const direction = text.startsWith(NEGATIVE) ? -1 : 1;
  const magnitude = text
    .slice(NEGATIVE.length)
    .split(TIME_SEPARATOR)
    .map(Number)
    .reduce((total, part) => total * MINUTES_PER_HOUR + part, 0);
  return { minutes: direction * magnitude, text };
}

function offsetNameAt(formatter: Intl.DateTimeFormat, date: Date): string {
  return formatter
    .formatToParts(date)
    .filter((part) => part.type === 'timeZoneName')
    .map((part) => part.value)
    .join('');
}

export function inTimeZone(timeZone: string): Rewrite {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' });
  return (instant) => {
    const date = new Date(instant);
    const offset = offsetOf(offsetNameAt(formatter, date));
    const wallClock = new Date(date.getTime() + offset.minutes * MILLISECONDS_PER_MINUTE);
    return `${wallClock.toISOString().slice(0, -UTC_DESIGNATOR.length)}${offset.text}`;
  };
}

function stepsOf(path: string): readonly string[] {
  return path
    .split(PATH_SEPARATOR)
    .flatMap((key) =>
      key.endsWith(EVERY_ITEM) ? [key.slice(0, -EVERY_ITEM.length), EVERY_ITEM] : [key],
    );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rewriteAt(value: unknown, steps: readonly string[], rewrite: Rewrite): unknown {
  const [step, ...rest] = steps;
  if (step === undefined) {
    const instant = utcInstant.safeParse(value);
    return instant.success ? rewrite(instant.data) : value;
  }
  if (step === EVERY_ITEM) {
    return Array.isArray(value)
      ? value.map((item: unknown) => rewriteAt(item, rest, rewrite))
      : value;
  }
  if (!isRecord(value) || !Object.hasOwn(value, step)) {
    return value;
  }
  return { ...value, [step]: rewriteAt(value[step], rest, rewrite) };
}

export function localTimes(paths: readonly string[]): (body: unknown) => unknown {
  const everySteps = paths.map(stepsOf);
  return (body) => {
    if (!isRecord(body) || typeof body.timezone !== 'string') {
      return body;
    }
    const rewrite = inTimeZone(body.timezone);
    return everySteps.reduce<unknown>((current, steps) => rewriteAt(current, steps, rewrite), body);
  };
}

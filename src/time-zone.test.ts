import { describe, expect, it } from 'vitest';
import { inTimeZone, knownTimeZoneOrUtc, localTimes, offsetOf } from './time-zone.js';

const SAO_PAULO = 'America/Sao_Paulo';
const UNKNOWN_TIME_ZONE = 'Mars/Olympus_Mons';

describe('offsetOf', () => {
  it.each([
    ['GMT', 0, '+00:00'],
    ['GMT+00:00', 0, '+00:00'],
    ['GMT-03:00', -180, '-03:00'],
    ['GMT+05:45', 345, '+05:45'],
    ['GMT-03:06:28', -186, '-03:06'],
  ])('reads %s as %i minutes, written %s', (offsetName, minutes, text) => {
    expect(offsetOf(offsetName)).toEqual({ minutes, text });
  });
});

describe('knownTimeZoneOrUtc', () => {
  it.each([
    [SAO_PAULO, SAO_PAULO],
    ['UTC', 'UTC'],
    [UNKNOWN_TIME_ZONE, 'UTC'],
    ['', 'UTC'],
  ])('answers %j as %j', (timeZone, known) => {
    expect(knownTimeZoneOrUtc(timeZone)).toBe(known);
  });

  it('keeps an alias this runtime knows, rather than falling back to UTC', () => {
    const buenosAires = knownTimeZoneOrUtc('America/Buenos_Aires');

    expect(buenosAires).not.toBe('UTC');
    expect(inTimeZone('America/Buenos_Aires')('2026-10-14T01:41:41.638Z')).toBe(
      '2026-10-13T22:41:41.638-03:00',
    );
  });
});

describe('inTimeZone', () => {
  it.each([
    [SAO_PAULO, '2026-10-14T01:41:41.638Z', '2026-10-13T22:41:41.638-03:00'],
    ['UTC', '2026-10-14T01:41:41.638Z', '2026-10-14T01:41:41.638+00:00'],
    ['Asia/Kathmandu', '2026-10-14T01:41:41.638Z', '2026-10-14T07:26:41.638+05:45'],
    ['Asia/Tokyo', '2026-10-14T20:00:00Z', '2026-10-15T05:00:00.000+09:00'],
  ])('writes an instant in %s with its offset', (timeZone, instant, local) => {
    expect(inTimeZone(timeZone)(instant)).toBe(local);
  });

  it('writes an instant in UTC when this runtime does not know the time zone', () => {
    expect(inTimeZone(UNKNOWN_TIME_ZONE)('2026-10-14T01:41:41.638Z')).toBe(
      '2026-10-14T01:41:41.638+00:00',
    );
  });

  it('takes the offset of each instant, so a change to daylight saving time shows', () => {
    const newYork = inTimeZone('America/New_York');

    expect(newYork('2026-11-01T05:30:00.000Z')).toBe('2026-11-01T01:30:00.000-04:00');
    expect(newYork('2026-11-01T06:30:00.000Z')).toBe('2026-11-01T01:30:00.000-05:00');
  });

  it('keeps the instant: read back, the local time is the same moment', () => {
    const instant = '2026-10-14T01:41:41.638Z';

    expect(new Date(inTimeZone(SAO_PAULO)(instant)).toISOString()).toBe(instant);
  });
});

describe('localTimes', () => {
  const timeline = localTimes([
    'next_before',
    'visits[].started_at',
    'visits[].events[].occurred_at',
  ]);

  it('writes every instant at the given paths in the time zone the body names', () => {
    const body = {
      timezone: SAO_PAULO,
      next_before: '2026-10-14T01:00:00.000Z',
      visits: [
        {
          started_at: '2026-10-14T01:41:41.638Z',
          events: [
            { occurred_at: '2026-10-14T01:41:41.638Z' },
            { occurred_at: '2026-10-14T01:42:00.000Z' },
          ],
        },
      ],
    };

    expect(timeline(body)).toEqual({
      timezone: SAO_PAULO,
      next_before: '2026-10-13T22:00:00.000-03:00',
      visits: [
        {
          started_at: '2026-10-13T22:41:41.638-03:00',
          events: [
            { occurred_at: '2026-10-13T22:41:41.638-03:00' },
            { occurred_at: '2026-10-13T22:42:00.000-03:00' },
          ],
        },
      ],
    });
  });

  it('touches nothing else, such as the values a visitor sent or an opaque cursor', () => {
    const properties = { sent_at: '2026-10-14T01:41:41.638Z' };
    const body = {
      timezone: SAO_PAULO,
      next_cursor: '2026-10-14T01:41:41.638Z~5d2f8c1a',
      next_before: null,
      visits: [{ events: [{ occurred_at: '2026-10-14T01:41:41.638Z', properties }] }],
    };

    expect(timeline(body)).toEqual({
      timezone: SAO_PAULO,
      next_cursor: '2026-10-14T01:41:41.638Z~5d2f8c1a',
      next_before: null,
      visits: [{ events: [{ occurred_at: '2026-10-13T22:41:41.638-03:00', properties }] }],
    });
  });

  it('writes the instants in UTC, and keeps the rest, when this runtime does not know the zone', () => {
    const body = {
      timezone: UNKNOWN_TIME_ZONE,
      next_before: '2026-10-14T01:00:00.000Z',
      visits: [{ started_at: '2026-10-14T01:41:41.638Z', events: [] }],
    };

    expect(timeline(body)).toEqual({
      timezone: UNKNOWN_TIME_ZONE,
      next_before: '2026-10-14T01:00:00.000+00:00',
      visits: [{ started_at: '2026-10-14T01:41:41.638+00:00', events: [] }],
    });
  });

  it('leaves a body that names no time zone as the API sent it', () => {
    const body = { next_before: '2026-10-14T01:00:00.000Z', visits: [] };

    expect(timeline(body)).toBe(body);
    expect(timeline({ ...body, timezone: 42 })).toEqual({ ...body, timezone: 42 });
  });

  it.each([null, 'text', [{ timezone: SAO_PAULO }]])('leaves the body %j as it is', (body) => {
    expect(timeline(body)).toBe(body);
  });

  it('leaves a value that is not a UTC instant, and adds no missing field', () => {
    const body = {
      timezone: SAO_PAULO,
      next_before: '2026-10-13T22:00:00.000-03:00',
      visits: [null, { events: 'none' }, { started_at: 7 }],
    };

    expect(timeline(body)).toEqual(body);
    expect(timeline({ timezone: SAO_PAULO, visits: {} })).toStrictEqual({
      timezone: SAO_PAULO,
      visits: {},
    });
  });

  it('adds no field for a path named after a member every object inherits', () => {
    const body = { timezone: SAO_PAULO, at: {} };

    expect(localTimes(['constructor', '__proto__', 'hasOwnProperty.at'])(body)).toStrictEqual(body);
  });

  it('builds a new body and leaves the one it was given unchanged', () => {
    const body = { timezone: SAO_PAULO, next_before: '2026-10-14T01:00:00.000Z', visits: [] };
    const sent = structuredClone(body);

    timeline(body);

    expect(body).toEqual(sent);
  });
});

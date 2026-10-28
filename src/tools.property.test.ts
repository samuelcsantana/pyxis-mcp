import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PROPERTY_PARAMETERS } from './property-parameters.js';
import { inTimeZone } from './time-zone.js';
import { todayIn } from './tools.js';

const TIME_ZONES = [...Intl.supportedValuesOf('timeZone'), 'UTC'];
const EARLIEST_NOW = new Date('2000-01-01T00:00:00.000Z');
const LATEST_NOW = new Date('2100-12-31T23:59:59.999Z');
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_LENGTH = 'YYYY-MM-DD'.length;
const MILLISECONDS_PER_DAY = 86_400_000;

const timeZone = fc.constantFrom(...TIME_ZONES);
const now = fc.date({ min: EARLIEST_NOW, max: LATEST_NOW, noInvalidDate: true });

describe('todayIn, for every time zone and any moment', () => {
  it('is a YYYY-MM-DD date at most one day away from the UTC date of the moment', () => {
    fc.assert(
      fc.property(timeZone, now, (zone, moment) => {
        const today = todayIn(zone, moment);
        const utcDay = Date.parse(moment.toISOString().slice(0, DATE_LENGTH));

        expect(today).toMatch(CALENDAR_DATE);
        expect(Math.abs(Date.parse(today) - utcDay)).toBeLessThanOrEqual(MILLISECONDS_PER_DAY);
      }),
      PROPERTY_PARAMETERS,
    );
  });

  it('is the date of the local time the reports write for the same moment', () => {
    fc.assert(
      fc.property(timeZone, now, (zone, moment) => {
        const localTime = inTimeZone(zone)(moment.toISOString());

        expect(todayIn(zone, moment)).toBe(localTime.slice(0, DATE_LENGTH));
      }),
      PROPERTY_PARAMETERS,
    );
  });
});

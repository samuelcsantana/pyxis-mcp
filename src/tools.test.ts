import { describe, expect, it } from 'vitest';
import {
  LOCAL_TIMES_NOTE,
  PYXIS_TOOLS,
  type PyxisTool,
  ToolInputError,
  todayIn,
  VISITOR_TEXT_NOTE,
} from './tools.js';

const PROJECT = '2b2b2b2b-0000-4000-8000-000000000002';
const VISIT = '5d2f8c1a-6b3e-4a7f-9c0d-1e2f3a4b5c6d';
const RANGE = { project_id: PROJECT, from: '2026-10-08', to: '2026-10-14' };
const STEPS = [
  { type: 'page', path: '/pricing' },
  { type: 'event', name: 'signup_completed' },
];
const NOW = new Date('2026-10-15T01:30:00.000Z');
const SAO_PAULO = 'America/Sao_Paulo';
const INSTANT = '2026-10-14T01:41:41.638Z';
const LOCAL_INSTANT = '2026-10-13T22:41:41.638-03:00';

function tool(name: string): PyxisTool {
  const found = PYXIS_TOOLS.find((candidate) => candidate.name === name);
  if (found === undefined) {
    throw new Error(`No tool named ${name}.`);
  }
  return found;
}

function inputProblem(name: string, args: unknown): string {
  try {
    tool(name).request(args);
  } catch (error) {
    if (error instanceof ToolInputError) {
      return error.message;
    }
    throw error;
  }
  throw new Error('The arguments were accepted.');
}

describe('PYXIS_TOOLS', () => {
  it('offers one read-only tool per dashboard screen, each named once', () => {
    expect(PYXIS_TOOLS.map((candidate) => candidate.name)).toEqual([
      'list_projects',
      'overview',
      'devices',
      'acquisition',
      'engagement',
      'time_of_day',
      'features',
      'event_properties',
      'requests',
      'funnel',
      'funnel_segments',
      'funnel_subjects',
      'visits',
      'visit_timeline',
      'project_settings',
    ]);
  });

  it('warns about visitor text in every tool that reports visits or events', () => {
    const reporting = PYXIS_TOOLS.filter(
      (candidate) => !['list_projects', 'project_settings'].includes(candidate.name),
    );

    expect(reporting.every((candidate) => candidate.description.includes(VISITOR_TEXT_NOTE))).toBe(
      true,
    );
  });

  it('says in the description of every tool that answers with times how they are written', () => {
    expect(
      PYXIS_TOOLS.filter((candidate) => candidate.description.includes(LOCAL_TIMES_NOTE)).map(
        (candidate) => candidate.name,
      ),
    ).toEqual([
      'list_projects',
      'requests',
      'funnel_subjects',
      'visits',
      'visit_timeline',
      'project_settings',
    ]);
  });
});

describe('list_projects', () => {
  it('reads /v1/me', () => {
    expect(tool('list_projects').request({})).toEqual({ path: '/v1/me', query: {} });
  });

  it("keeps what an agent needs, in each project's own time zone, and adds its today there", () => {
    const body = {
      email: 'owner@example.com',
      projects: [
        {
          id: PROJECT,
          name: 'Shop',
          timezone: 'America/Sao_Paulo',
          conversion_event: 'signup_completed',
          first_event_at: '2026-09-01T10:00:00.000Z',
          last_event_at: '2026-10-15T01:00:00.000Z',
          icon_version: 'abc123',
        },
        {
          id: VISIT,
          name: 'Docs',
          timezone: 'UTC',
          conversion_event: null,
          first_event_at: null,
          last_event_at: null,
          icon_version: null,
        },
      ],
    };

    expect(tool('list_projects').report(body, NOW)).toEqual({
      projects: [
        {
          id: PROJECT,
          name: 'Shop',
          timezone: 'America/Sao_Paulo',
          today: '2026-10-14',
          conversion_event: 'signup_completed',
          first_event_at: '2026-09-01T07:00:00.000-03:00',
          last_event_at: '2026-10-14T22:00:00.000-03:00',
        },
        {
          id: VISIT,
          name: 'Docs',
          timezone: 'UTC',
          today: '2026-10-15',
          conversion_event: null,
          first_event_at: null,
          last_event_at: null,
        },
      ],
    });
  });

  it('answers nothing for a body it does not recognize', () => {
    expect(tool('list_projects').report({ projects: 'none' }, NOW)).toBeUndefined();
  });
});

describe('the answers that carry times', () => {
  it.each([
    [
      'requests',
      {
        timezone: SAO_PAULO,
        kind: 'writes',
        routes: [
          { route: 'POST /orders', recent_failures: [{ status: 500, occurred_at: INSTANT }] },
        ],
      },
      {
        timezone: SAO_PAULO,
        kind: 'writes',
        routes: [
          { route: 'POST /orders', recent_failures: [{ status: 500, occurred_at: LOCAL_INSTANT }] },
        ],
      },
    ],
    [
      'funnel_subjects',
      {
        timezone: SAO_PAULO,
        next_cursor: `${INSTANT}~${VISIT}`,
        subjects: [{ id: VISIT, last_step_at: INSTANT }],
      },
      {
        timezone: SAO_PAULO,
        next_cursor: `${INSTANT}~${VISIT}`,
        subjects: [{ id: VISIT, last_step_at: LOCAL_INSTANT }],
      },
    ],
    [
      'visits',
      {
        timezone: SAO_PAULO,
        total: 1,
        next_cursor: null,
        visits: [{ id: VISIT, started_at: INSTANT, ended_at: '2026-10-14T01:45:00.000Z' }],
      },
      {
        timezone: SAO_PAULO,
        total: 1,
        next_cursor: null,
        visits: [
          { id: VISIT, started_at: LOCAL_INSTANT, ended_at: '2026-10-13T22:45:00.000-03:00' },
        ],
      },
    ],
    [
      'visit_timeline',
      {
        timezone: SAO_PAULO,
        next_before: INSTANT,
        visits: [
          {
            started_at: INSTANT,
            ended_at: INSTANT,
            events: [
              { name: 'signup_completed', occurred_at: INSTANT, properties: { at: INSTANT } },
            ],
          },
        ],
      },
      {
        timezone: SAO_PAULO,
        next_before: LOCAL_INSTANT,
        visits: [
          {
            started_at: LOCAL_INSTANT,
            ended_at: LOCAL_INSTANT,
            events: [
              { name: 'signup_completed', occurred_at: LOCAL_INSTANT, properties: { at: INSTANT } },
            ],
          },
        ],
      },
    ],
    [
      'project_settings',
      {
        timezone: SAO_PAULO,
        created_at: INSTANT,
        first_event_at: INSTANT,
        last_event_at: INSTANT,
        ingestion_suspended_at: null,
        deletion_held_at: INSTANT,
        public_keys: [{ key: 'pyxis_pk_example', created_at: INSTANT }],
        secret_keys: [{ id: VISIT, created_at: INSTANT }],
      },
      {
        timezone: SAO_PAULO,
        created_at: LOCAL_INSTANT,
        first_event_at: LOCAL_INSTANT,
        last_event_at: LOCAL_INSTANT,
        ingestion_suspended_at: null,
        deletion_held_at: LOCAL_INSTANT,
        public_keys: [{ key: 'pyxis_pk_example', created_at: LOCAL_INSTANT }],
        secret_keys: [{ id: VISIT, created_at: LOCAL_INSTANT }],
      },
    ],
  ])('%s writes its times in the project time zone and leaves the rest', (name, body, local) => {
    expect(tool(name).report(body, NOW)).toEqual(local);
  });

  it('passes an answer that names no time zone, from an older API, as it came', () => {
    const body = { next_before: INSTANT, visits: [{ started_at: INSTANT }] };

    expect(tool('visit_timeline').report(body, NOW)).toBe(body);
  });
});

describe('todayIn', () => {
  it('writes the date of an instant in a time zone as YYYY-MM-DD', () => {
    expect(todayIn('Asia/Tokyo', NOW)).toBe('2026-10-15');
    expect(todayIn('America/Los_Angeles', NOW)).toBe('2026-10-14');
  });
});

describe('the range tools', () => {
  it.each([
    ['overview', 'overview'],
    ['devices', 'devices'],
    ['acquisition', 'acquisition'],
    ['engagement', 'engagement'],
    ['time_of_day', 'time-of-day'],
  ])('%s reads its route with the range only', (name, segment) => {
    expect(tool(name).request(RANGE)).toEqual({
      path: `/v1/projects/${PROJECT}/${segment}`,
      query: { from: '2026-10-08', to: '2026-10-14' },
    });
  });

  it('passes the report through as the API answers it', () => {
    const body = { visits: { current: 3 } };

    expect(tool('overview').report(body, NOW)).toBe(body);
  });

  it.each([
    [{ ...RANGE, project_id: 'not-a-uuid' }, 'project_id'],
    [{ ...RANGE, from: '08/10/2026' }, 'from'],
    [{ ...RANGE, to: undefined }, 'to'],
  ])('refuses %j, naming the field', (args, field) => {
    expect(inputProblem('overview', args)).toContain(field);
  });
});

describe('features and event_properties', () => {
  it('reads named events unless asked for screens', () => {
    expect(tool('features').request(RANGE).query).toEqual({
      from: '2026-10-08',
      to: '2026-10-14',
      kind: 'events',
    });
    expect(tool('features').request({ ...RANGE, kind: 'screens' }).query).toMatchObject({
      kind: 'screens',
    });
  });

  it('breaks down one named event', () => {
    expect(tool('event_properties').request({ ...RANGE, event: 'plan_chosen' })).toEqual({
      path: `/v1/projects/${PROJECT}/features/properties`,
      query: { from: '2026-10-08', to: '2026-10-14', name: 'plan_chosen' },
    });
    expect(inputProblem('event_properties', { ...RANGE, event: 'Plan Chosen' })).toContain('event');
  });
});

describe('requests', () => {
  it('reads the writes by default and narrows to a screen or a route when asked', () => {
    expect(tool('requests').request(RANGE).query).toEqual({
      from: '2026-10-08',
      to: '2026-10-14',
      kind: undefined,
      screen: undefined,
      route: undefined,
    });
    expect(
      tool('requests').request({
        ...RANGE,
        kind: 'reads',
        screen: '/orders',
        route: 'GET /orders/:id',
      }).query,
    ).toMatchObject({ kind: 'reads', screen: '/orders', route: 'GET /orders/:id' });
  });

  it('refuses a route without its method', () => {
    expect(inputProblem('requests', { ...RANGE, route: '/orders' })).toContain('route');
  });
});

describe('the funnel tools', () => {
  it('sends the steps as JSON and counts visits unless asked for people', () => {
    expect(tool('funnel').request({ ...RANGE, steps: STEPS })).toEqual({
      path: `/v1/projects/${PROJECT}/funnel`,
      query: { from: '2026-10-08', to: '2026-10-14', mode: 'visit', steps: JSON.stringify(STEPS) },
    });
    expect(tool('funnel').request({ ...RANGE, steps: STEPS, mode: 'user' }).query).toMatchObject({
      mode: 'user',
    });
  });

  it.each([
    [[STEPS[0]], 'steps'],
    [Array.from({ length: 9 }, () => STEPS[0]), 'steps'],
    [[{ type: 'page', path: 'pricing' }, STEPS[1]], 'path'],
    [[{ type: 'click', name: 'buy' }, STEPS[1]], 'type'],
  ])('refuses the steps %j', (steps, field) => {
    expect(inputProblem('funnel', { ...RANGE, steps })).toContain(field);
  });

  it('splits a funnel by device or channel', () => {
    expect(tool('funnel_segments').request({ ...RANGE, steps: STEPS, by: 'channel' })).toEqual({
      path: `/v1/projects/${PROJECT}/funnel/segments`,
      query: { from: '2026-10-08', to: '2026-10-14', steps: JSON.stringify(STEPS), by: 'channel' },
    });
  });

  it('lists who reached or dropped at a step, a page at a time', () => {
    expect(
      tool('funnel_subjects').request({
        ...RANGE,
        steps: STEPS,
        step: 2,
        outcome: 'dropped',
        cursor: 'next-page',
      }),
    ).toEqual({
      path: `/v1/projects/${PROJECT}/funnel/subjects`,
      query: {
        from: '2026-10-08',
        to: '2026-10-14',
        mode: 'visit',
        steps: JSON.stringify(STEPS),
        step: 2,
        outcome: 'dropped',
        cursor: 'next-page',
      },
    });
    expect(
      inputProblem('funnel_subjects', { ...RANGE, steps: STEPS, step: 1.5, outcome: 'reached' }),
    ).toContain('step');
  });
});

describe('visits', () => {
  it('sends every filter it was given, the pages as a repeated path', () => {
    const query = tool('visits').request({
      ...RANGE,
      pages: ['/pricing', '/checkout*'],
      event: 'plan_chosen',
      property: 'plan=pro',
      channel: 'social',
      device: 'mobile',
      identity: 'anonymous',
      country: 'BR',
      region: 'BR-SP',
      source: 'instagram',
      campaign: 'launch',
      route: 'POST /orders',
      failed: true,
      cursor: 'next-page',
    }).query;

    expect(query).toEqual({
      from: '2026-10-08',
      to: '2026-10-14',
      path: ['/pricing', '/checkout*'],
      event: 'plan_chosen',
      property: 'plan=pro',
      channel: 'social',
      device: 'mobile',
      identity: 'anonymous',
      country: 'BR',
      region: 'BR-SP',
      source: 'instagram',
      campaign: 'launch',
      route: 'POST /orders',
      failed: true,
      cursor: 'next-page',
    });
  });

  it('asks for the event a property filter belongs to', () => {
    expect(inputProblem('visits', { ...RANGE, property: 'plan=pro' })).toBe(
      'property filters the values of an event: give event too.',
    );
  });

  it.each([
    [{ pages: ['/a', '/b', '/c', '/d'] }, 'pages'],
    [{ country: 'Brazil' }, 'country'],
    [{ region: 'SP' }, 'region'],
    [{ channel: 'tv' }, 'channel'],
  ])('refuses the filter %j', (filter, field) => {
    expect(inputProblem('visits', { ...RANGE, ...filter })).toContain(field);
  });
});

describe('visit_timeline', () => {
  it('reads one visit or one person, a page before a cursor when given', () => {
    expect(tool('visit_timeline').request({ project_id: PROJECT, session_id: VISIT })).toEqual({
      path: `/v1/projects/${PROJECT}/timeline`,
      query: { session_id: VISIT, user_id: undefined, before: undefined },
    });
    expect(
      tool('visit_timeline').request({
        project_id: PROJECT,
        user_id: 'user-42',
        before: '2026-10-12T10:00:00.000Z',
      }).query,
    ).toEqual({ session_id: undefined, user_id: 'user-42', before: '2026-10-12T10:00:00.000Z' });
  });

  it('sends a cursor written with an offset as the same instant in UTC, the only form the API reads', () => {
    expect(
      tool('visit_timeline').request({
        project_id: PROJECT,
        session_id: VISIT,
        before: '2026-10-13T22:41:41.638-03:00',
      }).query,
    ).toEqual({ session_id: VISIT, user_id: undefined, before: '2026-10-14T01:41:41.638Z' });
  });

  it.each([
    [{ project_id: PROJECT }],
    [{ project_id: PROJECT, session_id: VISIT, user_id: 'user-42' }],
  ])('asks for exactly one of a visit or a person (%j)', (args) => {
    expect(inputProblem('visit_timeline', args)).toBe('Give exactly one of session_id or user_id.');
  });
});

describe('project_settings', () => {
  it('reads the settings of one project', () => {
    expect(tool('project_settings').request({ project_id: PROJECT })).toEqual({
      path: `/v1/projects/${PROJECT}/settings`,
      query: {},
    });
  });
});

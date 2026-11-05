import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { default as addFormats } from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { PYXIS_TOOLS, type PyxisTool } from './tools.js';

const CONTRACT_FILE = 'contract/openapi.json';
const ACCESS_TOKEN_SCHEME = 'access_token';
const SCHEMA_REFERENCE = '#/components/schemas/';
const SUCCESS = '200';
const JSON_MEDIA_TYPE = 'application/json';
const RESHAPED_ANSWER = 'list_projects';
const GOALS_TOOL = 'goals';
const RESHAPED_ANSWERS: readonly string[] = [RESHAPED_ANSWER, GOALS_TOOL];
const DASHBOARD_ONLY_ROUTES: readonly string[] = ['/v1/projects/{projectId}/arrivals'];
const GOAL_LIST_ROUTE = '/v1/projects/{projectId}/goals';
const GOAL_CREATION_TIME = 'created_at';
const GOAL_CHOICE = 'goal';
const GOAL_FILTER = 'reached_goal';
const PROJECT_SETTINGS = 'project_settings';
const CURRENCY = 'currency';
const VISIT_FILTER = 'channel';
const PROJECT = '2b2b2b2b-0000-4000-8000-000000000002';
const GOAL = '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const NOW = new Date('2026-11-05T12:00:00.000Z');
const VISIT = '5d2f8c1a-6b3e-4a7f-9c0d-1e2f3a4b5c6d';
const RANGE = { project_id: PROJECT, from: '2026-10-08', to: '2026-10-14' };
const STEPS = [
  { type: 'page', path: '/pricing' },
  { type: 'event', name: 'signup_completed' },
];

interface Parameter {
  readonly name: string;
  readonly in: string;
  readonly required?: boolean;
  readonly schema?: { readonly enum?: readonly unknown[]; readonly type?: string };
}

interface SchemaNode {
  readonly $ref?: string;
  readonly format?: string;
  readonly type?: string | readonly string[];
  readonly required?: readonly string[];
  readonly properties?: Readonly<Record<string, SchemaNode>>;
  readonly items?: SchemaNode;
  readonly anyOf?: readonly SchemaNode[];
  readonly enum?: readonly string[];
}

interface Operation {
  readonly parameters?: readonly Parameter[];
  readonly security?: readonly Record<string, unknown>[];
  readonly responses: Record<
    string,
    { readonly content?: Record<string, { readonly schema?: SchemaNode }> }
  >;
}

interface Contract {
  readonly paths: Record<string, { readonly get?: Operation }>;
  readonly components: { readonly schemas: Readonly<Record<string, SchemaNode>> };
}

const contract = JSON.parse(readFileSync(CONTRACT_FILE, 'utf8')) as Contract;

const EVERY_ARGUMENT: Readonly<Record<string, Record<string, unknown>>> = {
  list_projects: {},
  overview: { ...RANGE, goal: GOAL },
  devices: { ...RANGE, goal: GOAL },
  acquisition: { ...RANGE, goal: GOAL },
  goals: {
    ...RANGE,
    pages: ['/pricing'],
    event: 'plan_chosen',
    property: 'plan=pro',
    channel: 'paid',
    device: 'tablet',
    browser: 'safari',
    os: 'ios',
    identity: 'anonymous',
    country: 'BR',
    region: 'BR-BA',
    city: 'Salvador',
    source: 'google',
    campaign: 'launch',
    failed: true,
    reached_goal: GOAL,
  },
  engagement: RANGE,
  time_of_day: RANGE,
  features: { ...RANGE, kind: 'screens' },
  event_properties: { ...RANGE, event: 'plan_chosen' },
  property_summary: {
    ...RANGE,
    event: 'article_read_100',
    key: 'seconds',
    by: 'post',
    pages: ['/blog/*'],
    visit_event: 'newsletter_signup',
    visit_property: 'plan=free',
    channel: 'organic',
    device: 'desktop',
    browser: 'firefox',
    os: 'linux',
    identity: 'identified',
    country: 'BR',
    region: 'BR-SP',
    city: 'Campinas',
    source: 'google',
    campaign: 'launch',
    failed: true,
    reached_goal: GOAL,
  },
  requests: { ...RANGE, kind: 'reads', screen: '/orders', route: 'GET /orders/:id' },
  funnel: { ...RANGE, mode: 'user', steps: STEPS },
  funnel_segments: { ...RANGE, steps: STEPS, by: 'device' },
  funnel_subjects: {
    ...RANGE,
    mode: 'visit',
    steps: STEPS,
    step: 2,
    outcome: 'dropped',
    cursor: 'next-page',
  },
  visits: {
    ...RANGE,
    pages: ['/pricing'],
    event: 'plan_chosen',
    property: 'plan=pro',
    channel: 'social',
    device: 'mobile',
    identity: 'identified',
    country: 'BR',
    region: 'BR-SP',
    city: 'Campinas',
    source: 'instagram',
    campaign: 'launch',
    route: 'POST /orders',
    failed: false,
    reached_goal: GOAL,
    cursor: 'next-page',
  },
  visit_timeline: { project_id: PROJECT, session_id: VISIT, before: '2026-10-12T10:00:00.000Z' },
  project_settings: { project_id: PROJECT },
};

function toolNamed(name: string): PyxisTool {
  const found = PYXIS_TOOLS.find((tool) => tool.name === name);
  if (found === undefined) {
    throw new Error(`No tool named ${name}.`);
  }
  return found;
}

function operationOf(tool: PyxisTool): Operation {
  const operation = contract.paths[tool.route]?.get;
  if (operation === undefined) {
    throw new Error(`The contract has no GET ${tool.route}.`);
  }
  return operation;
}

function resolved(node: SchemaNode): SchemaNode {
  if (node.$ref === undefined) {
    return node;
  }
  const schema = contract.components.schemas[node.$ref.slice(SCHEMA_REFERENCE.length)];
  if (schema === undefined) {
    throw new Error(`The contract has no ${node.$ref}.`);
  }
  return schema;
}

function answerOf(tool: PyxisTool): SchemaNode {
  const schema = operationOf(tool).responses[SUCCESS]?.content?.[JSON_MEDIA_TYPE]?.schema;
  if (schema === undefined) {
    throw new Error(`GET ${tool.route} declares no JSON answer.`);
  }
  return resolved(schema);
}

function instantPaths(node: SchemaNode, path = ''): string[] {
  const schema = resolved(node);
  if (schema.format === 'date-time') {
    return [path];
  }
  const fields = Object.entries(schema.properties ?? {}).flatMap(([key, child]) =>
    instantPaths(child, path === '' ? key : `${path}.${key}`),
  );
  const items = schema.items === undefined ? [] : instantPaths(schema.items, `${path}[]`);
  const options = (schema.anyOf ?? []).flatMap((option) => instantPaths(option, path));
  return [...fields, ...items, ...options].sort();
}

function countedFields(node: SchemaNode): string[] {
  return Object.entries(resolved(node).properties ?? {}).flatMap(([key, child]) => {
    const field = resolved(child);
    const nested = field.items === undefined ? [] : countedFields(field.items);
    return field.type === 'string' ? nested : [key, ...nested];
  });
}

function routePattern(route: string): RegExp {
  const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('\\{projectId\\}', '[^/]+');
  return new RegExp(`^${escaped}$`);
}

function readableRoutes(): string[] {
  return Object.entries(contract.paths)
    .filter(([, item]) =>
      (item.get?.security ?? []).some((requirement) => ACCESS_TOKEN_SCHEME in requirement),
    )
    .map(([route]) => route)
    .sort();
}

describe('the tools against the API contract copied from pyxis-api', () => {
  it('cover every route an access token may read, one tool each, but those only the dashboard asks and the goal list goals answers', () => {
    const forAgents = readableRoutes().filter(
      (route) => !DASHBOARD_ONLY_ROUTES.includes(route) && route !== GOAL_LIST_ROUTE,
    );

    expect(PYXIS_TOOLS.map((tool) => tool.route).sort()).toEqual(forAgents);
  });

  it.each(PYXIS_TOOLS.map((tool) => [tool.name, tool] as const))(
    '%s reads a route that accepts the access token, with declared parameters only',
    (name, tool) => {
      const operation = operationOf(tool);
      const request = tool.request(EVERY_ARGUMENT[name]);
      const queryParameters = (operation.parameters ?? []).filter((item) => item.in === 'query');
      const sent = Object.entries(request.query).filter(([, value]) => value !== undefined);

      expect(operation.security?.some((item) => ACCESS_TOKEN_SCHEME in item)).toBe(true);
      expect(request.path).toMatch(routePattern(tool.route));
      for (const [key, value] of sent) {
        const declared = queryParameters.find((item) => item.name === key);
        expect(declared, `${name} sends ${key}`).toBeDefined();
        const allowed = declared?.schema?.enum;
        if (allowed !== undefined) {
          expect(allowed.map(String), `${name} ${key}`).toContain(String(value));
        }
      }
      const required = queryParameters.filter((item) => item.required === true);
      expect(required.map((item) => item.name).every((key) => sent.some(([k]) => k === key))).toBe(
        true,
      );
    },
  );

  it.each(
    PYXIS_TOOLS.filter((tool) => !RESHAPED_ANSWERS.includes(tool.name)).map(
      (tool) => [tool.name, tool] as const,
    ),
  )('%s writes in the project time zone every instant its answer declares', (_name, tool) => {
    expect([...tool.instants].sort()).toEqual(instantPaths(answerOf(tool)));
  });

  it.each(
    PYXIS_TOOLS.filter((tool) => tool.instants.length > 0).map(
      (tool) => [tool.name, tool] as const,
    ),
  )('%s reads the time zone of its instants from the answer', (_name, tool) => {
    const answer = answerOf(tool);

    expect(answer.required).toContain('timezone');
    expect(answer.properties?.timezone?.type).toBe('string');
  });

  it('overview names every list, count and flag of the unique visitors the API answers', () => {
    const overview = toolNamed('overview');
    const fields = countedFields(answerOf(overview).properties?.visitors ?? {});

    expect(fields).toEqual(expect.arrayContaining(['enabled', 'again_today', 'exact']));
    expect(fields.filter((field) => !overview.description.includes(field))).toEqual([]);
  });

  it.each(['visits', 'visit_timeline'])(
    '%s names every visitor kind a visit carries in the API answer',
    (name) => {
      const tool = toolNamed(name);
      const visit = resolved(answerOf(tool).properties?.visits?.items ?? {});
      const kinds = (visit.properties?.visitor?.anyOf ?? []).flatMap((option) => option.enum ?? []);

      expect(kinds).toEqual(['first_visit', 'first_this_month', 'first_today', 'again_today']);
      expect(kinds.filter((kind) => !tool.description.includes(kind))).toEqual([]);
    },
  );

  it('goals keeps every field of a goal the API lists or sums up, but its creation time', () => {
    const goals = toolNamed(GOALS_TOOL);
    const listed = resolved(contract.components.schemas.Goal ?? {});
    const summed = resolved(answerOf(goals).properties?.goals?.items ?? {});
    const fieldsOf = (schema: SchemaNode): string[] =>
      Object.keys(schema.properties ?? {}).filter((key) => key !== GOAL_CREATION_TIME);
    const goal = {
      id: GOAL,
      name: 'Sign-up',
      type: 'event',
      event: 'signup_completed',
      path: null,
      position: 1,
      created_at: '2026-11-05T01:54:00.000Z',
      conversions: 14,
      converting_visits: 12,
      conversion_rate: 0.1,
      revenue: 1748.6,
    };
    const report = goals.report({ visits: 120, goals: [goal] }, NOW) as {
      readonly goals: readonly Readonly<Record<string, unknown>>[];
    };

    expect(instantPaths(answerOf(goals))).toEqual([`goals[].${GOAL_CREATION_TIME}`]);
    expect(fieldsOf(summed)).toEqual(expect.arrayContaining(fieldsOf(listed)));
    expect(Object.keys(report.goals[0] ?? {}).sort()).toEqual(fieldsOf(summed).sort());
  });

  it('let an agent pick the goal counted as conversions wherever the API counts one', () => {
    const counting = PYXIS_TOOLS.filter((tool) =>
      (operationOf(tool).parameters ?? []).some((item) => item.name === GOAL_CHOICE),
    );

    expect(counting.map((tool) => tool.name)).toEqual(['overview', 'devices', 'acquisition']);
    expect(counting.every((tool) => GOAL_CHOICE in tool.inputSchema)).toBe(true);
  });

  it('let every tool that takes the visit filters keep the visits that reached a goal', () => {
    const filtering = PYXIS_TOOLS.filter((tool) => VISIT_FILTER in tool.inputSchema);

    expect(filtering.map((tool) => tool.name)).toEqual(['goals', 'property_summary', 'visits']);
    expect(filtering.every((tool) => GOAL_FILTER in tool.inputSchema)).toBe(true);
    expect(
      filtering.every((tool) =>
        (operationOf(tool).parameters ?? []).some((item) => item.name === GOAL_FILTER),
      ),
    ).toBe(true);
  });

  it('read the goals summary in the shape goals expects', () => {
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats.default(ajv);
    ajv.addSchema(contract, 'openapi.json');
    const validate = ajv.getSchema('openapi.json#/components/schemas/GoalsSummary');
    const summary = {
      visits: 0,
      goals: [
        {
          id: GOAL,
          name: 'Pricing',
          type: 'page',
          event: null,
          path: '/pricing*',
          position: 2,
          created_at: '2026-11-05T01:54:00.000Z',
          conversions: 0,
          converting_visits: 0,
          conversion_rate: null,
          revenue: null,
        },
      ],
    };

    expect(validate?.(summary), JSON.stringify(validate?.errors)).toBe(true);
    expect(toolNamed(GOALS_TOOL).report(summary, NOW)).toMatchObject({
      visits: 0,
      goals: [{ id: GOAL, path: '/pricing*', conversion_rate: null, revenue: null }],
    });
  });

  it.each([RESHAPED_ANSWER, PROJECT_SETTINGS])(
    '%s names the currency of the revenue, which the API answers for every project',
    (name) => {
      const tool = toolNamed(name);
      const answer = answerOf(tool);
      const project = resolved(answer.properties?.projects?.items ?? answer);

      expect(project.required).toContain(CURRENCY);
      expect(tool.description).toContain(`${CURRENCY} (the ISO 4217 code`);
    },
  );

  it('read /v1/me in the shape list_projects expects', () => {
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats.default(ajv);
    ajv.addSchema(contract, 'openapi.json');
    const validate = ajv.getSchema('openapi.json#/components/schemas/Me');
    const me = {
      email: 'owner@example.com',
      projects: [
        {
          id: PROJECT,
          name: 'Shop',
          timezone: 'America/Sao_Paulo',
          conversion_event: null,
          currency: 'BRL',
          first_event_at: '2026-10-01T12:00:00.000Z',
          last_event_at: null,
          icon_version: null,
          account_id: null,
          ingestion_suspended_at: null,
          ingestion_suspension_reason: null,
        },
      ],
    };
    const projectsTool = PYXIS_TOOLS.find((tool) => tool.name === RESHAPED_ANSWER);
    const instants = instantPaths(contract.components.schemas.Me ?? {});

    expect(validate?.(me), JSON.stringify(validate?.errors)).toBe(true);
    expect(instants).toContain('projects[].first_event_at');
    expect(instants).toContain('projects[].last_event_at');
    expect(projectsTool?.report(me, new Date('2026-10-14T12:00:00.000Z'))).toMatchObject({
      projects: [
        {
          id: PROJECT,
          today: '2026-10-14',
          currency: 'BRL',
          first_event_at: '2026-10-01T09:00:00.000-03:00',
        },
      ],
    });
  });
});

import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { default as addFormats } from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { PYXIS_TOOLS, type PyxisTool } from './tools.js';

const CONTRACT_FILE = 'contract/openapi.json';
const ACCESS_TOKEN_SCHEME = 'access_token';
const PROJECT = '2b2b2b2b-0000-4000-8000-000000000002';
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

interface Operation {
  readonly parameters?: readonly Parameter[];
  readonly security?: readonly Record<string, unknown>[];
  readonly responses: Record<
    string,
    { readonly content?: Record<string, { readonly schema?: { readonly $ref?: string } }> }
  >;
}

interface Contract {
  readonly paths: Record<string, { readonly get?: Operation }>;
}

const contract = JSON.parse(readFileSync(CONTRACT_FILE, 'utf8')) as Contract;

const EVERY_ARGUMENT: Readonly<Record<string, Record<string, unknown>>> = {
  list_projects: {},
  overview: RANGE,
  devices: RANGE,
  acquisition: RANGE,
  engagement: RANGE,
  time_of_day: RANGE,
  features: { ...RANGE, kind: 'screens' },
  event_properties: { ...RANGE, event: 'plan_chosen' },
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
    source: 'instagram',
    campaign: 'launch',
    route: 'POST /orders',
    failed: false,
    cursor: 'next-page',
  },
  visit_timeline: { project_id: PROJECT, session_id: VISIT, before: '2026-10-12T10:00:00.000Z' },
  project_settings: { project_id: PROJECT },
};

function operationOf(tool: PyxisTool): Operation {
  const operation = contract.paths[tool.route]?.get;
  if (operation === undefined) {
    throw new Error(`The contract has no GET ${tool.route}.`);
  }
  return operation;
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
  it('cover every route an access token may read, one tool each', () => {
    expect(PYXIS_TOOLS.map((tool) => tool.route).sort()).toEqual(readableRoutes());
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
          first_event_at: null,
          last_event_at: null,
          icon_version: null,
          ingestion_suspended_at: null,
          ingestion_suspension_reason: null,
        },
      ],
    };
    const projectsTool = PYXIS_TOOLS.find((tool) => tool.name === 'list_projects');

    expect(validate?.(me), JSON.stringify(validate?.errors)).toBe(true);
    expect(projectsTool?.report(me, new Date('2026-10-14T12:00:00.000Z'))).toMatchObject({
      projects: [{ id: PROJECT, today: '2026-10-14' }],
    });
  });
});

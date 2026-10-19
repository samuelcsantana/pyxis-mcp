import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PyxisApi, type Fetch } from './pyxis-api.js';
import {
  createServer,
  INSTALL_GUIDE_URL,
  runTool,
  SERVER_INSTRUCTIONS,
  SERVER_NAME,
  UNEXPECTED_ANSWER,
} from './server.js';
import { PYXIS_TOOLS, VISITOR_TEXT_NOTE } from './tools.js';
import { PACKAGE_VERSION } from './version.js';

const TOKEN = `pyxis_at_${'Q'.repeat(32)}`;
const PROJECT = '2b2b2b2b-0000-4000-8000-000000000002';
const NOW = new Date('2026-10-15T01:30:00.000Z');
const ME = {
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
    },
  ],
};

type Route = (url: URL) => Response;

function fakeApi(route: Route) {
  const fetch = vi.fn<Fetch>((url) => Promise.resolve(route(new URL(url))));
  const api = new PyxisApi({
    token: TOKEN,
    apiUrl: 'https://api.example.com',
    userAgent: 'test',
    fetch,
  });
  return { api, fetch };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const clients: Client[] = [];

async function connect(route: Route, now?: () => Date) {
  const { api, fetch } = fakeApi(route);
  const server = createServer(api, { version: '9.9.9', ...(now ? { now } : {}) });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  clients.push(client);
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return { client, fetch };
}

function textOf(result: Awaited<ReturnType<Client['callTool']>>): string {
  const [first] = result.content as { type: string; text: string }[];
  return first?.text ?? '';
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe('createServer', () => {
  it('introduces itself and lists every tool as read-only, with its input schema', async () => {
    const { client } = await connect(() => json({}));

    expect(client.getServerVersion()).toEqual({ name: SERVER_NAME, version: '9.9.9' });
    expect(client.getInstructions()).toBe(SERVER_INSTRUCTIONS);
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(PYXIS_TOOLS.map((tool) => tool.name));
    expect(tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
    expect(tools.every((tool) => tool.annotations?.destructiveHint === false)).toBe(true);
    expect(tools.every((tool) => tool.annotations?.title === tool.title)).toBe(true);
    expect(tools.find((tool) => tool.name === 'list_projects')?.annotations?.title).toBe(
      'List projects',
    );
    const overview = tools.find((tool) => tool.name === 'overview');
    expect(overview?.inputSchema.required).toEqual(['project_id', 'from', 'to']);
  });

  it("tells an agent that finds no project, or one with no events, where the site's developers find the install guide", async () => {
    const { client } = await connect(() => json({}));

    const instructions = client.getInstructions() ?? '';
    expect(instructions).toContain('An empty list means no project was created yet');
    expect(instructions).toContain('first_event_at is null');
    expect(instructions).toContain(INSTALL_GUIDE_URL);
    expect(instructions).toContain("the site's developers add the npm package pyxis-analytics");
    expect(instructions).toContain('project_settings');
    expect(instructions).not.toContain('rules');
  });

  it("names itself with the package's version when given no options", async () => {
    const { api } = fakeApi(() => json({}));
    const server = createServer(api);
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    clients.push(client);

    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);

    expect(client.getServerVersion()).toEqual({ name: SERVER_NAME, version: PACKAGE_VERSION });
  });

  it("answers list_projects with each project's today, wrapped with the visitor text warning", async () => {
    const { client, fetch } = await connect(
      () => json(ME),
      () => NOW,
    );

    const result = await client.callTool({ name: 'list_projects', arguments: {} });

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textOf(result))).toEqual({
      untrusted_visitor_text: VISITOR_TEXT_NOTE,
      report: {
        projects: [
          {
            id: PROJECT,
            name: 'Shop',
            timezone: 'America/Sao_Paulo',
            today: '2026-10-14',
            conversion_event: null,
            first_event_at: null,
            last_event_at: null,
          },
        ],
      },
    });
    expect(fetch.mock.calls[0]?.[0]).toBe('https://api.example.com/v1/me');
  });

  it('reads the clock at each call when given none', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const { client } = await connect(() => json(ME));

    const result = await client.callTool({ name: 'list_projects', arguments: {} });

    expect(textOf(result)).toContain('"today":"2026-10-14"');
    vi.useRealTimers();
  });

  it('passes a report through and sends the query the tool built', async () => {
    const { client, fetch } = await connect(() => json({ visits: { current: 7 } }));

    const result = await client.callTool({
      name: 'overview',
      arguments: { project_id: PROJECT, from: '2026-10-08', to: '2026-10-14' },
    });

    expect(JSON.parse(textOf(result))).toEqual({
      untrusted_visitor_text: VISITOR_TEXT_NOTE,
      report: { visits: { current: 7 } },
    });
    expect(fetch.mock.calls[0]?.[0]).toBe(
      `https://api.example.com/v1/projects/${PROJECT}/overview?from=2026-10-08&to=2026-10-14`,
    );
  });

  it('answers an API failure as a tool error the agent can read', async () => {
    const { client } = await connect(() => json({}, 401));

    const result = await client.callTool({ name: 'list_projects', arguments: {} });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('PYXIS_TOKEN was refused');
    expect(textOf(result)).not.toContain(TOKEN);
  });

  it('answers arguments the SDK lets through but the tool refuses, without calling the API', async () => {
    const { client, fetch } = await connect(() => json({}));

    const result = await client.callTool({
      name: 'visit_timeline',
      arguments: { project_id: PROJECT },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe('Give exactly one of session_id or user_id.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuses arguments that do not match the schema, without calling the API', async () => {
    const { client, fetch } = await connect(() => json({}));

    const result = await client.callTool({
      name: 'overview',
      arguments: { project_id: PROJECT, from: 'last week', to: '2026-10-14' },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('from');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('says so when the API answers in a shape it does not recognize', async () => {
    const { client } = await connect(() => json({ projects: 'none' }));

    const result = await client.callTool({ name: 'list_projects', arguments: {} });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe(UNEXPECTED_ANSWER);
  });
});

describe('runTool', () => {
  it('lets an unexpected failure of a tool through to the SDK', async () => {
    const { api } = fakeApi(() => json({}));
    const broken = {
      name: 'broken',
      title: 'Broken',
      description: 'A tool whose request fails unexpectedly.',
      inputSchema: {},
      route: '/v1/me',
      instants: [],
      request: () => {
        throw new RangeError('broken tool');
      },
      report: (body: unknown) => body,
    };

    await expect(runTool(broken, api, {}, NOW)).rejects.toThrow('broken tool');
  });
});

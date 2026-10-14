import { spawnSync } from 'node:child_process';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const CLI = path.join(process.cwd(), 'dist', 'cli.js');
const TOKEN = `pyxis_at_${'E'.repeat(32)}`;
const PROJECT = '2b2b2b2b-0000-4000-8000-000000000002';
const ME = {
  email: 'owner@example.com',
  projects: [
    {
      id: PROJECT,
      name: 'Shop',
      timezone: 'UTC',
      conversion_event: 'signup_completed',
      first_event_at: '2026-09-01T10:00:00.000Z',
      last_event_at: '2026-10-14T10:00:00.000Z',
      icon_version: null,
    },
  ],
};

interface SeenRequest {
  readonly url: string;
  readonly authorization: string | undefined;
  readonly userAgent: string | undefined;
}

const seen: SeenRequest[] = [];

function answer(request: IncomingMessage, response: ServerResponse): void {
  seen.push({
    url: request.url ?? '',
    authorization: request.headers.authorization,
    userAgent: request.headers['user-agent'],
  });
  const send = (status: number, body: unknown) => {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  };
  if (request.headers.authorization !== `Bearer ${TOKEN}`) {
    send(401, { status_code: 401, error: 'unauthenticated', message: 'Sign in to continue.' });
    return;
  }
  if (request.url === '/v1/me') {
    send(200, ME);
    return;
  }
  if (request.url?.startsWith(`/v1/projects/${PROJECT}/overview?`) === true) {
    send(200, { visits: { current: 12, previous: 9 } });
    return;
  }
  send(404, { status_code: 404, error: 'not_found', message: 'Not found.' });
}

let api: Server;
let apiUrl: string;
const clients: Client[] = [];

function environment(overrides: Record<string, string>): Record<string, string> {
  const inherited = Object.fromEntries(
    ['PATH', 'SystemRoot', 'HOME', 'USERPROFILE', 'TEMP', 'TMP']
      .map((name) => [name, process.env[name]])
      .filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  return { ...inherited, ...overrides };
}

async function startClient(overrides: Record<string, string>) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [CLI],
    env: environment(overrides),
    stderr: 'pipe',
  });
  const errors: unknown[] = [];
  let stderr = '';
  transport.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  const client = new Client({ name: 'e2e', version: '1.0.0' });
  client.onerror = (error) => {
    errors.push(error);
  };
  clients.push(client);
  await client.connect(transport);
  return { client, errors, stderr: () => stderr };
}

function textOf(result: Awaited<ReturnType<Client['callTool']>>): string {
  const [first] = result.content as { type: string; text: string }[];
  return first?.text ?? '';
}

beforeAll(async () => {
  api = createServer(answer);
  await new Promise<void>((resolve) => {
    api.listen(0, '127.0.0.1', resolve);
  });
  apiUrl = `http://127.0.0.1:${String((api.address() as AddressInfo).port)}`;
});

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
  seen.length = 0;
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    api.close(() => {
      resolve();
    });
  });
});

describe('pyxis-mcp over stdio', () => {
  it('lists the tools and answers them from the API, writing nothing but protocol to stdout', async () => {
    const { client, errors, stderr } = await startClient({
      PYXIS_TOKEN: TOKEN,
      PYXIS_API_URL: apiUrl,
    });

    const { tools } = await client.listTools();
    const projects = await client.callTool({ name: 'list_projects', arguments: {} });
    const overview = await client.callTool({
      name: 'overview',
      arguments: { project_id: PROJECT, from: '2026-10-08', to: '2026-10-14' },
    });

    expect(tools).toHaveLength(15);
    expect(JSON.parse(textOf(projects))).toMatchObject({
      report: { projects: [{ id: PROJECT, name: 'Shop', timezone: 'UTC' }] },
    });
    expect(JSON.parse(textOf(overview))).toMatchObject({
      report: { visits: { current: 12, previous: 9 } },
    });
    expect(seen.map((request) => request.url)).toEqual([
      '/v1/me',
      `/v1/projects/${PROJECT}/overview?from=2026-10-08&to=2026-10-14`,
    ]);
    expect(seen.every((request) => request.authorization === `Bearer ${TOKEN}`)).toBe(true);
    expect(seen[0]?.userAgent).toMatch(/^pyxis-mcp\/\d+\.\d+\.\d+/);
    expect(errors).toEqual([]);
    expect(stderr()).not.toContain(TOKEN);
  });

  it('answers a refused token as a tool error, never repeating the token', async () => {
    const other = `pyxis_at_${'R'.repeat(32)}`;
    const { client } = await startClient({ PYXIS_TOKEN: other, PYXIS_API_URL: apiUrl });

    const result = await client.callTool({ name: 'list_projects', arguments: {} });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('PYXIS_TOKEN was refused');
    expect(textOf(result)).not.toContain(other);
  });

  it('answers an API that is not there as a tool error', async () => {
    const { client } = await startClient({
      PYXIS_TOKEN: TOKEN,
      PYXIS_API_URL: 'http://127.0.0.1:9',
    });

    const result = await client.callTool({ name: 'list_projects', arguments: {} });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('did not answer');
  });

  it.each([
    [{}, 'Set PYXIS_TOKEN'],
    [{ PYXIS_TOKEN: 'not-a-token' }, 'PYXIS_TOKEN is not a Pyxis access token'],
    [
      { PYXIS_TOKEN: TOKEN, PYXIS_API_URL: 'http://api.example.com' },
      'PYXIS_API_URL must use https',
    ],
  ])(
    'refuses to start with %j, saying why on stderr and nothing on stdout',
    (overrides, reason) => {
      const run = spawnSync(process.execPath, [CLI], {
        env: environment(overrides),
        input: '',
        encoding: 'utf8',
        timeout: 15_000,
      });

      expect(run.status).toBe(1);
      expect(run.stderr).toContain(`pyxis-mcp: ${reason}`);
      expect(run.stdout).toBe('');
    },
  );
});

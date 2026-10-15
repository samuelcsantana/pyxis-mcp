import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { environment, PROJECT, startFakeApi, textOf, TOKEN, type FakeApi } from './support.js';

const CLI = path.join(process.cwd(), 'dist', 'cli.js');

let api: FakeApi;
const clients: Client[] = [];

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

beforeAll(async () => {
  api = await startFakeApi();
});

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
  api.seen.length = 0;
});

afterAll(async () => {
  await api.close();
});

describe('pyxis-mcp over stdio', () => {
  it('lists the tools and answers them from the API, writing nothing but protocol to stdout', async () => {
    const { client, errors, stderr } = await startClient({
      PYXIS_TOKEN: TOKEN,
      PYXIS_API_URL: api.url,
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
    expect(api.seen.map((request) => request.url)).toEqual([
      '/v1/me',
      `/v1/projects/${PROJECT}/overview?from=2026-10-08&to=2026-10-14`,
    ]);
    expect(api.seen.every((request) => request.authorization === `Bearer ${TOKEN}`)).toBe(true);
    expect(api.seen[0]?.userAgent).toMatch(/^pyxis-mcp\/\d+\.\d+\.\d+/);
    expect(errors).toEqual([]);
    expect(stderr()).not.toContain(TOKEN);
  });

  it('answers a refused token as a tool error, never repeating the token', async () => {
    const other = `pyxis_at_${'R'.repeat(32)}`;
    const { client } = await startClient({ PYXIS_TOKEN: other, PYXIS_API_URL: api.url });

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

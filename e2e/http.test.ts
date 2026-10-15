import { spawn, spawnSync, type ChildProcessByStdio } from 'node:child_process';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { environment, PROJECT, startFakeApi, textOf, TOKEN, type FakeApi } from './support.js';

const HOST = path.join(process.cwd(), 'e2e', 'http-host.ts');
const LISTENING = /listening (\d+)/;
const LIBRARY_EXPORTS = 'PyxisApi,createServer,handleHttpRequest';

let api: FakeApi;
let host: ChildProcessByStdio<null, Readable, null>;
let endpoint: URL;
const clients: Client[] = [];

function startHost(apiUrl: string): Promise<number> {
  host = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', HOST], {
    env: environment({ PYXIS_API_URL: apiUrl }),
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return new Promise((resolve, reject) => {
    let output = '';
    host.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      const port = LISTENING.exec(output)?.[1];
      if (port !== undefined) {
        resolve(Number(port));
      }
    });
    host.once('exit', (code) => {
      reject(new Error(`the host stopped with ${String(code)}`));
    });
  });
}

async function connect(token: string) {
  const transport = new StreamableHTTPClientTransport(endpoint, {
    requestInit: { headers: { authorization: `Bearer ${token}` } },
  });
  const client = new Client({ name: 'e2e', version: '1.0.0' });
  const errors: unknown[] = [];
  client.onerror = (error) => {
    errors.push(error);
  };
  clients.push(client);
  await client.connect(transport);
  return { client, transport, errors };
}

function rawPost(headers: Record<string, string>): Promise<Response> {
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${TOKEN}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...headers,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  });
}

function loadByName(args: readonly string[]): string {
  const run = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 15_000 });
  return run.stdout;
}

beforeAll(async () => {
  api = await startFakeApi();
  endpoint = new URL(`http://127.0.0.1:${String(await startHost(api.url))}/mcp`);
});

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
  api.seen.length = 0;
});

afterAll(async () => {
  host.kill();
  await api.close();
});

describe('pyxis-mcp as a library behind an HTTP host', () => {
  it("lists the tools and answers them from the API with the caller's token, opening no session", async () => {
    const { client, transport, errors } = await connect(TOKEN);

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
    expect(transport.sessionId).toBeUndefined();
    expect(errors).toEqual([]);
  });

  it('answers a token the API refuses as a tool error in the words the host chose', async () => {
    const other = `pyxis_at_${'R'.repeat(32)}`;
    const { client } = await connect(other);

    const result = await client.callTool({ name: 'list_projects', arguments: {} });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe(
      'The access token was refused: it may be revoked or expired. Create a new one in the Pyxis dashboard.',
    );
  });

  it('refuses GET and DELETE with 405, and a request from a web page with 403', async () => {
    const get = await fetch(endpoint, { headers: { authorization: `Bearer ${TOKEN}` } });
    const remove = await fetch(endpoint, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    const fromPage = await rawPost({ origin: 'https://attacker.example' });
    const fromProgram = await rawPost({});

    expect([get.status, remove.status, fromPage.status, fromProgram.status]).toEqual([
      405, 405, 403, 200,
    ]);
    expect(get.headers.get('allow')).toBe('POST');
    expect(api.seen).toEqual([]);
  });

  it('loads by its name with import and with require', () => {
    expect(
      loadByName([
        '--input-type=module',
        '-e',
        "const m = await import('pyxis-mcp'); process.stdout.write(Object.keys(m).sort().join(','));",
      ]),
    ).toBe(LIBRARY_EXPORTS);
    expect(
      loadByName([
        '-e',
        "process.stdout.write(Object.keys(require('pyxis-mcp')).sort().join(','));",
      ]),
    ).toBe(LIBRARY_EXPORTS);
  });
});

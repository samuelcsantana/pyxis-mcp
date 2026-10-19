import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it, vi } from 'vitest';
import {
  ALLOWED_METHOD,
  handleHttpRequest,
  HTTP_REFUSALS,
  MAX_REQUEST_BYTES,
  type HttpOptions,
} from './http.js';
import { PyxisApi, type Fetch, type ProblemTexts } from './pyxis-api.js';
import { SERVER_INSTRUCTIONS, SERVER_NAME } from './server.js';
import { PYXIS_TOOLS, VISITOR_TEXT_NOTICE } from './tools.js';
import { PACKAGE_VERSION } from './version.js';

const TOKEN = `pyxis_oat_${'H'.repeat(43)}`;
const PROJECT = '2b2b2b2b-0000-4000-8000-000000000002';
const ENDPOINT = 'https://api.example.com/mcp';
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
const HOSTED_TEXTS: ProblemTexts = {
  refusedToken: 'Pyxis refused this connection. Connect Pyxis again.',
  unreachableAdvice: 'Try again in a moment.',
};
const BOTH_MEDIA_TYPES = 'application/json, text/event-stream';

interface JsonRpcAnswer {
  readonly jsonrpc: string;
  readonly id: number | string | null;
  readonly result?: Record<string, unknown>;
  readonly error?: { readonly code: number; readonly message: string };
}

function fakeApi(status: number, body: unknown, problemTexts?: ProblemTexts) {
  const fetch = vi.fn<Fetch>(() => Promise.resolve(new Response(JSON.stringify(body), { status })));
  const api = new PyxisApi({
    token: TOKEN,
    apiUrl: 'https://api.example.com',
    userAgent: 'test',
    fetch,
    ...(problemTexts ? { problemTexts } : {}),
  });
  return { api, fetch };
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(ENDPOINT, {
    method: ALLOWED_METHOD,
    headers: {
      'content-type': 'application/json',
      accept: BOTH_MEDIA_TYPES,
      'mcp-protocol-version': LATEST_PROTOCOL_VERSION,
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function call(method: string, params: Record<string, unknown> = {}, id: number | string = 1) {
  return { jsonrpc: '2.0', id, method, params };
}

function initialize() {
  return call('initialize', {
    protocolVersion: LATEST_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: 'test-client', version: '1.0.0' },
  });
}

async function answerOf(response: Response): Promise<JsonRpcAnswer> {
  return (await response.json()) as JsonRpcAnswer;
}

async function toolText(response: Response): Promise<{ text: string; isError: unknown }> {
  const { result } = await answerOf(response);
  const [first] = (result?.content ?? []) as { text: string }[];
  return { text: first?.text ?? '', isError: result?.isError };
}

describe('handleHttpRequest', () => {
  it('answers an initialize with JSON, naming the server and opening no session', async () => {
    const { api } = fakeApi(200, {});

    const response = await handleHttpRequest(post(initialize()), api, { version: '9.9.9' });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('mcp-session-id')).toBeNull();
    const { id, result } = await answerOf(response);
    expect(id).toBe(1);
    expect(result).toMatchObject({
      protocolVersion: LATEST_PROTOCOL_VERSION,
      serverInfo: { name: SERVER_NAME, version: '9.9.9' },
      instructions: SERVER_INSTRUCTIONS,
      capabilities: { tools: {} },
    });
  });

  it("names itself with the package's version when given none", async () => {
    const { api } = fakeApi(200, {});

    const { result } = await answerOf(await handleHttpRequest(post(initialize()), api));

    expect(result?.serverInfo).toEqual({ name: SERVER_NAME, version: PACKAGE_VERSION });
  });

  it('lists every tool on a request of its own, as each stateless request arrives', async () => {
    const { api, fetch } = fakeApi(200, {});

    const { result } = await answerOf(
      await handleHttpRequest(post(call('tools/list', {}, 'list')), api),
    );

    expect((result?.tools as { name: string }[]).map((tool) => tool.name)).toEqual(
      PYXIS_TOOLS.map((tool) => tool.name),
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('runs a tool against the API with the caller token and answers its report', async () => {
    const { api, fetch } = fakeApi(200, ME);

    const response = await handleHttpRequest(
      post(call('tools/call', { name: 'list_projects', arguments: {} })),
      api,
      { now: () => NOW },
    );

    const { text, isError } = await toolText(response);
    expect(isError).toBeUndefined();
    expect(JSON.parse(text)).toEqual({
      untrusted_visitor_text: VISITOR_TEXT_NOTICE,
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
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('https://api.example.com/v1/me');
    expect(init?.headers).toMatchObject({ authorization: `Bearer ${TOKEN}` });
  });

  it('answers a refused token as a tool error in the words the host chose', async () => {
    const { api } = fakeApi(401, {}, HOSTED_TEXTS);

    const response = await handleHttpRequest(
      post(call('tools/call', { name: 'list_projects', arguments: {} })),
      api,
    );

    expect(response.status).toBe(200);
    await expect(toolText(response)).resolves.toEqual({
      text: HOSTED_TEXTS.refusedToken,
      isError: true,
    });
  });

  it('serves request after request, each on a server of its own that it closes', async () => {
    const close = vi.spyOn(McpServer.prototype, 'close');
    const { api } = fakeApi(200, ME);

    const first = await handleHttpRequest(post(initialize()), api);
    const second = await handleHttpRequest(post(call('tools/list', {}, 2)), api);

    expect([first.status, second.status]).toEqual([200, 200]);
    expect(close).toHaveBeenCalledTimes(2);
  });

  it('accepts a notification with 202 and an empty body', async () => {
    const { api } = fakeApi(200, {});

    const response = await handleHttpRequest(
      post({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      api,
    );

    expect(response.status).toBe(202);
    await expect(response.text()).resolves.toBe('');
  });

  it.each(['GET', 'DELETE', 'PUT', 'OPTIONS'])(
    'refuses %s with 405, saying POST is the only method',
    async (method) => {
      const { api, fetch } = fakeApi(200, {});

      const response = await handleHttpRequest(new Request(ENDPOINT, { method }), api);

      expect(response.status).toBe(405);
      expect(response.headers.get('allow')).toBe('POST');
      expect(response.headers.get('content-type')).toBe('application/json');
      await expect(answerOf(response)).resolves.toEqual({
        jsonrpc: '2.0',
        error: { code: -32000, message: HTTP_REFUSALS.method },
        id: null,
      });
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it('refuses a request sent by a web page with 403', async () => {
    const { api, fetch } = fakeApi(200, ME);

    const response = await handleHttpRequest(
      post(call('tools/call', { name: 'list_projects', arguments: {} }), {
        origin: 'https://attacker.example',
      }),
      api,
    );

    expect(response.status).toBe(403);
    await expect(answerOf(response)).resolves.toEqual({
      jsonrpc: '2.0',
      error: { code: -32000, message: HTTP_REFUSALS.origin },
      id: null,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('answers a request from an origin it was told to accept', async () => {
    const { api } = fakeApi(200, {});
    const options: HttpOptions = { allowedOrigins: ['https://client.example'] };

    const allowed = await handleHttpRequest(
      post(initialize(), { origin: 'https://client.example' }),
      api,
      options,
    );
    const other = await handleHttpRequest(
      post(initialize(), { origin: 'https://other.example' }),
      api,
      options,
    );

    expect([allowed.status, other.status]).toEqual([200, 403]);
  });

  it('refuses a body that is not JSON with a parse error', async () => {
    const { api } = fakeApi(200, {});

    const response = await handleHttpRequest(post('{"jsonrpc":'), api);

    expect(response.status).toBe(400);
    expect((await answerOf(response)).error?.code).toBe(-32700);
  });

  it('refuses a client that does not accept both JSON and an event stream', async () => {
    const { api } = fakeApi(200, {});

    const response = await handleHttpRequest(
      post(initialize(), { accept: 'application/json' }),
      api,
    );

    expect(response.status).toBe(406);
  });

  it(`refuses a body over ${String(MAX_REQUEST_BYTES)} bytes before reading it as JSON`, async () => {
    const { api, fetch } = fakeApi(200, {});
    const padding = 'x'.repeat(MAX_REQUEST_BYTES);

    const response = await handleHttpRequest(
      post(call('tools/call', { name: 'list_projects', arguments: { padding } })),
      api,
    );

    expect(response.status).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });
});

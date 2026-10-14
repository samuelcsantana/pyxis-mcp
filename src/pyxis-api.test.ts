import { describe, expect, it, vi } from 'vitest';
import { PROBLEMS, PyxisApi, REQUEST_TIMEOUT_MS, requestUrl, type Fetch } from './pyxis-api.js';

const TOKEN = `pyxis_at_${'A'.repeat(32)}`;
const CONFIG = { token: TOKEN, apiUrl: 'https://api.example.com' };
const USER_AGENT = 'pyxis-mcp/1.2.3';

function answering(response: Response): ReturnType<typeof vi.fn<Fetch>> {
  return vi.fn<Fetch>(() => Promise.resolve(response));
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('requestUrl', () => {
  it('joins the path to the API and repeats array values, skipping the absent ones', () => {
    expect(
      requestUrl('https://api.example.com', '/v1/projects/p1/visits', {
        from: '2026-10-01',
        path: ['/a', '/b c'],
        step: 2,
        failed: true,
        cursor: undefined,
      }),
    ).toBe(
      'https://api.example.com/v1/projects/p1/visits?from=2026-10-01&path=%2Fa&path=%2Fb+c&step=2&failed=true',
    );
  });
});

describe('PyxisApi', () => {
  it('reads with the token as a bearer, asks for JSON, names itself and gives up after a timeout', async () => {
    const fetch = answering(json(200, { projects: [] }));
    const timeout = vi.spyOn(AbortSignal, 'timeout');

    const outcome = await new PyxisApi(CONFIG, USER_AGENT, fetch).get('/v1/me');

    expect(outcome).toEqual({ ok: true, body: { projects: [] } });
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('https://api.example.com/v1/me');
    expect(init?.headers).toEqual({
      authorization: `Bearer ${TOKEN}`,
      accept: 'application/json',
      'user-agent': USER_AGENT,
    });
    expect(timeout).toHaveBeenCalledWith(REQUEST_TIMEOUT_MS);
  });

  it('uses the global fetch and the default timeout when given none', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() => Promise.resolve(json(200, {})));
    vi.stubGlobal('fetch', fetch);

    await expect(new PyxisApi(CONFIG, USER_AGENT).get('/v1/me')).resolves.toEqual({
      ok: true,
      body: {},
    });
    expect(fetch).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it.each([
    [401, {}, PROBLEMS.refusedToken],
    [404, {}, PROBLEMS.notFound],
    [503, {}, 'The Pyxis API answered 503. Try again later.'],
  ])('explains a %i', async (status, body, problem) => {
    const outcome = await new PyxisApi(CONFIG, USER_AGENT, answering(json(status, body))).get('/x');

    expect(outcome).toEqual({ ok: false, problem });
  });

  it('passes on the reason the API gives for refusing a request', async () => {
    const fetch = answering(
      json(400, { status_code: 400, error: 'invalid_request', message: 'to: must be a date.' }),
    );

    await expect(new PyxisApi(CONFIG, USER_AGENT, fetch).get('/x')).resolves.toEqual({
      ok: false,
      problem: 'The Pyxis API refused the request. invalid_request: to: must be a date.',
    });
  });

  it.each([
    ['without a reason', json(400, { status_code: 400 })],
    ['with a body that is not JSON', new Response('<html>', { status: 400 })],
  ])('says the request was refused %s', async (_, response) => {
    await expect(new PyxisApi(CONFIG, USER_AGENT, answering(response)).get('/x')).resolves.toEqual({
      ok: false,
      problem: PROBLEMS.rejected,
    });
  });

  it.each([
    [{ 'retry-after': '42' }, 'Try again in 42 seconds.'],
    [{}, 'Try again in a minute.'],
    [{ 'retry-after': 'soon' }, 'Try again in a minute.'],
  ])('says how long to wait after the rate limit (%j)', async (headers, wait) => {
    const outcome = await new PyxisApi(CONFIG, USER_AGENT, answering(json(429, {}, headers))).get(
      '/x',
    );

    expect(outcome).toEqual({
      ok: false,
      problem: `Too many requests: each access token may make 60 requests a minute. ${wait}`,
    });
  });

  it.each([
    ['a timeout', new DOMException('The operation timed out.', 'TimeoutError'), 'TimeoutError'],
    ['a network failure', new TypeError('fetch failed'), 'TypeError'],
    ['something thrown that is not an error', Object.create(null) as Error, 'Error'],
  ])('reports %s without the token', async (_, failure, reason) => {
    const fetch = vi.fn<Fetch>(() => Promise.reject(failure));

    const outcome = await new PyxisApi(CONFIG, USER_AGENT, fetch).get('/x');

    expect(outcome).toEqual({
      ok: false,
      problem: `The Pyxis API at https://api.example.com did not answer (${reason}). Check PYXIS_API_URL and the network, then try again.`,
    });
    expect(JSON.stringify(outcome)).not.toContain(TOKEN);
  });

  it('refuses a successful answer that is not JSON', async () => {
    const fetch = answering(new Response('<html>', { status: 200 }));

    await expect(new PyxisApi(CONFIG, USER_AGENT, fetch).get('/x')).resolves.toEqual({
      ok: false,
      problem: PROBLEMS.notJson,
    });
  });
});

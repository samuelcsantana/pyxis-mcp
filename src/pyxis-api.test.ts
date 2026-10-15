import { describe, expect, it, vi } from 'vitest';
import {
  LOCAL_PROBLEM_TEXTS,
  PROBLEMS,
  PyxisApi,
  REQUEST_TIMEOUT_MS,
  requestUrl,
  type Fetch,
  type PyxisApiOptions,
} from './pyxis-api.js';
import { userAgent } from './version.js';

const TOKEN = `pyxis_at_${'A'.repeat(32)}`;
const CONFIG = { token: TOKEN, apiUrl: 'https://api.example.com' };
const USER_AGENT = 'pyxis-mcp/1.2.3';
const HOSTED_TEXTS = {
  refusedToken: 'This connection was refused. Connect again.',
  unreachableAdvice: 'Try again in a moment.',
};

function answering(response: Response): ReturnType<typeof vi.fn<Fetch>> {
  return vi.fn<Fetch>(() => Promise.resolve(response));
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function apiWith(fetch: Fetch, options: Partial<PyxisApiOptions> = {}): PyxisApi {
  return new PyxisApi({ ...CONFIG, userAgent: USER_AGENT, fetch, ...options });
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

    const outcome = await apiWith(fetch).get('/v1/me');

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

  it('waits as long as it is told to', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');

    await apiWith(answering(json(200, {})), { timeoutMs: 2_500 }).get('/v1/me');

    expect(timeout).toHaveBeenCalledWith(2_500);
  });

  it("uses the global fetch, the package's user agent and the default timeout when given none", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() => Promise.resolve(json(200, {})));
    vi.stubGlobal('fetch', fetch);
    const timeout = vi.spyOn(AbortSignal, 'timeout');

    await expect(new PyxisApi(CONFIG).get('/v1/me')).resolves.toEqual({
      ok: true,
      body: {},
    });
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[1]?.headers).toMatchObject({ 'user-agent': userAgent() });
    expect(timeout).toHaveBeenCalledWith(REQUEST_TIMEOUT_MS);
    vi.unstubAllGlobals();
  });

  it.each([
    [401, {}, LOCAL_PROBLEM_TEXTS.refusedToken],
    [404, {}, PROBLEMS.notFound],
    [503, {}, 'The Pyxis API answered 503. Try again later.'],
  ])('explains a %i', async (status, body, problem) => {
    const outcome = await apiWith(answering(json(status, body))).get('/x');

    expect(outcome).toEqual({ ok: false, problem });
  });

  it('tells a refused token in the words it was given', async () => {
    const outcome = await apiWith(answering(json(401, {})), { problemTexts: HOSTED_TEXTS }).get(
      '/x',
    );

    expect(outcome).toEqual({ ok: false, problem: HOSTED_TEXTS.refusedToken });
  });

  it('passes on the reason the API gives for refusing a request', async () => {
    const fetch = answering(
      json(400, { status_code: 400, error: 'invalid_request', message: 'to: must be a date.' }),
    );

    await expect(apiWith(fetch).get('/x')).resolves.toEqual({
      ok: false,
      problem: 'The Pyxis API refused the request. invalid_request: to: must be a date.',
    });
  });

  it.each([
    ['without a reason', json(400, { status_code: 400 })],
    ['with a body that is not JSON', new Response('<html>', { status: 400 })],
  ])('says the request was refused %s', async (_, response) => {
    await expect(apiWith(answering(response)).get('/x')).resolves.toEqual({
      ok: false,
      problem: PROBLEMS.rejected,
    });
  });

  it.each([
    [{ 'retry-after': '42' }, 'Try again in 42 seconds.'],
    [{}, 'Try again in a minute.'],
    [{ 'retry-after': 'soon' }, 'Try again in a minute.'],
  ])('says how long to wait after the rate limit (%j)', async (headers, wait) => {
    const outcome = await apiWith(answering(json(429, {}, headers))).get('/x');

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

    const outcome = await apiWith(fetch).get('/x');

    expect(outcome).toEqual({
      ok: false,
      problem: `The Pyxis API at https://api.example.com did not answer (${reason}). Check PYXIS_API_URL and the network, then try again.`,
    });
    expect(JSON.stringify(outcome)).not.toContain(TOKEN);
  });

  it('gives the advice it was given when the API does not answer', async () => {
    const fetch = vi.fn<Fetch>(() => Promise.reject(new TypeError('fetch failed')));

    const outcome = await apiWith(fetch, { problemTexts: HOSTED_TEXTS }).get('/x');

    expect(outcome).toEqual({
      ok: false,
      problem:
        'The Pyxis API at https://api.example.com did not answer (TypeError). Try again in a moment.',
    });
  });

  it('refuses a successful answer that is not JSON', async () => {
    const fetch = answering(new Response('<html>', { status: 200 }));

    await expect(apiWith(fetch).get('/x')).resolves.toEqual({
      ok: false,
      problem: PROBLEMS.notJson,
    });
  });
});

import type { PyxisConfig } from './config.js';
import { userAgent } from './version.js';

export const REQUEST_TIMEOUT_MS = 15_000;
export const REQUESTS_PER_MINUTE = 60;

const STATUS_BAD_REQUEST = 400;
const STATUS_UNAUTHORIZED = 401;
const STATUS_NOT_FOUND = 404;
const STATUS_TOO_MANY_REQUESTS = 429;
const RETRY_AFTER_HEADER = 'retry-after';
const JSON_MEDIA_TYPE = 'application/json';

export type QueryValue = string | number | boolean | readonly string[] | undefined;
export type Query = Readonly<Record<string, QueryValue>>;

export type ApiOutcome =
  { readonly ok: true; readonly body: unknown } | { readonly ok: false; readonly problem: string };

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export interface ProblemTexts {
  readonly refusedToken: string;
  readonly unreachableAdvice: string;
}

export const LOCAL_PROBLEM_TEXTS: ProblemTexts = {
  refusedToken:
    'PYXIS_TOKEN was refused: it may be revoked or expired. Create a new access token in the Pyxis dashboard, under Settings, Access tokens.',
  unreachableAdvice: 'Check PYXIS_API_URL and the network, then try again.',
};

export interface PyxisApiOptions extends PyxisConfig {
  readonly userAgent?: string;
  readonly fetch?: Fetch;
  readonly timeoutMs?: number;
  readonly problemTexts?: ProblemTexts;
}

export const PROBLEMS = {
  notFound:
    'Not found: no project with this id among the projects this token can read. Call list_projects for the ids.',
  rejected: 'The Pyxis API refused the request.',
  notJson: 'The Pyxis API answered with something that is not JSON.',
} as const;

function appendQuery(url: URL, query: Query): void {
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) {
      continue;
    }
    const values = typeof value === 'object' ? value : [String(value)];
    for (const item of values) {
      url.searchParams.append(key, item);
    }
  }
}

export function requestUrl(apiUrl: string, path: string, query: Query): string {
  const url = new URL(path, apiUrl);
  appendQuery(url, query);
  return url.toString();
}

function hasStringField<Key extends string>(
  body: unknown,
  key: Key,
): body is Readonly<Record<Key, string>> {
  return (
    typeof body === 'object' &&
    body !== null &&
    key in body &&
    typeof (body as Record<Key, unknown>)[key] === 'string'
  );
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function rejectedProblem(response: Response): Promise<string> {
  const body = await readJson(response);
  if (hasStringField(body, 'error') && hasStringField(body, 'message')) {
    return `${PROBLEMS.rejected} ${body.error}: ${body.message}`;
  }
  return PROBLEMS.rejected;
}

function rateLimitedProblem(response: Response): string {
  const retryAfter = Number(response.headers.get(RETRY_AFTER_HEADER));
  const wait =
    Number.isFinite(retryAfter) && retryAfter > 0
      ? `in ${String(retryAfter)} seconds`
      : 'in a minute';
  return `Too many requests: each access token may make ${String(REQUESTS_PER_MINUTE)} requests a minute. Try again ${wait}.`;
}

async function problemOf(response: Response, texts: ProblemTexts): Promise<string> {
  switch (response.status) {
    case STATUS_UNAUTHORIZED:
      return texts.refusedToken;
    case STATUS_NOT_FOUND:
      return PROBLEMS.notFound;
    case STATUS_TOO_MANY_REQUESTS:
      return rateLimitedProblem(response);
    case STATUS_BAD_REQUEST:
      return rejectedProblem(response);
    default:
      return `The Pyxis API answered ${String(response.status)}. Try again later.`;
  }
}

export class PyxisApi {
  private readonly token: string;
  private readonly apiUrl: string;
  private readonly userAgent: string;
  private readonly fetch: Fetch;
  private readonly timeoutMs: number;
  private readonly problemTexts: ProblemTexts;

  constructor(options: PyxisApiOptions) {
    this.token = options.token;
    this.apiUrl = options.apiUrl;
    this.userAgent = options.userAgent ?? userAgent();
    this.fetch = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
    this.problemTexts = options.problemTexts ?? LOCAL_PROBLEM_TEXTS;
  }

  async get(path: string, query: Query = {}): Promise<ApiOutcome> {
    let response: Response;
    try {
      response = await this.fetch(requestUrl(this.apiUrl, path, query), {
        headers: {
          authorization: `Bearer ${this.token}`,
          accept: JSON_MEDIA_TYPE,
          'user-agent': this.userAgent,
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.name : 'Error';
      return {
        ok: false,
        problem: `The Pyxis API at ${this.apiUrl} did not answer (${reason}). ${this.problemTexts.unreachableAdvice}`,
      };
    }
    if (!response.ok) {
      return { ok: false, problem: await problemOf(response, this.problemTexts) };
    }
    const body = await readJson(response);
    return body === undefined ? { ok: false, problem: PROBLEMS.notJson } : { ok: true, body };
  }
}

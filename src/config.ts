export const DEFAULT_API_URL = 'https://api.pyxis-analytics.dev';
export const ACCESS_TOKEN_PATTERN = /^pyxis_at_[A-Za-z0-9]{32}$/;

const SECURE_PROTOCOL = 'https:';
const LOCAL_PROTOCOL = 'http:';
const LOCAL_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);
const ROOT_PATH = '/';

export interface PyxisConfig {
  readonly token: string;
  readonly apiUrl: string;
}

export type ConfigProblem =
  'missing-token' | 'malformed-token' | 'invalid-api-url' | 'insecure-api-url';

const PROBLEM_MESSAGES: Readonly<Record<ConfigProblem, string>> = {
  'missing-token':
    'Set PYXIS_TOKEN to a read-only access token created in the Pyxis dashboard, under Settings, Access tokens.',
  'malformed-token':
    'PYXIS_TOKEN is not a Pyxis access token: it starts with pyxis_at_ followed by 32 letters and digits.',
  'invalid-api-url':
    'PYXIS_API_URL must be the address of a Pyxis API with no path, such as https://api.pyxis-analytics.dev.',
  'insecure-api-url': 'PYXIS_API_URL must use https; plain http is accepted only for localhost.',
};

export class ConfigError extends Error {
  constructor(readonly problem: ConfigProblem) {
    super(PROBLEM_MESSAGES[problem]);
    this.name = 'ConfigError';
  }
}

export type Environment = Readonly<Record<string, string | undefined>>;

export function readConfig(environment: Environment): PyxisConfig {
  return {
    token: readToken(environment.PYXIS_TOKEN),
    apiUrl: readApiUrl(environment.PYXIS_API_URL),
  };
}

function readToken(raw: string | undefined): string {
  const token = raw?.trim() ?? '';
  if (token === '') {
    throw new ConfigError('missing-token');
  }
  if (!ACCESS_TOKEN_PATTERN.test(token)) {
    throw new ConfigError('malformed-token');
  }
  return token;
}

function isBareOrigin(url: URL): boolean {
  return (
    url.username === '' &&
    url.password === '' &&
    url.pathname === ROOT_PATH &&
    url.search === '' &&
    url.hash === ''
  );
}

function readApiUrl(raw: string | undefined): string {
  const value = raw?.trim() ?? '';
  if (value === '') {
    return DEFAULT_API_URL;
  }
  const url = URL.parse(value);
  if (url === null || !isBareOrigin(url)) {
    throw new ConfigError('invalid-api-url');
  }
  if (url.protocol === SECURE_PROTOCOL) {
    return url.origin;
  }
  if (url.protocol !== LOCAL_PROTOCOL) {
    throw new ConfigError('invalid-api-url');
  }
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new ConfigError('insecure-api-url');
  }
  return url.origin;
}

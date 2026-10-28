import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ACCESS_TOKEN_PATTERN,
  type ConfigProblem,
  ConfigError,
  DEFAULT_API_URL,
  type Environment,
  type PyxisConfig,
  readConfig,
} from './config.js';
import { PROPERTY_PARAMETERS } from './property-parameters.js';

const TOKEN = `pyxis_at_${'Ab3'.repeat(10)}xy`;
const TOKEN_PREFIX = 'pyxis_at_';
const ACCEPTED_ORIGIN =
  /^(https:\/\/[^/?#@\s]+|http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?)$/;
const ADDRESS_PROBLEMS: readonly ConfigProblem[] = ['invalid-api-url', 'insecure-api-url'];
const LARGEST_PORT = 65_535;

type Verdict = PyxisConfig | ConfigProblem;

function verdictOf(environment: Environment): Verdict {
  try {
    return readConfig(environment);
  } catch (error) {
    if (error instanceof ConfigError) {
      return error.problem;
    }
    throw error;
  }
}

function expectedTokenVerdict(raw: string): Verdict {
  const token = raw.trim();
  if (token === '') {
    return 'missing-token';
  }
  if (!ACCESS_TOKEN_PATTERN.test(token)) {
    return 'malformed-token';
  }
  return { token, apiUrl: DEFAULT_API_URL };
}

const spaces = fc.stringMatching(/^\s{0,3}$/);
const accessToken = fc.stringMatching(ACCESS_TOKEN_PATTERN);
const tokenCandidate = fc.oneof(
  accessToken,
  accessToken.map((token) => token.slice(0, -1)),
  accessToken.map((token) => `${token}x`),
  accessToken.map((token) => token.toUpperCase()),
  fc.string({ unit: 'grapheme' }).map((tail) => `${TOKEN_PREFIX}${tail}`),
  fc.string({ unit: 'grapheme' }),
);
const tokenValue = fc
  .tuple(spaces, tokenCandidate, spaces)
  .map(([before, token, after]) => `${before}${token}${after}`);
const builtAddress = fc
  .tuple(
    fc.constantFrom('http', 'https', 'ftp', 'ws'),
    fc.constantFrom('localhost', '127.0.0.1', '[::1]', 'api.example.com', 'user@api.example.com'),
    fc.option(fc.integer({ min: 1, max: LARGEST_PORT }), { nil: undefined }),
    fc.constantFrom('', '/', '/v1', '?key=value', '#part'),
  )
  .map(
    ([scheme, host, port, rest]) =>
      `${scheme}://${host}${port === undefined ? '' : `:${String(port)}`}${rest}`,
  );
const addressValue = fc.oneof(
  fc.webUrl({ withQueryParameters: true, withFragments: true }),
  fc.webUrl().map((address) => new URL(address).origin),
  builtAddress,
  fc.string({ unit: 'grapheme' }),
);
const environment: fc.Arbitrary<Environment> = fc
  .tuple(
    fc.dictionary(fc.string(), fc.option(fc.string(), { nil: undefined })),
    fc.option(tokenValue, { nil: undefined }),
    fc.option(addressValue, { nil: undefined }),
  )
  .map(([others, token, address]) => ({
    ...others,
    PYXIS_TOKEN: token,
    PYXIS_API_URL: address,
  }));

describe('readConfig, for any environment', () => {
  it('returns a configuration or fails with a ConfigError, never with another error', () => {
    fc.assert(
      fc.property(environment, (values) => {
        expect(() => verdictOf(values)).not.toThrow();
      }),
      PROPERTY_PARAMETERS,
    );
  });

  it('accepts a token exactly when, without the spaces around it, it matches the pattern', () => {
    fc.assert(
      fc.property(tokenValue, (raw) => {
        expect(verdictOf({ PYXIS_TOKEN: raw })).toEqual(expectedTokenVerdict(raw));
      }),
      PROPERTY_PARAMETERS,
    );
  });

  it('accepts only an https origin or an http one on this machine, and reads it back as it is', () => {
    fc.assert(
      fc.property(addressValue, (address) => {
        const verdict = verdictOf({ PYXIS_TOKEN: TOKEN, PYXIS_API_URL: address });

        if (typeof verdict === 'string') {
          expect(ADDRESS_PROBLEMS).toContain(verdict);
          return;
        }
        expect(verdict.apiUrl).toMatch(ACCEPTED_ORIGIN);
        expect(verdictOf({ PYXIS_TOKEN: TOKEN, PYXIS_API_URL: verdict.apiUrl })).toEqual(verdict);
      }),
      PROPERTY_PARAMETERS,
    );
  });
});

import { describe, expect, it } from 'vitest';
import { ACCESS_TOKEN_PATTERN, ConfigError, DEFAULT_API_URL, readConfig } from './config.js';

const TOKEN = `pyxis_at_${'Ab3'.repeat(10)}xy`;

function problemOf(environment: Record<string, string | undefined>): string {
  try {
    readConfig(environment);
  } catch (error) {
    if (error instanceof ConfigError) {
      return error.problem;
    }
    throw error;
  }
  throw new Error('The configuration was accepted.');
}

describe('readConfig', () => {
  it('reads the token and talks to the hosted Pyxis API by default', () => {
    expect(readConfig({ PYXIS_TOKEN: TOKEN })).toEqual({ token: TOKEN, apiUrl: DEFAULT_API_URL });
  });

  it('ignores spaces around the values, as left by a copied line', () => {
    expect(
      readConfig({ PYXIS_TOKEN: ` ${TOKEN}\n`, PYXIS_API_URL: ' https://api.example.com ' }),
    ).toEqual({ token: TOKEN, apiUrl: 'https://api.example.com' });
  });

  it('treats an empty address like a missing one', () => {
    expect(readConfig({ PYXIS_TOKEN: TOKEN, PYXIS_API_URL: '  ' }).apiUrl).toBe(DEFAULT_API_URL);
  });

  it.each([
    ['https://api.example.com/', 'https://api.example.com'],
    ['https://api.example.com:8443', 'https://api.example.com:8443'],
    ['http://localhost:3040', 'http://localhost:3040'],
    ['http://127.0.0.1:3040/', 'http://127.0.0.1:3040'],
    ['http://[::1]:3040', 'http://[::1]:3040'],
  ])('accepts the API at %s as %s', (address, origin) => {
    expect(readConfig({ PYXIS_TOKEN: TOKEN, PYXIS_API_URL: address }).apiUrl).toBe(origin);
  });

  it.each([
    [{}, 'missing-token'],
    [{ PYXIS_TOKEN: '   ' }, 'missing-token'],
    [{ PYXIS_TOKEN: `pyxis_sk_${'A'.repeat(32)}` }, 'malformed-token'],
    [{ PYXIS_TOKEN: `pyxis_at_${'A'.repeat(31)}` }, 'malformed-token'],
    [{ PYXIS_TOKEN: `Bearer ${TOKEN}` }, 'malformed-token'],
    [{ PYXIS_TOKEN: TOKEN, PYXIS_API_URL: 'api.example.com' }, 'invalid-api-url'],
    [{ PYXIS_TOKEN: TOKEN, PYXIS_API_URL: 'https://api.example.com/v1' }, 'invalid-api-url'],
    [{ PYXIS_TOKEN: TOKEN, PYXIS_API_URL: 'https://api.example.com/?a=1' }, 'invalid-api-url'],
    [{ PYXIS_TOKEN: TOKEN, PYXIS_API_URL: 'https://api.example.com/#top' }, 'invalid-api-url'],
    [{ PYXIS_TOKEN: TOKEN, PYXIS_API_URL: 'https://user@api.example.com' }, 'invalid-api-url'],
    [{ PYXIS_TOKEN: TOKEN, PYXIS_API_URL: 'https://:secret@api.example.com' }, 'invalid-api-url'],
    [{ PYXIS_TOKEN: TOKEN, PYXIS_API_URL: 'ftp://api.example.com' }, 'invalid-api-url'],
    [{ PYXIS_TOKEN: TOKEN, PYXIS_API_URL: 'http://api.example.com' }, 'insecure-api-url'],
  ])('refuses %j with %s', (environment, problem) => {
    expect(problemOf(environment)).toBe(problem);
  });

  it('never repeats the token it refuses in the message', () => {
    const almost = `pyxis_at_${'Z'.repeat(31)}`;

    expect(() => readConfig({ PYXIS_TOKEN: almost })).toThrow(ConfigError);
    expect(() => readConfig({ PYXIS_TOKEN: almost })).not.toThrow(almost);
  });

  it('explains each problem in a sentence that names the variable', () => {
    const messages = [
      {},
      { PYXIS_TOKEN: 'nope' },
      { PYXIS_TOKEN: TOKEN, PYXIS_API_URL: 'nope' },
      { PYXIS_TOKEN: TOKEN, PYXIS_API_URL: 'http://api.example.com' },
    ].map((environment) => {
      try {
        readConfig(environment);
        return '';
      } catch (error) {
        return error instanceof ConfigError ? `${error.name}: ${error.message}` : '';
      }
    });

    expect(messages).toEqual([
      'ConfigError: Set PYXIS_TOKEN to a read-only access token created in the Pyxis dashboard, under Settings, Access tokens.',
      'ConfigError: PYXIS_TOKEN is not a Pyxis access token: it starts with pyxis_at_ followed by 32 letters and digits.',
      'ConfigError: PYXIS_API_URL must be the address of a Pyxis API with no path, such as https://api.pyxis-analytics.dev.',
      'ConfigError: PYXIS_API_URL must use https; plain http is accepted only for localhost.',
    ]);
  });
});

describe('ACCESS_TOKEN_PATTERN', () => {
  it('matches the tokens the dashboard creates and nothing longer', () => {
    expect(ACCESS_TOKEN_PATTERN.test(TOKEN)).toBe(true);
    expect(ACCESS_TOKEN_PATTERN.test(`${TOKEN}0`)).toBe(false);
  });
});

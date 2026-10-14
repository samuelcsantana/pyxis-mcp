import { describe, expect, it } from 'vitest';
import { PACKAGE_VERSION, userAgent, versionOf } from './version.js';

describe('versionOf', () => {
  it('reads the version of a package manifest', () => {
    expect(versionOf({ name: 'pyxis-mcp', version: '1.4.0' })).toBe('1.4.0');
  });

  it.each([[null], ['1.4.0'], [{}], [{ version: 14 }]])(
    'falls back to 0.0.0 for %j',
    (manifest) => {
      expect(versionOf(manifest)).toBe('0.0.0');
    },
  );
});

describe('PACKAGE_VERSION', () => {
  it('is the version of this package', () => {
    expect(PACKAGE_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('userAgent', () => {
  it('names the package and its version', () => {
    expect(userAgent('1.4.0')).toBe('pyxis-mcp/1.4.0');
    expect(userAgent()).toBe(`pyxis-mcp/${PACKAGE_VERSION}`);
  });
});

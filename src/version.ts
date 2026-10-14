import { createRequire } from 'node:module';

const UNKNOWN_VERSION = '0.0.0';
const PACKAGE_NAME = 'pyxis-mcp';

export function versionOf(manifest: unknown): string {
  if (
    typeof manifest === 'object' &&
    manifest !== null &&
    'version' in manifest &&
    typeof manifest.version === 'string'
  ) {
    return manifest.version;
  }
  return UNKNOWN_VERSION;
}

export const PACKAGE_VERSION = versionOf(createRequire(import.meta.url)('../package.json'));

export function userAgent(version: string = PACKAGE_VERSION): string {
  return `${PACKAGE_NAME}/${version}`;
}

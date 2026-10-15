#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ConfigError, readConfig } from './config.js';
import { PyxisApi } from './pyxis-api.js';
import { createServer } from './server.js';
import { PACKAGE_VERSION } from './version.js';

const EXIT_FAILURE = 1;

async function start(): Promise<void> {
  const server = createServer(new PyxisApi(readConfig(process.env)), {
    version: PACKAGE_VERSION,
  });
  await server.connect(new StdioServerTransport());
}

start().catch((error: unknown) => {
  const reason =
    error instanceof ConfigError
      ? error.message
      : `could not start: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`;
  process.stderr.write(`pyxis-mcp: ${reason}\n`);
  process.exitCode = EXIT_FAILURE;
});

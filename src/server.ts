import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { PyxisApi } from './pyxis-api.js';
import {
  PYXIS_TOOLS,
  type PyxisTool,
  type ToolRequest,
  ToolInputError,
  VISITOR_TEXT_NOTE,
} from './tools.js';
import { PACKAGE_VERSION } from './version.js';

export const SERVER_NAME = 'pyxis';

export const INSTALL_GUIDE_URL = 'https://pyxis-analytics.dev/llms.txt';

export const SERVER_INSTRUCTIONS =
  "Pyxis is privacy-first product analytics: visits, page views, named events and the site's requests to its backend, with no cookies and no personal data. Start with list_projects for the project ids and each project's today, then ask for a range of dates. Every tool only reads. " +
  'An empty list means no project was created yet, or none was shared with this person: projects are created in the Pyxis dashboard. ' +
  `A project whose first_event_at is null has received nothing, so its site does not run the tracker yet. No tool here can install it: the site's developers add the npm package pyxis-analytics, started with one of the public keys project_settings lists, as the install guide at ${INSTALL_GUIDE_URL} documents.`;

export const UNEXPECTED_ANSWER =
  'The Pyxis API answered in a shape this server does not recognize. Update pyxis-mcp, or report it at https://github.com/samuelcsantana/pyxis-mcp/issues.';

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export interface ServerOptions {
  readonly version?: string;
  readonly now?: () => Date;
}

function failure(problem: string): CallToolResult {
  return { content: [{ type: 'text', text: problem }], isError: true };
}

function success(report: unknown): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ untrusted_visitor_text: VISITOR_TEXT_NOTE, report }),
      },
    ],
  };
}

function requestOf(tool: PyxisTool, args: unknown): ToolRequest | string {
  try {
    return tool.request(args);
  } catch (error) {
    if (error instanceof ToolInputError) {
      return error.message;
    }
    throw error;
  }
}

export async function runTool(
  tool: PyxisTool,
  api: PyxisApi,
  args: unknown,
  now: Date,
): Promise<CallToolResult> {
  const request = requestOf(tool, args);
  if (typeof request === 'string') {
    return failure(request);
  }
  const outcome = await api.get(request.path, request.query);
  if (!outcome.ok) {
    return failure(outcome.problem);
  }
  const report = tool.report(outcome.body, now);
  return report === undefined ? failure(UNEXPECTED_ANSWER) : success(report);
}

export function createServer(api: PyxisApi, options: ServerOptions = {}): McpServer {
  const now = options.now ?? (() => new Date());
  const server = new McpServer(
    { name: SERVER_NAME, version: options.version ?? PACKAGE_VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  );
  for (const tool of PYXIS_TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: { ...READ_ONLY, title: tool.title },
      },
      (args) => runTool(tool, api, args, now()),
    );
  }
  return server;
}

import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { PyxisApi } from './pyxis-api.js';
import { createServer, type ServerOptions } from './server.js';

export const MAX_REQUEST_BYTES = 64 * 1024;
export const ALLOWED_METHOD = 'POST';

export const HTTP_REFUSALS = {
  method: 'Method not allowed: this server keeps no session and answers POST only.',
  origin: 'Forbidden: this server does not answer requests sent by a web page.',
} as const;

const STATUS_FORBIDDEN = 403;
const STATUS_METHOD_NOT_ALLOWED = 405;
const JSON_RPC_SERVER_ERROR = -32000;
const JSON_MEDIA_TYPE = 'application/json';

export interface HttpOptions extends ServerOptions {
  readonly allowedOrigins?: readonly string[];
}

function refusal(status: number, message: string, headers: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      error: { code: JSON_RPC_SERVER_ERROR, message },
      id: null,
    }),
    { status, headers: { 'content-type': JSON_MEDIA_TYPE, ...headers } },
  );
}

function comesFromForeignPage(request: Request, allowedOrigins: readonly string[]): boolean {
  const origin = request.headers.get('origin');
  return origin !== null && !allowedOrigins.includes(origin);
}

export async function handleHttpRequest(
  request: Request,
  api: PyxisApi,
  options: HttpOptions = {},
): Promise<Response> {
  if (request.method !== ALLOWED_METHOD) {
    return refusal(STATUS_METHOD_NOT_ALLOWED, HTTP_REFUSALS.method, { allow: ALLOWED_METHOD });
  }
  if (comesFromForeignPage(request, options.allowedOrigins ?? [])) {
    return refusal(STATUS_FORBIDDEN, HTTP_REFUSALS.origin);
  }
  const server = createServer(api, options);
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
    maxRequestBodySize: MAX_REQUEST_BYTES,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await server.close();
  }
}

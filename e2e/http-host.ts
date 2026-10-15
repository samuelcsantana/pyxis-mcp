import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { handleHttpRequest, PyxisApi } from 'pyxis-mcp';

const BEARER_PREFIX = 'Bearer ';
const STATUS_UNAUTHORIZED = 401;
const STATUS_INTERNAL_ERROR = 500;
const METHODS_WITHOUT_BODY: ReadonlySet<string> = new Set(['GET', 'HEAD']);
const PROBLEM_TEXTS = {
  refusedToken:
    'The access token was refused: it may be revoked or expired. Create a new one in the Pyxis dashboard.',
  unreachableAdvice: 'Try again in a moment.',
};
const apiUrl = process.env.PYXIS_API_URL ?? '';

async function bodyOf(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function webRequest(request: IncomingMessage): Promise<Request> {
  const method = request.method ?? 'GET';
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (typeof value === 'string') {
      headers.set(name, value);
    }
  }
  return new Request(new URL(request.url ?? '/', 'http://127.0.0.1'), {
    method,
    headers,
    ...(METHODS_WITHOUT_BODY.has(method) ? {} : { body: await bodyOf(request) }),
  });
}

async function answer(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const authorization = request.headers.authorization ?? '';
  if (!authorization.startsWith(BEARER_PREFIX)) {
    response.writeHead(STATUS_UNAUTHORIZED, { 'www-authenticate': 'Bearer' }).end();
    return;
  }
  const api = new PyxisApi({
    token: authorization.slice(BEARER_PREFIX.length),
    apiUrl,
    problemTexts: PROBLEM_TEXTS,
  });
  const answered = await handleHttpRequest(await webRequest(request), api);
  response.writeHead(answered.status, Object.fromEntries(answered.headers));
  response.end(await answered.text());
}

const server = createServer((request, response) => {
  answer(request, response).catch(() => {
    response.writeHead(STATUS_INTERNAL_ERROR).end();
  });
});

server.listen(0, '127.0.0.1', () => {
  process.stdout.write(`listening ${String((server.address() as AddressInfo).port)}\n`);
});

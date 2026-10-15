import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

export const TOKEN = `pyxis_at_${'E'.repeat(32)}`;
export const PROJECT = '2b2b2b2b-0000-4000-8000-000000000002';
export const ME = {
  email: 'owner@example.com',
  projects: [
    {
      id: PROJECT,
      name: 'Shop',
      timezone: 'UTC',
      conversion_event: 'signup_completed',
      first_event_at: '2026-09-01T10:00:00.000Z',
      last_event_at: '2026-10-14T10:00:00.000Z',
      icon_version: null,
    },
  ],
};

export interface SeenRequest {
  readonly url: string;
  readonly authorization: string | undefined;
  readonly userAgent: string | undefined;
}

export interface FakeApi {
  readonly url: string;
  readonly seen: SeenRequest[];
  close(): Promise<void>;
}

function answer(seen: SeenRequest[], request: IncomingMessage, response: ServerResponse): void {
  seen.push({
    url: request.url ?? '',
    authorization: request.headers.authorization,
    userAgent: request.headers['user-agent'],
  });
  const send = (status: number, body: unknown) => {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  };
  if (request.headers.authorization !== `Bearer ${TOKEN}`) {
    send(401, { status_code: 401, error: 'unauthenticated', message: 'Sign in to continue.' });
    return;
  }
  if (request.url === '/v1/me') {
    send(200, ME);
    return;
  }
  if (request.url?.startsWith(`/v1/projects/${PROJECT}/overview?`) === true) {
    send(200, { visits: { current: 12, previous: 9 } });
    return;
  }
  send(404, { status_code: 404, error: 'not_found', message: 'Not found.' });
}

export async function startFakeApi(): Promise<FakeApi> {
  const seen: SeenRequest[] = [];
  const server = createServer((request, response) => {
    answer(seen, request, response);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    url: `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`,
    seen,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
  };
}

export function environment(overrides: Record<string, string>): Record<string, string> {
  const inherited = Object.fromEntries(
    ['PATH', 'SystemRoot', 'HOME', 'USERPROFILE', 'TEMP', 'TMP']
      .map((name) => [name, process.env[name]])
      .filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  return { ...inherited, ...overrides };
}

export function textOf(result: Awaited<ReturnType<Client['callTool']>>): string {
  const [first] = result.content as { type: string; text: string }[];
  return first?.text ?? '';
}

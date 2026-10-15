# 3. A stateless HTTP handler that a host runs with the caller's token

Date: 2026-10-15

## Status

Accepted. Extends [ADR 0002](0002-local-read-only-server.md), which left remote clients for a
separate decision.

## Context

The local server reaches the clients that start a program on the user's machine. Clients that only
accept remote servers, such as the connectors of the Claude apps, need an MCP endpoint at a URL,
signed in with OAuth.

The MCP authorization specification forbids a server from passing on to another service the token
it received from the client. A separate remote server that forwarded the caller's token to the
Pyxis API would do exactly that. The endpoint has to live in the service that issues the token and
reads the data, so that the token's audience and the data's owner are the same server. That service
should not keep a second copy of the fifteen tools.

## Decision

- **The package is also a library.** Its entry point exports three things: `createServer` (the MCP
  server with the tools), `handleHttpRequest` (one HTTP exchange) and `PyxisApi` (the client the
  tools read through). The `pyxis-mcp` executable does not change. The `exports` map keeps every
  other module private.
- **Streamable HTTP without state.** `handleHttpRequest` takes a web `Request` and answers a web
  `Response`. Each request gets a new server and a new transport, closed once it is answered: no
  session id, no event stream, JSON answers only. That is what a function that answers once, such
  as AWS Lambda, can serve.
- **The transport's rules come before the SDK.** Any method but `POST` is `405` with `Allow: POST`.
  A request with an `Origin` header is `403` unless the host lists that origin, the transport's
  defence against DNS rebinding: an MCP client calls from a server or a program, not from a web
  page. A body over 64 KiB is `413` before it is parsed.
- **The host authenticates.** It decides who the caller is, answers `401` with its own
  `WWW-Authenticate` when it cannot tell, applies its rate limits and checks its host name. Then it
  builds a `PyxisApi` with the caller's token and, if it wants, a `fetch` that answers inside its
  own process, so the token never travels anywhere else.
- **Two sentences are the host's to choose.** A refused token and an API that does not answer are
  explained in words that name the local configuration (`PYXIS_TOKEN`, `PYXIS_API_URL`). A host
  passes `problemTexts` with words that fit its users, such as connecting again.

## Consequences

- One source of truth for the tools: a host serves a new tool by upgrading this package.
- The exported functions and their options follow SemVer: changing them is a major version.
- A host depends on this package and on the official MCP SDK at run time, and its dependency audit
  covers theirs.
- A new read route of the API reaches remote clients only after a release of this package and an
  upgrade in the host. The daily contract check says when the two differ.
- Without a session the server cannot push notifications or stream progress. None of the tools
  needs either: each one is a single read.

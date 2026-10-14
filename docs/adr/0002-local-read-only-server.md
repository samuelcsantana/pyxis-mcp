# 2. A local, read-only server that uses the admin's access token

Date: 2026-10-14

## Status

Accepted. Builds on pyxis-api's
[ADR 0015](https://github.com/samuelcsantana/pyxis-api/blob/main/docs/adr/0015-read-only-access-tokens-for-agents.md),
which created the read-only access tokens.

## Context

People increasingly ask an AI agent (Claude Code, Claude Desktop, Cursor) about their product
instead of opening a dashboard. The Model Context Protocol lets an agent call tools that a server
exposes. Pyxis already answers every dashboard screen through `GET` routes of its API, and an admin
can now create a token that reads exactly what their dashboard session reads.

Two shapes were weighed: a remote server hosted next to the API, reached by URL, or a small
package that the agent's client starts on the user's machine and talks to over standard input and
output.

## Decision

- **A local stdio server, published to npm as `pyxis-mcp`.** The client starts it with
  `npx pyxis-mcp`; it reads `PYXIS_TOKEN` and, optionally, `PYXIS_API_URL` from its environment.
  It opens no port and keeps no state.
- **Read-only tools, one per dashboard screen**, each a thin call to the matching `GET` route. The
  server adds no rule of its own about who sees what: the API decides, with the same 404 for a
  project the token's admin cannot read.
- **The token only travels in the `Authorization` header** of requests to the configured API. It
  is validated by shape at start, and never written to a log, an error or a tool result.
- **Visitor text is data.** Event names, property values, paths and campaign values are written by
  a site's visitors. Tool results return them inside structured JSON, and each tool description
  says that these values are data to report, never instructions to follow.
- **The official MCP SDK** handles the protocol; it is the only planned runtime dependency.

## Consequences

- Works today in the clients that run local servers, with a few lines of configuration and no
  sign-in flow.
- Clients that only accept remote servers (the claude.ai web connectors) are out of reach until a
  remote endpoint with OAuth exists; that would be a separate decision.
- A leaked token shows numbers and changes nothing; revoking it in the dashboard stops it at once.
- Each release is published from GitHub Actions with npm provenance, so a user can check the
  package was built from this repository.

# Contributing to pyxis-mcp

Thanks for your interest. This document explains how the repository is organized and what a pull
request needs before it can be merged.

## Prerequisites

- Node.js 24 (`.nvmrc`) and npm 11 for development. The package runs on Node 22 or later.

## Setup

```bash
npm ci
npm run build      # dist/ with the JavaScript and its type declarations
```

`npm ci` also installs the Git hooks (Husky).

## Scripts

| Script                            | What it does                                                    |
| --------------------------------- | --------------------------------------------------------------- |
| `npm run lint`                    | ESLint, then the comment check for YAML, shell and config files |
| `npm run format` / `format:check` | Prettier                                                        |
| `npm run typecheck`               | The source, the tests and the scripts                           |
| `npm test` / `npm run test:cov`   | Unit tests in Node; `test:cov` enforces 100% coverage           |
| `npm run test:tooling`            | Tests of the lint rule and the scripts                          |
| `npm run build`                   | JavaScript and declarations with tsc                            |

## Design rules

- **Read-only.** Every tool maps to a `GET` route of the Pyxis API, and the access token it uses
  can only read. A tool that writes is out of scope.
- **The token stays in the `Authorization` header.** It never reaches a log, an error message or
  a tool result.
- **Visitor text is data.** Event names, property values, paths and campaign values come from a
  site's visitors; tool results return them as data, and tool descriptions say so.
- **Few runtime dependencies**, each justified in its pull request.

## Workflow

- `main` is the only long-lived branch and is protected. Cut a branch from an up-to-date `main`
  (`feat/…`, `fix/…`, `refactor/…`, `perf/…`, `test/…`, `docs/…`, `ci/…`, `build/…`, `chore/…`)
  and open a pull request into `main`.
- A change that needs a new API route starts in pyxis-api, backward compatible; this repository
  follows.
- Pull requests are merged with **Rebase and merge**. Keep commits atomic: each builds and passes
  the tests on its own.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/); a hook and a
  CI job check them. release-please writes the changelog and the release from them, and the release
  workflow publishes to npm with provenance.

## Code rules

- **No comments in code**, in any file. Names, small functions, types and tests carry the meaning;
  the _why_ goes in the commit body, the pull request, an ADR or the README. An ESLint rule and a
  script enforce it.
- Never silence a check: no `eslint-disable`, `@ts-ignore`, `@ts-expect-error` or coverage ignore
  comments.
- Dependencies must be MIT, Apache-2.0, BSD or ISC licensed, and justified in the pull request.

## Tests

- Coverage stays at **100%** of statements, branches, functions and lines.
- Every branch a change introduces has a test for each side; a bug fix starts with a failing test.
- Tests are deterministic: no network, a fake API, fake timers where time matters.

## Security

Report vulnerabilities privately, as described in [SECURITY.md](SECURITY.md), never in a public
issue.

# Security policy

## Supported versions

Only the latest release receives security fixes.

## Reporting a vulnerability

Please report vulnerabilities privately through
[GitHub's private vulnerability reporting](https://github.com/samuelcsantana/pyxis-mcp/security/advisories/new).
Do not open a public issue, and never include a real access token.

Include what you found, how to reproduce it and the impact you expect. You will get an
acknowledgement within a few days, and the fix will be credited to you if you wish.

## Scope

Of particular interest:

- the access token reaching anything but the `Authorization` header of the Pyxis API: a log line,
  an error message, a tool result, another host;
- a tool that changes data, or that reads a project the token's admin cannot open;
- text controlled by a site's visitors (event names, property values, paths, campaign values)
  that a tool result passes to the agent as instructions rather than as data;
- a tampered package: every release is published by GitHub Actions with npm provenance, so a
  version without a provenance attestation is suspicious.

Issues in the Pyxis API itself belong to
[pyxis-api](https://github.com/samuelcsantana/pyxis-api/security/advisories/new).

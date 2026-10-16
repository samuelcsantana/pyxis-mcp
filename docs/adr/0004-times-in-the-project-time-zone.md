# 4. Times in the project time zone, rewritten in place

Date: 2026-10-16

## Status

Accepted.

## Context

The Pyxis API answers with UTC instants (`2026-10-14T01:41:41.638Z`) and, in the answers that list
times, names the project's IANA time zone in a `timezone` field. The dashboard shows every time in
that zone. The tools passed the API's answers through, so an agent read UTC: a visit at 22:41 in
São Paulo came out as 01:41 the next day, and a report built from it put the visit on the wrong
day and at the wrong hour. Dates and hours that the API groups (daily series, the weekday and hour
grid) are already in the project zone; only the instants are not.

Two shapes were weighed: a parallel field for each instant (`started_at_local`), or the same field
written in the project zone with its offset.

## Decision

- **Each instant is rewritten in place**, in the zone the answer names, with the offset of that
  instant: `2026-10-13T22:41:41.638-03:00`. One field, no choice for the agent to get wrong, still
  ISO 8601, and still the same moment as the API's value.
- **The offset is computed per instant**, from the zone's rules (`Intl.DateTimeFormat` with
  `longOffset`), never fixed per answer: a range that crosses a change to or from daylight saving
  time shows both offsets.
- **Each tool lists the paths of its instants** (`visits[].started_at`). Only those change. A
  generic search for strings that look like instants would also rewrite values the site's visitors
  sent in event properties, which must reach the agent as they were sent. Opaque cursors such as
  `next_cursor` stay as the API wrote them.
- **The contract test keeps the lists honest:** for every tool, the fields with `format: date-time`
  in the answer the API declares must be exactly the listed paths, and an answer with listed
  instants must declare a required `timezone`.
- **What the agent sends back is normalized to UTC.** The timeline cursor `before` accepts any
  offset, so the `next_before` an agent received in local time works as the next page's cursor,
  and the API, which reads only the `Z` form, gets the same instant in UTC.
- **An answer without `timezone`** (an API older than the field) passes unchanged, in UTC, which
  its `Z` suffix states.

## Consequences

- Agents report local times without converting anything, and match what the dashboard shows.
- A new instant field in the API fails the daily contract check until a tool lists it, instead of
  reaching agents in UTC under a description that says local time.
- Times are no longer byte-for-byte the API's. A client that needs UTC converts the offset form,
  which every ISO 8601 parser reads.

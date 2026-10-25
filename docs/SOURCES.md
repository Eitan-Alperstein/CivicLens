# CivicLens Data Sources

Last updated: 2026-10-20

## Overview

`ingest/ingest.py` runs locally, pulls records from each source, converts them into one record format, and writes a snapshot to `data/records.json`. The website searches that file; it never calls a government server directly.

| Source | Covers | Level | Key | Status in code |
| --- | --- | --- | --- | --- |
| [Legistar Web API](https://webapi.legistar.com/Help) | Denver City Council matters | city | None | Implemented: `fetch_legistar`, `normalize_legistar` |
| [OpenStates API v3](https://v3.openstates.org/docs) | Colorado General Assembly bills | state | `OPENSTATES_API_KEY` in `.env` | Implemented: `fetch_openstates`, `normalize_openstates` (being debugged) |
| [Federal Register API](https://www.federalregister.gov/developers/documentation/api/v1) | Federal rules and notices | federal | None | Not in code; optional |

Shared plumbing: `ingest/http_utils.py` (`get_json`: 0.3 s polite delay, 3 retries with backoff, custom User-Agent, optional extra headers) and `ingest/clean.py` (`split_legistar_title`, `collapse_whitespace`, `truncate`).

## Denver Legistar Web API

One request pulls the 500 most recent Denver City Council matters; no key needed.

| Item | Value |
| --- | --- |
| Endpoint | `https://webapi.legistar.com/v1/denver/matters` |
| Query | `$top=500`, `$orderby=MatterIntroDate desc`, `$filter=MatterIntroDate lt datetime'<today>'` (OData) |
| Record link | `https://denver.legistar.com/gateway.aspx?M=L&ID={MatterId}` |
| Record id | `legistar-denver:{MatterId}` |

Quirks:

- The API holds fake test records dated 2030 ("This is a test vote"); the date filter drops them.
- The website's `LegislationDetail.aspx` uses different ids than the API, so links go through the `gateway.aspx` redirect.
- The description lives inside `MatterTitle` after a line break; `split_legistar_title` separates it. The per-matter `/texts` endpoint returns only a blank staff form, so it is skipped.
- `MatterBodyName` is usually a committee (e.g. "Transportation and Infrastructure"), stored as `committee`; `agency` is always "Denver City Council".

## OpenStates API v3

Colorado's 2026A session has 714 bills, fetched in 36 pages of 20.

| Item | Value |
| --- | --- |
| Endpoint | `https://v3.openstates.org/bills` |
| Auth | `X-API-KEY` header, from `OPENSTATES_API_KEY` in `.env` (via `python-dotenv`) |
| Query | `jurisdiction=Colorado`, `session=2026A`, `sort=updated_desc`, `per_page=20`, `page=N`, `include=abstracts`, `include=sources` |
| Record link | First entry of `sources` (official `leg.colorado.gov/bills/...` page), else `openstates_url` |
| Record id | `openstates:{id}` (e.g. `openstates:ocd-bill/2780c49b-...`) |

Notes:

- `per_page` above 20 returns HTTP 400, so the fetch paginates until `pagination.max_page`.
- `abstracts` carries the legislature's own plain-English summary, used as the excerpt.
- `subject` tags (e.g. "State Government") fill `keywords`.
- No rate-limit headers are returned; the free tier has a daily cap, so keep runs to tens of requests.

## AI layer (not a data source)

**Ollama** answers the user's question by connecting the retrieved records to each other and to the question, citing the records it used. It runs at question time, not during ingestion. Hosting for the public deployment is still being decided.

## Not data sources

GitHub (repo), static hosting (GitHub Pages or Vercel, undecided), and Claude Code (development assistant, logged in `DEVLOG.md`).

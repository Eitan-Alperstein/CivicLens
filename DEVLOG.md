# DEVLOG
## AI Use Policy Tracker

10/18/26 -- Eitan: initialized git; created `data/` `ingest/` `web/`. Added OpenStates API Key to `.env`, created `.gitignore` to make sure no secrets are leaked. Created `DEVLOG.md`.

10/18/26 -- AI (Claude Code, Claude Opus 5.5):
- Planning: proposed the MVP plan (Python ingestion -> `data/records.json` -> static vanilla JS site; Ollama summaries precomputed offline). Human chose the scope (deep Colorado, shallow federal; real parsed data instead of 8-15 hand-curated records) and approved the plan.
- Research: confirmed Denver's Legistar Web API works without a key, and that it contains fake test records dated 2030 that must be filtered out. Found that the API's MatterId doesn't work in Denver's website URLs, but `https://denver.legistar.com/gateway.aspx?M=L&ID={MatterId}` redirects to the correct page. Found that Denver stores each item's description inside `MatterTitle` after a line break, and that the per-matter "text" endpoint only returns a blank staff form, so we skip it.
- Setup: created `.venv/` with `requests` and `python-dotenv`, wrote `requirements.txt`, fixed `.gitignore` (missing newline, added `.venv/`).
- Code written: `ingest/http_utils.py` (`get_json`: polite delay + retries) and `ingest/clean.py` (`split_legistar_title`, `collapse_whitespace`, `truncate`). Wrote `ingest/ingest.py` as a skeleton only: schema comment, constants, and pseudocode stubs for `fetch_legistar`, `normalize_legistar`, `main`, which the human developer implements.

10/18/26 -- Eitan: implemented functions `fetch_legistar` (fetches raw data from Legistar API), `normalize_legistar` (turns data into the format that Claude and I decided on), and `main` (runs the one-time ingest function). We now have 500 entries in `data/records.json`.

10/20/26 -- AI (Claude Code, Claude Opus 5.5): tested the OpenStates v3 API with our key (max 20 bills per request, so pagination is needed; 714 bills in the 2026A session; `include=abstracts,sources` gives official summaries, subject tags, and leg.colorado.gov links). Added an optional `headers` argument to `get_json` in `ingest/http_utils.py` for the API key. Wrote pseudocode stubs for `fetch_openstates`, `normalize_openstates`, the OpenStates setup lines, and the `main()` merge in `ingest/ingest.py`, for the human developer to implement.

10/20/26 -- Eitan: added necessary imports (os, dotenv I think). Wrote `fetch_openstates()`, `normalize_openstates()` and updated `main()` to include both APIs. 
10/20/26 -- AI (Claude Code, Claude Opus 5.5): wrote `docs/SOURCES.md` (every data source, endpoint, auth, quirks, and status in code), based on a sources doc drafted earlier in the session and updated for the current code. Reviewed the human developer's OpenStates code and reported bugs; fixes left to the human developer.

10/25/26 -- Eitan: fixed `normalize_openstates()` and `main()`. Ran ingest unsuccessfully.

10/25/26 -- AI (Claude Code, Claude Opus 5.5): diagnosed the ingest crash as OpenStates' free-tier rate limit (HTTP 429, "exceeded limit of 10/min"). Changed `get_json` in `ingest/http_utils.py` to wait 60 seconds after a 429 before retrying.

10/25/26-13:37 -- Eitan: added rate limiting to `fetch_openstates()` (6.5 seconds between requests I believe) due to crash. Created `web/index.html`, `web/app.js`, `style.css`.

10/25/26 -- AI (Claude Code, Claude Opus 5.5): wrote `web/style.css` (layout, colors, hero and search styling, AI overview panel with a loading state and citation chips, result cards with city/state badges, mobile layout) against the class names the human developer used in `index.html`. Checked `data/records.json` for duplicates: none (1214 records, 1214 unique ids).

10/25/26 -- AI (Claude Code, Claude Opus 5.5): at the human developer's request, wrote the result-ranking lines at the end of `score()` in `web/app.js` (pairing each record with its score as `{record, score}`, then filter > 0, sort by score with newest-first tie-break, top 20). The scoring logic, `keywordize`, and data loading are the human developer's.

10/25/26-14:49 -- Eitan: implemented all of the functions in app.js except for `render()` and the sorting part in `score()`

10/25/26 -- AI (Claude Code, Claude Opus 5.5): at the human developer's request, wrote `render()` and a `formatDate()` helper in `web/app.js` (cards built with createElement/textContent so record text can't inject HTML; card ids `card-1`... for AI citations; results count; empty state). Redesigned `web/style.css` (serif/sans fonts, navy hero with a Front Range mountain silhouette, pill search bar, AI overview card, city/state color stripes, fade-in animation, mobile layout). Checked the result in headless Chrome screenshots: desktop results, empty state.

10/25/26-14:57 -- Eitan: made sample question chips work.


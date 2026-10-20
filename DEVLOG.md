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

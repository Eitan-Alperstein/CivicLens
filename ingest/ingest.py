"""CivicLens ingestion: fetch public records -> normalize -> data/records.json

Run from the repo root:  .venv/bin/python ingest/ingest.py
"""

import json
from datetime import date
from pathlib import Path

from clean import split_legistar_title, truncate
from http_utils import get_json

LEGISTAR_API = "https://webapi.legistar.com/v1/denver"
LEGISTAR_LINK = "https://denver.legistar.com/gateway.aspx?M=L&ID={id}"
# PSEUDOCODE (OpenStates setup):
# OPENSTATES_API = "https://v3.openstates.org/bills"
# add imports: os, and `from dotenv import load_dotenv`; call load_dotenv() once, up here
#   (load_dotenv() searches upward from this file's folder, so it finds the repo-root .env)
# add collapse_whitespace to the `from clean import ...` line
OUTPUT = Path(__file__).resolve().parent.parent / "data" / "records.json"

# Normalized record (every source gets converted to this):
#   id          "legistar-denver:57690"   source prefix + native id
#   title       str
#   date        "YYYY-MM-DD"              agenda date, else intro date
#   agency      "Denver City Council"
#   level       "city" | "state" | "federal"
#   type        "Resolution", "Bill", ...
#   status      "Passed", "Agenda Ready", ...
#   source_url  official page link
#   excerpt     description text, <=300 chars, may be ""
#   summary     filled by the Ollama pass later ("" for now)
#   keywords    filled by the Ollama pass later ([] for now)
#   committee   specific council, eg. "Transportation Department"


def fetch_legistar(n):
    today = date.today().isoformat()

    # paramters:
    #   $top     = n <- as in like "top 100 results"
    #   $orderby = "MatterIntroDate desc" <- ord. descending
    #   $filter  = "MatterIntroDate lt datetime'<today>'"   <- drops the fake 2030 test rows

    params = {"$top": n, "$orderby": "MatterIntroDate desc", "$filter": f"MatterIntroDate lt datetime'{today}'"}
    return get_json(f"{LEGISTAR_API}/matters", params)


def normalize_legistar(m):
    title, description = split_legistar_title(m["MatterTitle"])

    # pick date: m["MatterAgendaDate"] if present else m["MatterIntroDate"]
    #            keep only the first 10 chars ("2026-10-19T00:00:00" -> "2026-10-19")

    # here i learned that python does not have ternary syntax
    matterDate = m["MatterAgendaDate"] or m["MatterIntroDate"]
    matterDate = matterDate[:10]

    excerpt = truncate(description)
    source_url = LEGISTAR_LINK.format(id=m["MatterId"])

    # return a dict with the fields listed at the top of this file
    # #turnsoutthereisternaryinpython #imstupid
    return {
            "id": f"legistar-denver:{m['MatterId']}",
            "title": title,
            "date": matterDate,
            "committee": m["MatterBodyName"] if m["MatterBodyName"] != "City Council" else "",
            "agency": "Denver City Council",
            "level": "city",
            "type": m["MatterTypeName"],
            "status": m["MatterStatusName"],
            "source_url": source_url,
            "excerpt": excerpt,
            "summary": "",
            "keywords": []
        }


def fetch_openstates():
    # PSEUDOCODE
    # key = os.getenv("OPENSTATES_API_KEY")
    # if not key: raise SystemExit("OPENSTATES_API_KEY missing from .env")   <- clear error instead of a 401
    #
    # all_bills = []
    # page = 1
    # loop:
    #     params = {
    #         "jurisdiction": "Colorado",
    #         "session":      "2026A",                    <- 714 bills total = 36 pages
    #         "sort":         "updated_desc",
    #         "per_page":     20,                         <- API max; 21+ returns HTTP 400
    #         "page":         page,
    #         "include":      ["abstracts", "sources"],   <- a list; requests sends include=...&include=...
    #     }
    #     data = get_json(OPENSTATES_API, params, headers={"X-API-KEY": key})
    #     all_bills += data["results"]
    #     print progress, e.g. f"  page {page}/{data['pagination']['max_page']}"
    #     if page >= data["pagination"]["max_page"]: stop
    #     page += 1
    # return all_bills
    raise NotImplementedError


def normalize_openstates(b):
    # PSEUDOCODE
    # Raw bill looks like (trimmed):
    #   {"id": "ocd-bill/2780c49b-...", "identifier": "SB 59", "session": "2026A",
    #    "title": "Multiple Elected Offices Prohibited for General Assembly",
    #    "from_organization": {"name": "Senate", ...},
    #    "subject": ["Elections & Redistricting", "State Government"],
    #    "latest_action_date": "2026-05-04", "latest_action_description": "Governor Signed",
    #    "abstracts": [{"abstract": "Beginning with the first regular session ...", "note": "summary"}],
    #    "sources": [{"url": "https://leg.colorado.gov/bills/SB26-059", "note": ""}],
    #    "openstates_url": "https://openstates.org/co/bills/2026A/SB59/"}
    #
    # abstract   = first abstract's "abstract" text, or "" if the list is empty
    # source_url = first source's "url" (official leg.colorado.gov page),
    #              falling back to b["openstates_url"] if there are no sources
    # return {
    #     id         "openstates:" + b["id"]
    #     title      f"{identifier}: {title}"          e.g. "SB 59: Multiple Elected Offices ..."
    #     date       b["latest_action_date"][:10]      (already YYYY-MM-DD, slice is just a safety net)
    #     committee  from_organization name ("Senate" / "House")
    #     agency     "Colorado General Assembly"
    #     level      "state"
    #     type       "Bill"
    #     status     b["latest_action_description"]
    #     source_url source_url
    #     excerpt    truncate(collapse_whitespace(abstract))   <- abstracts can have odd spacing
    #     summary    ""
    #     keywords   b["subject"]                      <- free keywords from the legislature
    # }
    raise NotImplementedError


def main():
    n = 500

    # PSEUDOCODE
    matters = fetch_legistar(n)
    records = [normalize_legistar(m) for m in matters]

    OUTPUT.parent.mkdir(exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as f:

        # write records to OUTPUT as JSON (indent=2, ensure_ascii=False so ’ stays readable)
        # print how many records were written

        json.dump(records, f, indent=2, ensure_ascii=False)
        print(f"Wrote {len(records)} records to data/records.json")

    # PSEUDOCODE (OpenStates update):
    # legistar = [normalize_legistar(m) for m in fetch_legistar(500)]
    # state    = [normalize_openstates(b) for b in fetch_openstates()]
    # records  = legistar + state
    # ...then write exactly as above; print the count per source so you can see both worked


if __name__ == "__main__":
    main()

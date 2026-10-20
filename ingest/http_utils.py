"""Small HTTP helper shared by every source fetcher."""

import time

import requests

# Government APIs are free and unauthenticated (or lightly keyed); be polite.
REQUEST_DELAY = 0.3   # seconds to wait before every request
MAX_RETRIES = 3
TIMEOUT = 20          # seconds

HEADERS = {"User-Agent": "CivicLens/0.1 (Congressional App Challenge student project)"}


def get_json(url, params=None, headers=None):
    """GET a URL and return the parsed JSON.

    `headers` are added on top of the default User-Agent (e.g. an API key).
    Retries on network errors and 5xx/429 responses, waiting longer each time
    (0.3s, 0.6s, 1.2s...). Raises on 4xx, since retrying a bad request won't fix it.
    """
    all_headers = {**HEADERS, **(headers or {})}
    for attempt in range(MAX_RETRIES):
        time.sleep(REQUEST_DELAY * (2 ** attempt))
        try:
            resp = requests.get(url, params=params, headers=all_headers, timeout=TIMEOUT)
        except requests.RequestException as err:
            print(f"  network error ({err}); retry {attempt + 1}/{MAX_RETRIES}")
            continue

        if resp.status_code == 429 or resp.status_code >= 500:
            print(f"  HTTP {resp.status_code}; retry {attempt + 1}/{MAX_RETRIES}")
            continue

        resp.raise_for_status()
        return resp.json()

    raise RuntimeError(f"Gave up on {url} after {MAX_RETRIES} attempts")

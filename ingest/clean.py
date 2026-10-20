"""Text cleanup for raw government text."""

import re


def split_legistar_title(raw_title):
    """Denver packs title + description into MatterTitle, separated by a line break.

    "A resolution authorizing ... Case No. 2025CV34006.\\r\\nSettles a claim involving the Denver Police Department. ..."
      -> ("A resolution authorizing ... Case No. 2025CV34006.", "Settles a claim involving ...")

    Returns (title, description); description is "" when there's no second part.
    """
    parts = re.split(r"\r?\n", raw_title.strip(), maxsplit=1)
    title = collapse_whitespace(parts[0])
    description = collapse_whitespace(parts[1]) if len(parts) > 1 else ""
    return title, description


def collapse_whitespace(text):
    return re.sub(r"\s+", " ", text).strip()


def truncate(text, limit=300):
    """Cut at a word boundary and add an ellipsis if text is longer than limit."""
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0] + "…"

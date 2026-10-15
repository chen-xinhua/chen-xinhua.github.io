"""Refresh the public total-visit snapshot without exposing private visit records."""

import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "site" / "data" / "visits.json"
REQUEST = Request(
    "https://xinhua-visitor-tracker.pages.dev/total",
    headers={"Origin": "https://chen-xinhua.github.io"},
)

try:
    with urlopen(REQUEST, timeout=10) as response:
        total = json.load(response)["total"]
    if type(total) is not int or total < 0:
        raise ValueError("Invalid visit total")
    SNAPSHOT.write_text(
        json.dumps({"total": total, "updatedAt": datetime.now(timezone.utc).isoformat()}) + "\n",
        encoding="utf-8",
    )
    print(f"Updated visit snapshot: {total}")
except HTTPError as error:
    detail = error.read(300).decode("utf-8", errors="replace").replace("\n", " ")
    print(f"Keeping previous visit snapshot: HTTP {error.code}, {detail}")
except Exception as error:
    print(f"Keeping previous visit snapshot: {error}")

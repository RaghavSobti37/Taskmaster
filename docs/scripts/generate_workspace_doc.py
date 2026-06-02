"""Write plain-text workspaces + projects list from local API."""

import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "workspaces_projects.txt"
URL = "http://127.0.0.1:5000/api/projects/workspaces-plain.txt"


def build():
    with urllib.request.urlopen(URL, timeout=15) as res:
        text = res.read().decode("utf-8")
    OUT.write_text(text, encoding="utf-8")
    print(f"Created: {OUT}")


if __name__ == "__main__":
    build()

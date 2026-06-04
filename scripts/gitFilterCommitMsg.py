#!/usr/bin/env python3
"""stdin/stdout filter for git filter-branch --msg-filter."""
import sys

REPLACEMENTS = [
    ("YOUR-RENDER-SERVICE.onrender.com", "YOUR-RENDER-SERVICE.onrender.com"),
    ("YOUR-RENDER-SERVICE.onrender.com", "YOUR-RENDER-SERVICE.onrender.com"),
    ("REDACTED_ADMIN@example.com", "REDACTED_ADMIN@example.com"),
    ("redacted@example.com", "redacted@example.com"),
    ("redacted@example.com", "redacted@example.com"),
    ("redacted-staff@example.com", "redacted-staff@example.com"),
    ("redacted-staff@example.com", "redacted-staff@example.com"),
    ("redacted-staff@example.com", "redacted-staff@example.com"),
    ("redacted-staff@example.com", "redacted-staff@example.com"),
    ("github.com/YOUR_ORG", "github.com/YOUR_ORG"),
    ("RaghavSobti37", "YOUR_ORG"),
    ("Raghav Raj Sobti", "Redacted User"),
    ("Raghav Sobti", "Redacted User"),
]

msg = sys.stdin.read()
for old, new in REPLACEMENTS:
    msg = msg.replace(old, new)
sys.stdout.write(msg)

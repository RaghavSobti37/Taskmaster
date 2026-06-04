"""git-filter-repo --commit-callback helper (not imported by app)."""

REPLACEMENTS = [
    (b"YOUR-RENDER-SERVICE.onrender.com", b"YOUR-RENDER-SERVICE.onrender.com"),
    (b"YOUR-RENDER-SERVICE.onrender.com", b"YOUR-RENDER-SERVICE.onrender.com"),
    (b"REDACTED_ADMIN@example.com", b"REDACTED_ADMIN@example.com"),
    (b"redacted@example.com", b"redacted@example.com"),
    (b"redacted@example.com", b"redacted@example.com"),
    (b"redacted-staff@example.com", b"redacted-staff@example.com"),
    (b"redacted-staff@example.com", b"redacted-staff@example.com"),
    (b"redacted-staff@example.com", b"redacted-staff@example.com"),
    (b"redacted-staff@example.com", b"redacted-staff@example.com"),
    (b"github.com/YOUR_ORG", b"github.com/YOUR_ORG"),
    (b"RaghavSobti37", b"YOUR_ORG"),
    (b"Raghav Raj Sobti", b"Redacted User"),
    (b"Raghav Sobti", b"Redacted User"),
]


def commit_callback(commit, metadata):
    if not commit.message:
        return
    msg = commit.message
    for old, new in REPLACEMENTS:
        msg = msg.replace(old, new)
    commit.message = msg

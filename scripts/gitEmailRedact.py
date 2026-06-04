def email_callback(email):
    if not email:
        return b"unknown@example.com"
    mapping = {
        b"redacted@example.com": b"redacted@example.com",
        b"REDACTED_ADMIN@example.com": b"REDACTED_ADMIN@example.com",
        b"redacted@example.com": b"redacted@example.com",
        b"redacted-staff@example.com": b"redacted-staff@example.com",
        b"redacted-staff@example.com": b"redacted-staff@example.com",
        b"redacted-staff@example.com": b"redacted-staff@example.com",
        b"redacted-staff@example.com": b"redacted-staff@example.com",
    }
    return mapping.get(email, email)

def name_callback(name):
    if not name:
        return b"Redacted User"
    if name == b"RaghavSobti37":
        return b"Redacted User"
    if name in (b"Raghav Raj Sobti", b"Raghav Sobti"):
        return b"Redacted User"
    return name

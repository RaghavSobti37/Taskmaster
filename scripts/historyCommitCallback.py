REDACT = {
    b'raghavsobti37@gmail.com': b'redacted@example.com',
    b'raghavraj@theshakticollective.in': b'redacted@example.com',
    b'raghav@gmail.com': b'redacted@example.com',
    b'harshika@theshakticollective.in': b'redacted@example.com',
    b'deepank@theshakticollective.in': b'redacted@example.com',
    b'aryaman@theshakticollective.in': b'redacted@example.com',
    b'rohith@theshakticollective.in': b'redacted@example.com',
}
for field in ('author_email', 'committer_email'):
    email = getattr(commit, field)
    if email in REDACT:
        setattr(commit, field, REDACT[email])
for field in ('author_name', 'committer_name'):
    name = getattr(commit, field)
    if name in (b'RaghavSobti37', b'Raghav Raj Sobti', b'Raghav Sobti'):
        setattr(commit, field, b'Redacted User')
return commit

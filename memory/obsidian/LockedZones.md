# LockedZones

Locked-zone policy is enforced by:
- `scripts/check-locked-zones.mjs`
- CI workflow guard step

Override requires:
- `ALLOW_LOCKED_ZONE_CHANGES=true`
- explicit rationale in PR/commit context

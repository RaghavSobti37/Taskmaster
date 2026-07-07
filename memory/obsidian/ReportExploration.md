# ReportExploration

Use this sequence before making architecture or access-control edits:

1. Open `docs/reference/COREKNOT_MASTER.md` for the canonical narrative.
2. Cross-check routing/access behavior in `docs/.generated/route-access-matrix.json`.
3. Resolve permission intent in `docs/.generated/preset-page-matrix.json`.
4. Trace data flow from hook usage via `docs/.generated/hook-endpoint-map.json`.
5. Validate cross-cutting rules in `docs/.generated/shared-rules-inventory.json`.
6. Confirm unlock policy in `docs/.generated/feature-unlock-matrix.json`.

Agents should treat this chain as mandatory pre-read for report analysis and extension work.

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const platformRoot = path.resolve(root, '..', '..');
const obsidianRoot = path.join(platformRoot, 'memory/obsidian');
const legacyIndex = path.join(root, '.specify/memory/INDEX.md');
const legacyRecent = path.join(root, '.specify/memory/changelog/recent-changes.md');

function safeRead(filePath, fallback = '') {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return fallback;
  }
}

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

const today = new Date().toISOString().slice(0, 10);
const legacyRecentText = safeRead(legacyRecent, '_No legacy changes recorded._\n');

const obsidianIndex = `# CoreKnot Obsidian Memory Index

> Canonical project memory for humans + AI agents.
> Last updated: ${today}

## Start Here
- [[Conventions]]
- [[ReportExploration]]
- [[RoutingAndAccess]]
- [[FeatureUnlocks]]
- [[LockedZones]]
- [[RecentChanges]]
- [[MasterReference]]

## Source of Truth
- Vault root: \`memory/obsidian/\` (TSC Platform repo root)
- Page reference: \`coreknot/Taskmaster/docs/reference/COREKNOT_MASTER.md\`
- Generated maps: \`coreknot/Taskmaster/docs/.generated/*.json\`
- Legacy compatibility index: \`coreknot/Taskmaster/.specify/memory/INDEX.md\`
- Hermes cron output: \`memory/Daily/\` · candidates: \`memory/Memory-Review/\`
`;

const conventions = `# Conventions

- Public term: **Organization (Org)**.
- Internal/API term: **Tenant**.
- Org-facing UI routes call \`/api/tenants/*\`.
- Platform-admin tenant controls use \`/api/admin/tenants/*\`.
`;

const routing = `# RoutingAndAccess

Merged routing matrix:
- \`docs/.generated/route-access-matrix.json\`

Preset-to-page matrix:
- \`docs/.generated/preset-page-matrix.json\`
`;

const reportExploration = `# ReportExploration

Use this sequence before making architecture or access-control edits:

1. Open \`docs/reference/COREKNOT_MASTER.md\` for the canonical narrative.
2. Cross-check routing/access behavior in \`docs/.generated/route-access-matrix.json\`.
3. Resolve permission intent in \`docs/.generated/preset-page-matrix.json\`.
4. Trace data flow from hook usage via \`docs/.generated/hook-endpoint-map.json\`.
5. Validate cross-cutting rules in \`docs/.generated/shared-rules-inventory.json\`.
6. Confirm unlock policy in \`docs/.generated/feature-unlock-matrix.json\`.

Agents should treat this chain as mandatory pre-read for report analysis and extension work.
`;

const unlocks = `# FeatureUnlocks

All optional modules are default-disabled on org creation and enabled per-org on request.

Canonical unlock matrix:
- \`docs/.generated/feature-unlock-matrix.json\`
`;

const locked = `# LockedZones

Locked-zone policy is enforced by:
- \`scripts/check-locked-zones.mjs\`
- CI workflow guard step

Override requires:
- \`ALLOW_LOCKED_ZONE_CHANGES=true\`
- explicit rationale in PR/commit context
`;

const masterRef = `# MasterReference

- \`docs/reference/COREKNOT_MASTER.md\`
- \`docs/.generated/hook-endpoint-map.json\`
- \`docs/.generated/shared-rules-inventory.json\`
`;

write(path.join(obsidianRoot, 'INDEX.md'), obsidianIndex);
write(path.join(obsidianRoot, 'Conventions.md'), conventions);
write(path.join(obsidianRoot, 'ReportExploration.md'), reportExploration);
write(path.join(obsidianRoot, 'RoutingAndAccess.md'), routing);
write(path.join(obsidianRoot, 'FeatureUnlocks.md'), unlocks);
write(path.join(obsidianRoot, 'LockedZones.md'), locked);
write(path.join(obsidianRoot, 'MasterReference.md'), masterRef);
write(path.join(obsidianRoot, 'RecentChanges.md'), legacyRecentText);

const compatStub = `# CoreKnot Legacy Memory Index (Compatibility Stub)

This tree remains for backward compatibility only.

- Canonical memory now lives in: \`memory/obsidian/INDEX.md\` (TSC Platform root; junction at \`coreknot/Taskmaster/memory/obsidian\`)
- Legacy files should not be extended with new canonical content.

Last synced: ${today}
`;

write(legacyIndex, compatStub);
console.log('Synced Obsidian memory and updated .specify compatibility index.');

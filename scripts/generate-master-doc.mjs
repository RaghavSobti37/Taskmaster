#!/usr/bin/env node
/**
 * Builds docs/reference/COREKNOT_MASTER.md from page inventory + static sections.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const inventory = JSON.parse(
  fs.readFileSync(path.join(root, 'docs/.generated/page-inventory.json'), 'utf8'),
);

const PAGE_PERMISSIONS = fs.readFileSync(
  path.join(root, 'client/src/utils/pagePermissions.js'),
  'utf8',
);

const DOMAIN_ORDER = [
  { id: 'auth', label: 'Authentication & legal', match: (f) => /pages\/(auth|legal)\//.test(f) || f.includes('LandingPage') || f.includes('Unsubscribe') },
  { id: 'dashboard', label: 'Dashboard & productivity', match: (f) => /Dashboard|todo|inbox|notes|productivity|schedule|calendar/.test(f) },
  { id: 'projects', label: 'Projects & workspaces', match: (f) => /projects\//.test(f) },
  { id: 'crm', label: 'CRM & sales', match: (f) => /crm\/|hubs\/CrmHub/.test(f) },
  { id: 'office', label: 'Office hub', match: (f) => /office\/|hubs\/OfficeHub|management\/(Equipment|Contacts)/.test(f) },
  { id: 'management', label: 'Management hub', match: (f) => /finance\/|management\/(Announcements|Attendance)|hubs\/ManagementHub|artists\/ArtistsCollection/.test(f) },
  { id: 'emails', label: 'Email & campaigns', match: (f) => /emails\/|workspace\/(Newsletter|CreateCampaign)|CampaignDetails/.test(f) },
  { id: 'artists', label: 'Artist OS & workspace', match: (f) => /artists\//.test(f) },
  { id: 'assets', label: 'Assets', match: (f) => /assets\//.test(f) || f.includes('OfficeAssetsPage') },
  { id: 'admin', label: 'Admin & Data Hub', match: (f) => /admin\//.test(f) || f.includes('hubs/AdminConsole') },
  { id: 'settings', label: 'Settings', match: (f) => /settings\//.test(f) },
  { id: 'other', label: 'Marketing, dev & misc', match: () => true },
];

function groupPages() {
  const groups = DOMAIN_ORDER.map((d) => ({ ...d, pages: [] }));
  const assigned = new Set();
  for (const p of inventory) {
    for (const g of groups) {
      if (g.id === 'other') continue;
      if (g.match(p.file) && !assigned.has(p.file)) {
        g.pages.push(p);
        assigned.add(p.file);
        break;
      }
    }
  }
  for (const p of inventory) {
    if (!assigned.has(p.file)) groups.find((g) => g.id === 'other').pages.push(p);
  }
  return groups.filter((g) => g.pages.length);
}

function formatPage(p) {
  const routes = p.routes?.length ? p.routes.join(', ') : '_embedded tab / child route_';
  const lines = [
    `#### \`${p.file}\``,
    '',
    `| Field | Value |`,
    `| --- | --- |`,
    `| **Route(s)** | ${routes} |`,
    `| **Default export** | \`${p.defaultExport || '—'}\` |`,
    `| **Lines** | ${p.lines} |`,
  ];
  if (p.namedExports?.length) {
    lines.push(`| **Named exports** | ${p.namedExports.map((e) => `\`${e}\``).join(', ')} |`);
  }
  if (p.hooks?.length) {
    lines.push(`| **Hooks** | ${p.hooks.map((h) => `\`${h}\``).join(', ')} |`);
  }
  if (p.components?.length) {
    lines.push(`| **Key components** | ${p.components.map((c) => `\`${c}\``).join(', ')} |`);
  }
  if (p.apis?.length) {
    lines.push('');
    lines.push('**API endpoints:**');
    lines.push('');
    for (const api of p.apis) lines.push(`- \`${api}\``);
  } else {
    lines.push('');
    lines.push('_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._');
  }
  lines.push('');
  return lines.join('\n');
}

const groups = groupPages();
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version || '1.0.7';
const today = new Date().toISOString().slice(0, 10);

const header = `# CoreKnot — Master Reference

> **Canonical product bible.** Every routed page, APIs, hooks, exports, and access rules.  
> **Product:** CoreKnot · **Repo:** \`coreknot/Taskmaster\` · **Version:** ${version} · **Compiled:** ${today}

---

## How to use this document

| Audience | Start here |
| --- | --- |
| **New engineer** | [Platform overview](#1-platform-overview) → your domain in [Page catalog](#3-page-catalog-by-domain) |
| **AI agent** | Full file + [\`.specify/memory/INDEX.md\`](../.specify/memory/INDEX.md) + locked zones in [\`operations/conventions.md\`](../.specify/memory/operations/conventions.md) |
| **Ops / deploy** | [\`operations/deployment.md\`](../operations/deployment.md) + [\`operations/environments.md\`](../operations/environments.md) |

**Live inventory:** Regenerate with \`node scripts/generate-page-inventory.mjs && node scripts/generate-master-doc.mjs\`.

---

## Table of contents

1. [Platform overview](#1-platform-overview)
2. [Routing & access control](#2-routing--access-control)
3. [Page catalog by domain](#3-page-catalog-by-domain)
4. [Hub layouts & tabs](#4-hub-layouts--tabs)
5. [Backend API surface](#5-backend-api-surface)
6. [Business rules (cross-cutting)](#6-business-rules-cross-cutting)
7. [Locked zones](#7-locked-zones)
8. [Documentation map](#8-documentation-map)

---

## 1. Platform overview

CoreKnot is TSC's multi-tenant CRM and operations hub: projects, CRM, email campaigns, finance, attendance, Artist OS, gamification, and admin tooling.

| Layer | Stack |
| --- | --- |
| Frontend | React 18, Vite 5, Tailwind v4, TanStack Query, React Router 6, PWA |
| API | Express + Mongoose on Render |
| Data | MongoDB Atlas (primary), Redis/BullMQ, Supabase (secondary mirror) |
| Auth | JWT cookie (\`coreknot_token_v3\`), Google OAuth, Clerk (optional) |
| Deploy | Vercel (SPA) → same-origin \`/api\` proxy → Render API |

**Site modes** (\`client/src/config/siteMode.js\`):

| Mode | Host | Purpose |
| --- | --- | --- |
| \`app\` | \`tsccoreknot.com\` | Workspace |
| \`auth\` | \`auth.tsccoreknot.com\` | Login/register |
| \`landing\` | \`landing.tsccoreknot.com\` | Marketing |

---

## 2. Routing & access control

### Guard chain (authenticated app routes)

\`\`\`
Request → ProtectedRoute (session) → MainLayout → PageRoute (page key) → Page component
\`\`\`

| Guard | File | Rule |
| --- | --- | --- |
| \`ProtectedRoute\` | \`components/ProtectedRoute.jsx\` | Valid session; Clerk boot when configured |
| \`PageRoute\` | \`components/PageRoute.jsx\` | \`hasPageAccess(user, pageKey)\` — redirect to \`/dashboard\` if denied |
| \`ArtistOrAdminRoute\` | \`components/ArtistOrAdminRoute.jsx\` | Org accounts under \`/assets/accounts\` |
| \`ArtistMembershipRoute\` | \`components/ArtistMembershipRoute.jsx\` | Artist workspace membership |

### Page permission keys

Resolved via \`getUserPagePermissions()\` in \`client/src/utils/pagePermissions.js\`:

- Department **admin** preset → all keys
- User \`pagePermissions[]\` override when set
- Else department \`permissionPreset\` or \`slug\` → \`PRESET_PAGES\`

**Presets:** \`admin\`, \`ops\`, \`sales\`, \`artist-management\`, \`artist-business\`, \`creative\`, \`standard\`

**Special rules:**

- \`emails\` / \`campaigns\` — any authenticated user
- \`admin_artist_path\` — admin dept OR \`admin_data\` permission
- \`admin_ops_hub\` — admin OR ops-hub sub-permissions

### Route → permission mapping (\`App.jsx\`)

| Path pattern | Page key(s) |
| --- | --- |
| \`/dashboard\` | \`dashboard\` |
| \`/projects/*\` | \`projects\` |
| \`/calendar\` | \`calendar\` |
| \`/settings\` | \`settings\` |
| \`/logs\` | \`logs\` |
| \`/attendance\` | \`attendance\` |
| \`/schedule\` | \`schedule\` |
| \`/inbox\` | \`inbox\` |
| \`/todo\` | \`todo\` |
| \`/notes/*\` | \`notes\` |
| \`/crm\` | \`leads\`, \`followups\`, \`bookings\` (any) |
| \`/office\` | \`equipment\`, \`contacts\`, \`subscriptions\` (any) |
| \`/management\` | \`finance\`, \`announcements\`, \`artists\` (any) |
| \`/admin/console\` | multiple \`admin_*\` keys |
| \`/emails/*\` | \`emails\` |
| \`/artists/*\` | \`artists\` |
| \`/assets/*\` | \`assets\` |
| \`/admin/*\` | per-route \`admin_*\` keys |

Legacy redirects: \`/leads\` → \`/crm?tab=leads\`, \`/finance\` → \`/management?tab=finance\`, etc.

---

## 3. Page catalog by domain

_Total page files: ${inventory.length}. Each entry lists route, exports, hooks, components, and explicit API paths._

`;

const hubSection = `
---

## 4. Hub layouts & tabs

### CRM Hub (\`/crm\`)

| Tab | Component | Permission |
| --- | --- | --- |
| \`leads\` | \`LeadsPage\` | \`leads\` |
| \`followups\` | \`FollowupsPage\` | \`followups\` |
| \`bookings\` | \`ExlyBookingsPage\` | \`bookings\` |

File: \`client/src/pages/hubs/CrmHub.jsx\` — URL query \`?tab=\` drives active panel.

### Office Hub (\`/office\`)

| Tab | Component | Permission |
| --- | --- | --- |
| \`equipment\` | \`EquipmentPage\` | \`equipment\` |
| \`contacts\` | \`ContactsPage\` | \`contacts\` |
| \`subscriptions\` | \`SubscriptionsPage\` | \`subscriptions\` |

### Management Hub (\`/management\`)

| Tab | Component | Permission |
| --- | --- | --- |
| \`finance\` | \`FinancePage\` | \`finance\` |
| \`announcements\` | \`AnnouncementsPage\` | \`announcements\` |
| \`artists\` | \`ArtistsCollection\` | \`artists\` |

### Admin Console (\`/admin/console\`)

Aggregates admin tools behind \`admin_*\` permissions — users, teams, roles, scripts, gamification, project analytics, exly, artist path, ops hub.

### Email Hub (\`/emails/*\`)

Layout: \`EmailHubLayout.jsx\`. Sub-routes: overview, campaigns, templates, profiles, analytics, newsletter (curate/send).

### Settings (\`/settings\`)

Tabs in \`settings/tabs/\`: Profile, Notifications, Progress, Leave, Keyboard shortcuts, Dashboard customization.

### Artist detail (\`/artists/:id/*\`)

\`ArtistDetail.jsx\` + \`ArtistOSLayout\` tabs: Overview, Analytics, Calendar, Inquiries, Gigs, Finance, Contracts, Content, Team, etc. (\`pages/artists/os/*\`).

### Artist workspace (\`/artist-workspace/:id/*\`)

Membership-gated shell: \`ArtistWorkspaceShell\` → \`ArtistWorkspaceDetail\` with releases/team sub-tabs.

`;

const routeFiles = fs.readdirSync(path.join(root, 'server/routes')).filter((f) => f.endsWith('.js')).sort();
const apiMounts = routeFiles.map((f) => `- \`server/routes/${f}\``).join('\n');

const backendSection = `
---

## 5. Backend API surface

Express mounts route modules from \`server/routes/\` (see \`server/server.js\` for prefix map). Primary domains:

| Domain | Route file | Typical prefix |
| --- | --- | --- |
| Auth | \`authRoutes.js\`, \`authConnectRoutes.js\` | \`/api/auth\` |
| Users / teams | \`userRoutes.js\`, \`teamRoutes.js\` | \`/api/users\`, \`/api/teams\` |
| Projects / tasks | \`projectRoutes.js\`, \`taskRoutes.js\` | \`/api/projects\`, \`/api/tasks\` |
| CRM | \`crmRoutes.js\`, \`crmStatsRoutes.js\` | \`/api/crm\` |
| Data Hub | \`dataHubRoutes.js\` | \`/api/data-hub\` |
| Mail / campaigns | \`mailRoutes.js\`, \`campaignRoutes.js\` | \`/api/mail\`, \`/api/campaigns\` |
| Finance | \`financeRoutes.js\` | \`/api/finance\` |
| Artists | \`artistRoutes.js\`, \`artistV2Routes.js\`, \`artistPathRoutes.js\` | \`/api/artists\` |
| Attendance / logs | \`attendanceRoutes.js\`, \`logRoutes.js\` | \`/api/attendance\`, \`/api/logs\` |
| Admin | \`adminScriptsRoutes.js\`, \`platformSettingsRoutes.js\`, \`qaRoutes.js\` | \`/api/admin/*\` |
| Webhooks | \`webhookRoutes.js\` | \`/api/webhooks/*\` |
| Health / public | \`publicRoutes.js\`, \`openApiRoutes.js\` | \`/api/health\`, public |

**All route modules:**

${apiMounts}

Full endpoint listing: \`.specify/memory/backend/express.md\` and \`.specify/memory/MASTER.md\` §12.

---

## 6. Business rules (cross-cutting)

| Area | Rule | Source |
| --- | --- | --- |
| Task review | Creator cannot approve own task; assignee submits for review | \`shared/taskReviewRules.js\` |
| Attendance | Office/WFH check-in; 1h lunch; worked vs daily-log reconciliation | \`shared/attendanceMetrics.js\` |
| Dates (UI) | DD/MM/YYYY display; ISO in \`<input type="date">\` | \`client/src/utils/dateDisplay.js\` |
| CRM locks | Lead lock/audit on sensitive edits | server CRM controllers |
| Email tracking | Locked engine — do not change pixel/redirect behavior | \`docs/reference/EMAIL_ENGINE_LOCKED.md\` |
| Gamification | XP on task completion; weekly leaderboard IST Monday reset | \`shared/gamificationRules.js\` |
| Multi-tenant | \`tenantPlugin\` on models; tenant from session | \`server/plugins/tenantPlugin.js\` |

---

## 7. Locked zones

| Asset | Doc |
| --- | --- |
| Email open/click tracking | [\`EMAIL_ENGINE_LOCKED.md\`](../reference/EMAIL_ENGINE_LOCKED.md) |
| Logo + default spinner | [\`LOGO_LOCKED.md\`](../reference/LOGO_LOCKED.md) |
| Production hosts | \`.cursor/production-hosts.local.json\` (gitignored) |
| Legacy APIs | [\`LEGACY_FREEZE.md\`](../architecture/LEGACY_FREEZE.md) |

---

## 8. Documentation map

| Path | Purpose |
| --- | --- |
| [\`DOCUMENTATION_INDEX.md\`](../DOCUMENTATION_INDEX.md) | Human navigation hub |
| [\`.specify/memory/INDEX.md\`](../.specify/memory/INDEX.md) | Agent memory hub |
| [\`reference/COREKNOT_MASTER.md\`](./COREKNOT_MASTER.md) | **This file** — page-level truth |
| [\`operations/\`](../operations/) | Deploy, startup, scripts, environments |
| [\`architecture/\`](../architecture/) | System design, data, security, debt |
| [\`features/\`](../features/) | Domain deep-dives (Artist OS, Data Hub, integrations) |
| [\`auth/\`](../auth/) | OAuth, Clerk, subdomain setup |
| [\`design/\`](../design/) | UI reference |

`;

let body = header;
for (const g of groups) {
  body += `\n### ${g.label}\n\n`;
  for (const p of g.pages.sort((a, b) => a.file.localeCompare(b.file))) {
    body += formatPage(p);
  }
}
body += hubSection + backendSection;

const outPath = path.join(root, 'docs/reference/COREKNOT_MASTER.md');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, body);
console.log(`Wrote ${outPath} (${body.split('\n').length} lines)`);

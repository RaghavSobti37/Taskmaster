# Unified Design Implementation Framework (UDIF)
## Version 2.1 - Data-first layout
## Version 2.0 - Immersive Scannable Precision
## MANDATE: INTERACTIVITY OVER CLUTTER

This document acts as the structural blueprint for all page development within the CoreKnot platform. Adherence to these standards is mandatory.

---

### Phase 1: Structural Hierarchy & Spatial Math (The Grid)

*   **The 4px Hard Grid System**: 
    - Base Unit: `4px`
    - Standard Padding: `16px` (`p-4`)
    - Layout Gap: `24px` (`gap-6`)
    - Component Radius: `12px` (`var(--radius-lg)`); small controls: `var(--radius-atomic)` (4px)

*   **The 3-Tier Layout Architecture (list / data pages)**: 
    1.  **Tier 1: Data overview** — `DataOverviewSection`: up to 4 `StatCard` KPIs + 1–2 `DataMiniChart` panels (bar/donut). **No page title** when this tier is present (sidebar + KPI labels give context).
    2.  **Tier 2: PageToolbar** — one compact row: optional icon+title (only if no overview), `SearchInput`, filters (`NexusDropdown`), primary actions on the right. No separate sort dropdown when columns are sortable.
    3.  **Tier 3: Workspace** — `DataTable` or documented table exceptions.
*   **Simple pages** (no KPIs): `ListPageLayout` with title in `PageToolbar` only. **No subtitles** anywhere on page chrome.
*   **Legacy `PageHeader`**: settings/marketing only; never pass `subtitle` (deprecated).

---

### Phase 2: The Row-Level Interactivity Mandate

*   **NO ACTIONS COLUMN**: 
    - Tables MUST NOT have a dedicated "Actions" column with static buttons.
    - Data rows must be fully clickable wrappers (`cursor: pointer`).
*   **Immersive Workspace**: 
    - On row click, launch a **FullScreenWorkspace** modal.
    - **70/30 Layout**: 70% main view (historical data/metrics), 30% utility drawer (activity/metadata).
*   **Hover Kinetics**: 
    - Quick actions (e.g., Quick Delete) must only appear on absolute-positioned hover overlays on the far right.
    - Zero structural shift during hover.

---

### Phase 3: Linguistic Standards & Cognitive Simplicity

*   **Plain English UI**: 
    - Eliminate B2B jargon (e.g., "Nexus", "Operational Unit", "Mutation").
    - Use: "Task", "Settings", "Project", "Lead", "Activity Recorded".
*   **Contextual Info triggers**: 
    - Use the `InfoButton` component (`i` icon) for complex metrics.
    - Trigger a non-disruptive popover explaining what the metric is and how it affects the user.

---

### Phase 4: Component Implementation

*   **DataTable**: High-density rows (max 48px), `onRowClick` mandatory. Sortable columns: `sortKey` + click header cycles **asc → desc → default**. Server lists: `sortState` + `onSortChange`.
*   **ListPageLayout**: Enforces overview → toolbar → children order. See `docs/COMPONENT_STANDARDS.md`.
*   **User identity in UI**: Anywhere a CoreKnot **user** is shown (tables, logs, assignees, attendance rows, etc.), use `UserAvatar` or `UserLabel` from `components/ui` — profile image when `user.avatar` exists, otherwise initials. Do not show name-only rows for users.
*   **FullScreenWorkspace**: Full-screen overlay, ESC to close, persistent top-bar.
*   **InfoButton**: Subtle `i` trigger with hover-popover.

---

### Implementation Checklist

- [ ] Does the table have an "Actions" column? (If YES, delete it).
- [ ] Is the entire row clickable?
- [ ] Does clicking a row open a 70/30 Full-screen view?
- [ ] Are all metrics accompanied by an `InfoButton` where needed?
- [ ] Is the language simple? (e.g., "User Directory" -> "Users").
- [ ] Are project color indicators (left-borders) applied consistently in data lists?

---

### Phase 5: Brand Aesthetics & Visual Identity

*   **TSC Brandbook Colors** (marketing/auth only — `.tm-marketing-page`):
    - **Background**: Lighter Cream (`#fcf8f2`)
    - **Text Primary**: Deep Teal (`#083d3a`)
    - **Accents**: Sea Foam (`#126d5e`), Pumpkin (`#b74b02`)
*   **App shell** (Dashboard, CRM, Projects, Settings): Slate neutrals via CSS vars in `index.css` — not cream/teal.
*   **The Paperish Feel** (marketing/auth only):
    - Use the extracted PDF repeating patterns (`pattern_0.png`) with `mix-blend-overlay` combined with the generated ink spill texture (`ink_spill_bg.png`) with `mix-blend-multiply` (or screen for dark mode) to create an elegant, subtle, paper-like background on static pages (Auth/Landing).
*   **Project Context Integration**:
    - All tasks in the dashboard and related views must display a left-border with the associated project's color to establish instant visual linking.
    - Accompany the project name with its shortened ID.

---

### Phase 6: Subtractive Visual Language

High-end enterprise UI is subtractive — separate information with typography and spacing, not boxes.

*   **Flatten the Z-Axis**: No drop shadows on static elements. Shadows reserved for floating UI (dropdowns, Command Palette, modals).
*   **Rule dividers over borders**: Use `border-b` between rows/sections; avoid full `border` boxes around data.
*   **Typography hierarchy**: Primary data = `.tm-data-primary`; metadata = `.tm-data-meta` / `.tm-widget-label`.
*   **Tabular figures**: All financial/analytics columns use `tabular-nums` and right alignment.
*   **Glanceable analytics**: Delta chips (`.tm-delta-positive` / `.tm-delta-negative`); muted chart axes (see `ChartSurface`).
*   **FullScreenWorkspace**: 70/30 split via background shift (`surface` vs `workspace-sidebar`), ghost inputs for inline edit.
*   **List page rhythm**: `DataOverviewSection` → `mb-8` → `PageToolbar` → flush `DataTable` (never wrap table in Card).

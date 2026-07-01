# CoreKnot Design Reference

**Mandatory read before any client UI change.** Apply the checklist on every page you touch.

Related: [COMPONENT_STANDARDS.md](../COMPONENT_STANDARDS.md) (UDIF implementation), [design_guidelines.md](../../client/design_guidelines.md) (data-first layout), [dateDisplay.js](../../client/src/utils/dateDisplay.js) (DD/MM/YYYY).

---

## Quick checklist (run on every page)

- [ ] Is there exactly one accent color, and can I say where it came from?
- [ ] Do surfaces that are logically one thing look like one thing?
- [ ] Are related elements grouped tighter than unrelated ones?
- [ ] Does every element on the page serve the primary task?
- [ ] Is there one memorable signature detail, not several competing ones?
- [ ] Does the copy say what happened and what to do, in plain language?
- [ ] What's the one thing I'd remove if I could only remove one?

---

## How agents use this document

| When | Action |
|------|--------|
| Before editing `client/**` | Read this file + run checklist above |
| New list/data page | Use `ListPageLayout` + `PageToolbar` + `SelectionFilterPanel` |
| New module hub (CRM, Management, Office) | Use `HubPageLayout` / `TabHubLayout` |
| Visual tokens / colors | `client/src/index.css`, `@coreknot/design-tokens` — one accent from logo teal |
| Dates in UI | `formatDisplayDate` etc. — **DD/MM/YYYY** only |
| Deeper component API | `docs/COMPONENT_STANDARDS.md` |

Cursor rule: `.cursor/rules/coreknot-design-reference.mdc` (auto-attached on `client/**` edits).

---

# A working design ideology

This is the process behind redesigns (login, error states, and ongoing UI work). It is **not** a fixed style — it is a sequence of questions to ask about *any* page before touching pixels.

## 1. Diagnose before you decorate

Most "make it look better" requests are not missing decoration — they are missing *consistency*. Before changing anything, look for places where the design argues with itself:

- Colors that do not relate to each other or to anything in the brand (e.g. an orange border that appears nowhere else)
- Two components trying to be "the surface" at once (a card floating inside a card)
- The same name, label, or action spelled two different ways ("CoreKnot" vs "Coreknot")
- Elements with equal visual weight that do not have equal importance (an "Install app" button sized the same as the actual sign-in CTA)

If you can point to a specific inconsistency, that is worth more than any subjective "this needs more polish" — it is fixable and the fix is obvious once named.

## 2. One accent color, sourced from something real

Every design gets exactly **one** accent color driving every interactive element — links, focus rings, primary buttons, active states. Not "a palette," one color.

That color is not invented. It comes from something that already exists and matters: the logo mark, an existing UI element the user already trusts, or the one semantic thing the page is about (success green, error red). For CoreKnot that means **teal from the logo** (`--brand-teal-deep`, `--color-action-primary` / `--color-brand-teal` in `index.css`) — not arbitrary oranges or competing hues.

Everything else — backgrounds, borders, body text — stays neutral. Neutral does not mean boring; it means it does not compete with the one color that is supposed to mean "click here."

**CoreKnot scope:** App shell uses slate neutrals; TSC cream/teal marketing palette is scoped to `.tm-marketing-page` and auth routes only.

## 3. Unify the surfaces

Depth and containment should tell the truth about structure. If two things are actually one component (a form sitting inside a page), they get one radius, one shadow language, one edge treatment. If they are genuinely separate layers (a modal over a page), they get a real, intentional visual break — not an accidental one from mismatched corner radii.

**Test:** Could someone trace the outline of every distinct "object" on the page and have it match how a developer would describe the DOM structure? If visual layering does not match logical layering, fix that first — often the highest-leverage change on the page.

**Project rule:** Shadows only on floating UI (`.tm-floating`); static surfaces use rule dividers (`border-b`), not box shadows.

## 4. Hierarchy through grouping, not through size

When something feels flat, the instinct is to make the important thing bigger or bolder. Usually the problem is **spacing**: related things are far apart, unrelated things are close together, or everything has roughly the same gap.

Group by proximity first: icon, heading, body copy, and primary action should read as one unit, with a clear larger gap before the next unit.

Only then reach for size and weight — restrained: one heading size, one body size, at most two font weights.

## 5. Every element earns its place

Before adding anything (icon, secondary link, illustration), ask what it does for the **user's task**, not the page's appearance. An icon on an error state anchors a mostly-empty screen. A reference code enables support resolution.

If an element does not serve the task, remove or shrink it — even if it looks fine alone.

## 6. One signature element, not several

One thing done well beats five done adequately. Example: the sparkle mark as logo, watermark, and error anchor — one motif, multiple appearances — not three unrelated decorative choices.

If everything tries to be distinctive, nothing is.

## 7. Copy is part of the design, not an afterthought

Error and empty states: say what happened in plain terms, then what to do. No apologizing, no vague "oops," no first-person system voice ("we couldn't process your request"). Button labels are verbs ("Refresh," "Create account"), not vague affordances ("Submit," "OK").

Use plain English in product UI — avoid B2B jargon ("Nexus," "Mutation"). See UDIF linguistic standards in `design_guidelines.md`.

## 8. Self-critique pass

Last step, every time: look at the result and ask what you would cut. If a border, color, or piece of copy is not doing identifiable work, remove it. Restraint is usually the difference between a design that looks "AI-generated" and one that looks deliberate.

---

# UI Designer — visual systems & accessibility

*Merged from agency UI Designer: design-system-first, WCAG AA, component consistency.*

## Design system first

- Use existing tokens in `client/src/index.css` and `client/src/styles/tokens/` — do not hardcode one-off hex values.
- **4px grid:** padding `16px`, layout gap `24px`, radius `var(--radius-lg)` / `var(--radius-atomic)` for controls.
- **Typography:** `.tm-page-title`, `.tm-data-primary`, `.tm-data-meta`, `.tm-widget-label` — hierarchy via class roles, not ad-hoc font sizes.
- **Semantic colors:** success/warning/error via token vars; charts use brand series (`--chart-1` … `--chart-5`).

## Component consistency

- Reuse primitives from `client/src/components/ui/` — do not fork button/input/card styles per page.
- **User identity:** `UserAvatar` / `UserLabel` wherever a CoreKnot user appears — not name-only rows.
- **Interactive states:** default, hover, focus-visible, disabled, loading — all components that accept clicks.
- **No Actions column** on data tables; row click → `FullScreenWorkspace` (70/30). See UDIF.

## Accessibility (WCAG AA minimum)

| Requirement | CoreKnot standard |
|-------------|-------------------|
| Color contrast | 4.5:1 normal text, 3:1 large text |
| Keyboard | Full functionality; `Escape` closes panels/modals |
| Focus | Visible `focus-visible` rings using accent color |
| Touch targets | **44px minimum** on mobile (`min-h-[44px] min-w-[44px]`) |
| Motion | Respect `prefers-reduced-motion` |
| Screen readers | Semantic HTML, `aria-label` on icon-only controls |
| Dates | DD/MM/YYYY visible; ISO only in native `type="date"` values |

## Performance-conscious UI

- No drop shadows on static data surfaces.
- Tabular numbers (`tabular-nums`) for financial/analytics columns.
- Skeleton/loading states for async data — not blank flashes.

---

# UX Architect — layout patterns & responsive behavior

*Merged from agency UX Architect: foundation-first, mobile-first, reusable layout shells.*

## Breakpoints

Defined in `client/src/hooks/useBreakpoint.js`:

| Range | Label | Hook |
|-------|-------|------|
| ≤ 1023px | Mobile | `useIsMobile()` |
| ≥ 1024px | Desktop | `useIsDesktop()` |

PWA desktop mode forces desktop layout regardless of width (`isPwaDesktop()`).

## List / data pages — `ListPageLayout`

**File:** `client/src/components/ui/ListPageLayout.jsx`

**Tier order (UDIF 2.1):**

1. **Insights / overview** — `DataOverviewSection` (KPIs + mini charts). No duplicate page title when overview gives context.
2. **PageToolbar** — search, filter button, primary actions.
3. **Workspace** — `DataTable` or documented exception; never wrap table in Card.

**Props to know:** `filterFields`, `filtersInPanel`, `activeFilterChips`, `mobileSearch`, `queryError` + retry.

Simple pages without KPIs: title lives in `PageToolbar` only. **No subtitles** on page chrome.

## Toolbar — `PageToolbar`

**File:** `client/src/components/ui/PageToolbar.jsx`

One compact row: optional icon+title, `SearchInput`, **Filters** button (not inline dropdown filters), actions right-aligned.

When `filterFields` is set, toolbar shows `FilterToolbarButton` + `SelectionFilterPanel`.

## Filters — `SelectionFilterPanel`

**File:** `client/src/components/ui/SelectionFilterPanel.jsx`

**Migration rule:** Keep `SearchInput` in toolbar; move all dropdown filters to `filterFields` on `ListPageLayout`. Use `countActiveFilters(filterFields)` for badge count. Optional chip row via `ActiveFilterBar`.

| Viewport | Behavior |
|----------|----------|
| Mobile (≤1023px) | Bottom sheet (`MobileFilterSheet`) |
| Desktop (≥1024px) | Right drawer |

Field types: `radio`, `searchable`, `chips`, `segmented`, `toggle`, `dateRange`.

**Do not** add new `NexusDropdown` filters in toolbars — extend `SelectionFilterPanel` instead.

## Hub pages — `HubPageLayout`

**File:** `client/src/components/ui/HubPageLayout.jsx`

Shared skeleton for **CRM, Management, Office** tabbed modules:

- Header row (title + subnav) — `tm-hub-header`
- Scrollable panel content below
- Often composed via `TabHubLayout` (`client/src/pages/hubs/TabHubLayout.jsx`)

## Information architecture

- Primary nav: bounded sections; wayfinding via sidebar + hub subnav.
- **Visual weight:** one H1 per view; section labels via grouping/spacing before font-size escalation.
- **Theme:** app shell follows system/user dark mode; marketing/auth uses fixed cream/teal palette.

## Date display (layout copy)

All user-visible dates: **DD/MM/YYYY** via `client/src/utils/dateDisplay.js`. Never MM/DD/YYYY in labels, nav, or tables.

---

# UX Researcher — task-first validation

*Merged from agency UX Researcher: evidence over assumption, measurable checks.*

## Task-first validation

Before shipping UI:

1. **Name the primary task** — what is the user trying to finish on this screen?
2. **Walk the happy path** — can they complete it without hunting?
3. **Name the failure path** — what happens on error, empty, or permission denied?

Every element must map to step 1 or a recoverable branch of step 3.

## Empty states

- Say what is empty and **what to do next** (verb CTA).
- Do not show a bare table with no rows and no guidance.
- Match tone: factual, not apologetic.

## Error states

- **What happened** + **what to do** + optional reference/id for support.
- `QueryErrorSlot` on list pages; `RouteErrorBoundary` for route failures.
- Retry actions where the failure is transient.

## Measurable UX checks (before merge)

| Check | Pass criteria |
|-------|----------------|
| Primary task completion | Core action reachable in ≤2 interactions from page load |
| Filter discoverability | Filters via panel button; active filters visible as chips when applied |
| Mobile usability | No horizontal overflow; 44px touch targets; filter sheet usable one-handed |
| Copy clarity | No jargon; verb button labels; consistent product name "CoreKnot" |
| Consistency | Same layout shell as sibling pages in the module |
| Accessibility spot-check | Tab through interactive elements; focus visible; icon buttons labeled |

## Research mindset (when unsure)

- Compare with a **working sibling page** in the same hub (Leads, Contacts, Subscriptions).
- If two pages solve the same problem differently, align to the established pattern unless there is a documented reason not to.

---

# Project conventions summary

| Topic | Rule |
|-------|------|
| Accent | Logo teal — one interactive accent in app shell |
| Mobile | ≤1023px, 44px touch targets |
| Desktop | ≥1024px |
| Filters | Button + `SelectionFilterPanel` — not toolbar dropdowns |
| List pages | `ListPageLayout` → overview → toolbar → table |
| Hubs | `HubPageLayout` for CRM / Management / Office |
| Dates | DD/MM/YYYY user-facing only |
| Shadows | Floating UI only |
| Tables | Clickable rows, no Actions column |
| Brand name | **CoreKnot** (capital K) everywhere in UI |

---

# Related documentation

| Document | Purpose |
|----------|---------|
| [COMPONENT_STANDARDS.md](../COMPONENT_STANDARDS.md) | Component APIs and UDIF enforcement |
| [design_guidelines.md](../../client/design_guidelines.md) | UDIF phases, subtractive visual language |
| [AI_AGENT_PROJECT_CONTEXT.md](../AI_AGENT_PROJECT_CONTEXT.md) | Broader product/RBAC context |
| `.cursor/rules/coreknot-design-reference.mdc` | Cursor governance hook |
| `.cursor/rules/agency/ui-designer.mdc` | Full UI Designer agency persona |
| `.cursor/rules/agency/ux-architect.mdc` | Full UX Architect agency persona |
| `.cursor/rules/agency/ux-researcher.mdc` | Full UX Researcher agency persona |

---

*Last updated: design reference v1 — ideology + UI/UX agency merge + CoreKnot conventions.*

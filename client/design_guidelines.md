# Unified Design Implementation Framework (UDIF)
## Version 2.0 - Immersive Scannable Precision
## MANDATE: INTERACTIVITY OVER CLUTTER

This document acts as the structural blueprint for all page development within the Taskmaster platform. Adherence to these standards is mandatory.

---

### Phase 1: Structural Hierarchy & Spatial Math (The Grid)

*   **The 4px Hard Grid System**: 
    - Base Unit: `4px`
    - Standard Padding: `16px` (`p-4`)
    - Layout Gap: `24px` (`gap-6`)
    - Component Radius: `12px` (`var(--radius-atomic)`)

*   **The 3-Tier Layout Architecture**: 
    1.  **Tier 1: PageHeader**: Title, Subtitle, Context Icon, and Primary Action cluster.
    2.  **Tier 2: Analytical Ribbon**: A horizontal flex-row of 4 `StatCard` components.
    3.  **Tier 3: Workspace Surface**: The main data density layer.

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

*   **DataTable**: High-density rows (max 48px), `onRowClick` mandatory.
*   **FullScreenWorkspace**: Full-screen overlay, ESC to close, persistent top-bar.
*   **InfoButton**: Subtle `i` trigger with hover-popover.

---

### Implementation Checklist

- [ ] Does the table have an "Actions" column? (If YES, delete it).
- [ ] Is the entire row clickable?
- [ ] Does clicking a row open a 70/30 Full-screen view?
- [ ] Are all metrics accompanied by an `InfoButton` where needed?
- [ ] Is the language simple? (e.g., "User Directory" -> "Users").

# Frontend and Design Rules
**Status:** Immutable Architectural Specification
**Scope:** Client-side UI/UX, Design Systems, and Interaction Logic

## 1. The 4px Hard Grid System
All spatial dimensions (spacing, padding, margin, width, height) must adhere to a strict 4px modular scale. No arbitrary values are permitted.
- **Scale Calculation**: `[Value] * 4px` (e.g., `p-4` = 16px, `m-10` = 40px).
- **Tailwind v4 Standard**: Use standardized spacing tokens. Custom offsets must use `calc()` on the base 4px unit.
- **Component Heights**: Standardized row heights (e.g., 32px, 40px, 48px).

## 2. High-Density Layout Standards
Maximize information density while maintaining spatial clarity.
- **Padding Capping**:
    - Table Cells / List Items: Maximum `py-2` (8px) and `px-4` (16px).
    - Card Inner Gutters: Maximum `p-4` (16px).
- **Typography Density**: Use compact line-heights (`leading-tight` or `leading-snug`) for data-dense grids.

## 3. Semantic Pastel Color-Encoding Matrix
Colors are strictly for data encoding. Do not use for decoration.

| State | Light Mode (BG/Text) | Dark Mode (BG/Text) | Semantic Meaning |
| :--- | :--- | :--- | :--- |
| **Success** | `#E6F4EA` / `#137333` | `#0F2916` / `#81C995` | Complete, Converted, Valid |
| **Warning** | `#FEF7E0` / `#B06000` | `#2E2003` / `#FDD663` | In-Progress, Warm, Pending |
| **Danger** | `#FCE8E6` / `#C5221F` | `#30100F` / `#F28B82` | Overdue, Hot, High Priority |
| **Info** | `#F1F3F4` / `#3C4043` | `#202124` / `#BDC1C6` | Fresh, Low Priority, Neutral |

*Note: Teams and Projects must use consistent unique pastel identifiers across all modules.*

## 4. Flawless Dark Mode Strategy
Avoid pure black to maintain visual depth and accessibility.
- **Surface Depth Profile**:
    - **Base Background**: `#0B0F19`
    - **Card/Surface**: `#111827`
    - **Modals/Dropdowns**: `#1F2937`
- **Structural Integrity**: Replace heavy shadows with low-opacity strokes.
    - Border: `slate-800` or `rgba(255, 255, 255, 0.05)`.

## 5. Universal Component Integration Mandates
- **Interactive Canvas**:
    - Tables must omit static "Actions" columns. 
    - The entire row must be `cursor:pointer`.
    - Hover state: `hover:bg-slate-100/70` (Light) or `hover:bg-slate-800/50` (Dark).
- **FullScreenWorkspace**:
    - Row clicks must trigger the immersive modal sheet.
    - **Layout**: 70% Primary Data Fields (inline-editable) | 30% Activity & Metadata.
    - **Interaction**: Must include `Esc` key bindings for instant closure.
- **InfoButton Tooltips**:
    - Every unique or technical metric must feature an inline `(i)` trigger.
    - Display plain-English definitions on hover via popover.

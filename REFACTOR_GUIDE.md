# Task Master - Bold Minimalist UI/UX Refactor Guide

## Overview

This document outlines the comprehensive UI/UX refactor that transforms Task Master from a traditional CSS-based design to a modern, bold minimalist interface with glassmorphism effects, Framer Motion animations, and Tailwind CSS utility-first styling.

## 🎨 Design System

### Color Palette (Shakti Collective)

**Primary Color**
- Main: `#b74b02` (Orange)
- Tailwind: `from-primary-600 to-primary-700`
- Used for: Primary actions, accents, highlights

**Secondary Color**
- Main: `#126d5e` (Teal)
- Tailwind: `from-secondary-600 to-secondary-700`
- Used for: Secondary actions, complementary highlights

**Neutral Colors**
- Light: `#f0f0f0`, `#ffffff`
- Dark: `#1f1f1f`, `#0a0a0a`
- Used for: Backgrounds, text, borders

### Typography Guidelines

1. **Headings** - Bold, Heavy Weights (900-800)
   - H1: `text-5xl font-black tracking-tight` (32-40px)
   - H2: `text-4xl font-black tracking-tight` (28-32px)
   - H3: `text-lg font-black tracking-tight` (18-20px)
   - H4: `text-sm font-bold` (14-16px)

2. **Body Text** - Medium weight (500-400)
   - Primary: `text-base font-medium` (16px)
   - Secondary: `text-sm font-medium` (14px)
   - Fine print: `text-xs font-medium` (12px)

3. **Letter Spacing**
   - Headings: `tracking-tight` (0em)
   - Labels: `tracking-widest` (0.1em)
   - Standard: `tracking-normal` (0em)

### Rounded Corners (Bento Grid Standard)

- Small elements: `rounded-md` (12px)
- Medium elements: `rounded-xl` (16px)
- Large cards: `rounded-2xl` (24px)
- Modal/overlays: `rounded-2xl` (24px)

## 🏗️ Component Architecture

### New Refactored Components

#### 1. **DashboardRefactored.tsx** (Main Hub)
Status: ✅ Created in `/client/src/pages/`

**Features:**
- Bento-style responsive grid layout (2-column on desktop, 1-column mobile)
- Collapsible sidebar with Quick Stats
- Keyboard shortcuts display (⌘K, ⌘N)
- Staggered entrance animations on mount
- My Tasks (full-width span)
- Assigned to Me & Assigned to Others (side-by-side)
- Team Members grid (4-column, responsive)
- Search functionality with keyboard shortcut
- Quick action button for new tasks

**Key Interactions:**
- Sidebar toggle with smooth width animation
- Task sections with badge counters
- Stat cards with color-coded categories
- Team member cards with hover-to-assign interaction

**Tailwind Classes:**
- Grid: `grid grid-cols-1 lg:grid-cols-2 gap-8`
- Glassmorphism: `bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl`
- Rounded: `rounded-2xl p-8`
- Shadows: `shadow-lg hover:shadow-xl`

#### 2. **TaskItemRefactored.tsx**
Status: ✅ Created in `/client/src/components/`

**Features:**
- Spring-based checkbox animation (pop effect)
- Glassmorphic design with gradient accents
- Priority badges (Low/Medium/High with colors)
- Status indicators (To Do/In Progress/Done)
- Project tags with custom colors
- Assignee display
- Hover-reveal delete button
- Animated bottom accent line based on status
- Line-through animation on completion

**Animation Details:**
- Checkbox: Spring animation with pop effect on completion
- Entry: `opacity: 0, x: -20` → `opacity: 1, x: 0`
- Exit: Smooth fade with slide
- Badges: Subtle scale on hover

**Tailwind Classes:**
- Layout: `flex items-start gap-4`
- Completed state: `opacity-50 line-through`
- Glassmorphism: `border-gray-200/50 dark:border-gray-700/50`
- Badges: `badge badge-primary`, `badge-secondary`, etc.

#### 3. **MotionComponents.tsx** (Animation Library)
Status: ✅ Created in `/client/src/components/`

**Exported Variants:**
- `containerVariants` - Staggered children entrance
- `itemVariants` - Individual item spring animation
- `popVariants` - Celebration pop animation
- `slideVariants` - Modal slide up
- `fadeVariants` - Simple fade in/out
- `bounceVariants` - Bounce entrance
- `pageVariants` - Full page transitions
- `glassVariants` - Glassmorphism backdrop blur

**Exported Components:**
- `StaggerContainer` - Wrapper for staggered list items
- `AnimatedCard` - Card with hover scale
- `FadeIn` - Simple fade entrance
- `StaggerList` / `StaggerListItem` - For lists
- `FadeIn` - Fade animation

**Usage Example:**
```tsx
<motion.div variants={containerVariants} initial="hidden" animate="visible">
  {tasks.map((task) => (
    <motion.div key={task._id} variants={itemVariants}>
      <TaskItem task={task} />
    </motion.div>
  ))}
</motion.div>
```

### Custom Hooks (useCustomHooks.ts)

1. **useKeyboardShortcut(key, ctrlKey, callback)**
   - Detect global keyboard shortcuts
   - Usage: `useKeyboardShortcut('k', true, () => searchInput.focus())`

2. **useClickOutside(ref, callback)**
   - Close modals/dropdowns on outside click
   - Usage: `const ref = useRef(null); useClickOutside(ref, close)`

3. **useDebounce(value, delay)**
   - Debounce search queries
   - Usage: `const debouncedSearch = useDebounce(search, 300)`

4. **useLocalStorage(key, initialValue)**
   - Persist user preferences to localStorage
   - Usage: `const [sidebarOpen, setSidebarOpen] = useLocalStorage('sidebar', true)`

5. **useIsMobile()**
   - Detect if on mobile device
   - Usage: `const isMobile = useIsMobile()`

6. **useAnimationFrame(callback)**
   - RAF-based animations
   - Usage: `useAnimationFrame((time) => setState(Math.sin(time)))`

## 🎯 Keyboard Shortcuts

Global shortcuts active everywhere:

| Shortcut | Action | Context |
|----------|--------|---------|
| `⌘K` / `Ctrl+K` | Focus search | Dashboard |
| `⌘N` / `Ctrl+N` | Create new task | Dashboard |
| `Escape` | Close modals | Any modal |

Display in UI:
```tsx
<kbd className="px-2 py-1 text-xs font-semibold bg-gray-100 dark:bg-gray-800 rounded">
  ⌘K
</kbd>
```

## ✨ Glassmorphism Effects

### Available Classes

**Glass Container**
```tsx
<div className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/50">
  {children}
</div>
```

**From Tailwind:**
- `backdrop-blur-sm` (4px)
- `backdrop-blur-md` (12px)
- `backdrop-blur-lg` (16px)
- `backdrop-blur-xl` (20px)

**Opacity Levels:**
- `/30` = 30% opacity (more transparent)
- `/50` = 50% opacity (balanced)
- `/70` = 70% opacity (more opaque)
- `/80` = 80% opacity (very opaque)

### Pattern Example
```tsx
<motion.div
  className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl rounded-2xl p-8
             border border-gray-200/50 dark:border-gray-700/50
             shadow-lg hover:shadow-xl transition-all"
  variants={itemVariants}
>
  {children}
</motion.div>
```

## 🎬 Animation Patterns

### Pattern 1: Staggered List Entrance
```tsx
<motion.div variants={containerVariants} initial="hidden" animate="visible">
  {items.map((item) => (
    <motion.div key={item.id} variants={itemVariants}>
      <Item item={item} />
    </motion.div>
  ))}
</motion.div>
```

### Pattern 2: Task Completion Pop
```tsx
<motion.button
  onClick={() => completeTask(_id)}
  variants={popVariants}
  whileHover={{ scale: 1.1 }}
  whileTap={{ scale: 0.9 }}
>
  ✓
</motion.button>
```

### Pattern 3: Modal Slide-Up
```tsx
<AnimatePresence>
  {isOpen && (
    <motion.div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
      variants={fadeVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
    >
      <motion.div
        className="bg-white rounded-2xl p-8"
        variants={slideVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {content}
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

### Pattern 4: Hover Scale Button
```tsx
<motion.button
  className="btn-primary"
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
>
  Click Me
</motion.button>
```

## 🎨 Bento Grid Layout

### Desktop Layout (lg+)
```
┌─────────────────────────────────────┐
│       SIDEBAR      │     MAIN CONTENT│
├─────────────────────────────────────┤
│ • Quick Stats │ Header               │
│ • Shortcuts   │ Search + New Task    │
│               │ ┌─────────────────┐  │
│               │ │ My Tasks (full) │  │
│               │ └─────────────────┘  │
│               │ ┌──────┐  ┌──────┐   │
│               │ │Assign│  │Assign│   │
│               │ │To Me │  │To Oth│   │
│               │ └──────┘  └──────┘   │
│               │ ┌─────────────────┐  │
│               │ │  Team Members   │  │
│               │ │  (4-col grid)   │  │
│               │ └─────────────────┘  │
└─────────────────────────────────────┘
```

### Mobile Layout
```
┌──────────────────┐
│ Header           │
│ Search + New     │
├──────────────────┤
│ My Tasks         │
├──────────────────┤
│ Assigned to Me   │
├──────────────────┤
│ Assigned to Oth  │
├──────────────────┤
│ Team Members     │
│ (1 col)          │
└──────────────────┘
```

## 📦 Tailwind CSS Components

### Pre-defined Components (tailwind.config.js layer components)

**Buttons**
```tsx
<button className="btn-primary">Primary Button</button>
<button className="btn-secondary">Secondary Button</button>
<button className="btn-ghost">Ghost Button</button>
```

**Cards**
```tsx
<div className="card-glass p-6">Glassmorphism card</div>
```

**Badges**
```tsx
<span className="badge-primary">Primary Badge</span>
<span className="badge-success">Success Badge</span>
<span className="badge-danger">Danger Badge</span>
```

**Input**
```tsx
<input className="input-base" placeholder="Type here..." />
```

**Utilities**
```tsx
<div className="flex-center">Centered content</div>
<div className="flex-between">Space-between flex</div>
<div className="transition-smooth">Smooth transition</div>
```

## 🔄 Migration Steps (For Existing Components)

### Step 1: Add TypeScript Types
```tsx
// Before (JSX)
const TaskItem = ({ task, onDelete }) => { ... }

// After (TSX)
interface TaskItemProps {
  task: Task;
  onDelete: (taskId: string) => void;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, onDelete }) => { ... }
```

### Step 2: Replace CSS with Tailwind
```tsx
// Before (CSS Module)
import styles from './TaskItem.module.css'
<div className={styles.container}>

// After (Tailwind)
<div className="bg-white rounded-xl p-4 shadow-md hover:shadow-lg">
```

### Step 3: Add Framer Motion
```tsx
// Before (No animation)
<div>{taskList}</div>

// After (Staggered animation)
<motion.div variants={containerVariants} initial="hidden" animate="visible">
  {taskList.map((task) => (
    <motion.div key={task.id} variants={itemVariants}>
      <TaskItem task={task} />
    </motion.div>
  ))}
</motion.div>
```

## 🎯 Implementation Checklist

### Phase 1: Setup (Complete ✅)
- [x] Install Framer Motion
- [x] Install Tailwind CSS + dependencies
- [x] Create tailwind.config.js with Shakti colors
- [x] Create global.css with Tailwind directives
- [x] Create TypeScript configuration
- [x] Add custom hooks

### Phase 2: Core Components (In Progress 🔄)
- [x] Create DashboardRefactored.tsx
- [x] Create TaskItemRefactored.tsx
- [x] Create MotionComponents.tsx
- [ ] Create NavbarRefactored.tsx
- [ ] Create CreateTaskModalRefactored.tsx
- [ ] Create ProfileAvatarRefactored.tsx
- [ ] Create ProfileDropdownRefactored.tsx

### Phase 3: Additional Components (To Start ⏳)
- [ ] Create GlassmorphismCard.tsx
- [ ] Create AnimatedButton.tsx
- [ ] Create SearchInput.tsx (with glassmorphism)
- [ ] Create KeyboardShortcutHelper.tsx
- [ ] Create ThemeToggle.tsx (Dark mode)

### Phase 4: Integration
- [ ] Update App.jsx to route to DashboardRefactored
- [ ] Update all routes to new components
- [ ] Test responsive behavior on mobile
- [ ] Test animations on low-end devices
- [ ] Implement dark mode toggle

### Phase 5: Refinement
- [ ] Optimize animation performance
- [ ] Add loading skeletons with Framer
- [ ] Add error states with animations
- [ ] Fine-tune Bento grid responsiveness
- [ ] Add page transitions

## 📊 Design Tokens

Available in `tailwind.config.js`:

**Colors**
- `primary-*` (50-950): Orange shades
- `secondary-*` (50-950): Teal shades
- Standard Tailwind colors (gray, white, black)

**Spacing**
- `space-*` (0-96): Standard spacing scale
- `gap-*`: Gap utilities

**Typography**
- `font-black` (900)
- `font-extrabold` (800)
- `font-bold` (700)
- `font-semibold` (600)
- `font-medium` (500)

**Border Radius**
- `rounded-md` (12px)
- `rounded-xl` (16px)
- `rounded-2xl` (24px)
- `rounded-3xl` (32px)

**Shadows**
- `shadow-sm` to `shadow-2xl`
- `shadow-glass` (glassmorphism)

**Backdrop Blur**
- `backdrop-blur-sm` (4px)
- `backdrop-blur` (8px)
- `backdrop-blur-xl` (20px)

## 🎓 Learning Resources

### Component Structure Template
```tsx
import React from 'react';
import { motion } from 'framer-motion';
import { containerVariants, itemVariants } from './MotionComponents';

interface ComponentProps {
  prop1: string;
  prop2: number;
  onAction: (id: string) => void;
}

const MyComponent: React.FC<ComponentProps> = ({ prop1, prop2, onAction }) => {
  return (
    <motion.div
      className="card-glass p-6 rounded-2xl"
      variants={itemVariants}
      layout
    >
      <h3 className="text-lg font-black tracking-tight">{prop1}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{prop2}</p>
      
      <motion.button
        className="btn-primary mt-4"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => onAction(prop1)}
      >
        Action
      </motion.button>
    </motion.div>
  );
};

export default MyComponent;
```

### Common Pitfalls

1. **Too much animation** - Not every element needs animation; be selective
2. **Poor contrast** - Glassmorphism can reduce text readability; ensure proper contrast
3. **Layout shift** - Use `layout` prop in Framer Motion to prevent layout thrashing
4. **Performance** - Test animations on actual devices; reduce motion for accessibility
5. **Dark mode** - Always test with `dark:*` classes in dark mode

## 🚀 Preview & Testing

To see the refactored components:

1. Update `App.jsx` to import and render `DashboardRefactored` instead of `Dashboard`
2. Run `npm run dev` from `/client` directory
3. Open `http://localhost:5173` in browser
4. Test keyboard shortcuts: `⌘K`, `⌘N`
5. Try sidebar toggle and task interactions
6. Resize window to test responsive behavior

## 📝 Related Files Structure

```
client/
├── src/
│   ├── pages/
│   │   ├── Dashboard.jsx (original)
│   │   ├── DashboardRefactored.tsx ✨
│   │   └── ...
│   ├── components/
│   │   ├── TaskItem.jsx (original)
│   │   ├── TaskItemRefactored.tsx ✨
│   │   ├── MotionComponents.tsx ✨
│   │   └── ...
│   ├── hooks/
│   │   └── useCustomHooks.ts ✨
│   ├── types/
│   │   └── index.ts ✨
│   ├── global.css ✨
│   └── main.jsx
├── tailwind.config.js ✨
├── postcss.config.js ✨
└── tsconfig.json ✨
```

---

**Version**: 1.0  
**Last Updated**: 2024  
**Status**: Implementation in progress  
**Target Components**: All frontend components

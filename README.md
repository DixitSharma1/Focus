# FocusList — Functional To-Do Application

A clean, accessible, production-grade task management application built with vanilla HTML, CSS, and JavaScript. No build step, no frameworks, no dependencies — just fast, reliable task management that works everywhere.

---

## Features

### Core Functionality
- **Create tasks** — Add tasks with a title and priority level (High / Medium / Low)
- **Edit tasks** — Inline editing with Enter to save, Escape to cancel
- **Complete tasks** — Toggle completion with keyboard and mouse support
- **Delete tasks** — Delete with an undo option (5-second window)
- **Clear completed** — Bulk-clear all completed tasks

### Search & Filtering
- **Live search** — Case-insensitive, whitespace-tolerant substring search
- **Status filter** — All / Active / Completed tabs
- **Priority filter** — Filter by High / Medium / Low from the sidebar
- Combined filters: all active simultaneously

### Task Statistics
- Total, Completed, and Pending counts update in real time
- Progress bar showing completion percentage

### Persistence
- Tasks saved to `localStorage` on every change
- Validated on load — survives browser restart and tab close
- Corrupt storage is cleared gracefully; user never sees a crash

### Accessibility
- WCAG 2.2 AA-level practices throughout
- Full keyboard navigation (see Keyboard Shortcuts below)
- ARIA live regions for screen-reader announcements
- Visible focus states on all interactive elements
- Skip-to-main-content link
- `prefers-reduced-motion` respected

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `N` | Focus the task input |
| `/` | Focus the search bar |
| `?` | Open the shortcuts dialog |
| `1` | Switch to "All" tasks |
| `2` | Switch to "Active" tasks |
| `3` | Switch to "Completed" tasks |
| `Enter` | Add task / save inline edit |
| `Esc` | Cancel edit / close dialog |
| `←` / `→` | Navigate between status tabs |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Markup | HTML5 (semantic, accessible) |
| Styles | CSS3 (custom properties, grid, flexbox) |
| Logic | Vanilla JavaScript (ES2020, no frameworks) |
| Fonts | Inter + JetBrains Mono (Google Fonts) |
| Storage | localStorage |
| Build | None — ships as-is |

---

## Architecture

```
focuslist/
├── index.html   — Document structure, ARIA landmarks, modal
├── style.css    — Design tokens, component styles, responsive layout
├── app.js       — Application logic (see section breakdown below)
└── README.md
```

### app.js Structure

| Section | Responsibility |
|---------|---------------|
| Constants & Config | Storage keys, limits, priority/status enumerations |
| State | Single source of truth object (tasks, filters, search, undo) |
| Data Persistence | `loadTasks()` / `saveTasks()` with error recovery |
| Security & Validation | `sanitiseText()`, `escapeHtml()`, `validateTitle()`, `normaliseTask()` |
| Task CRUD | `addTask`, `toggleTask`, `updateTask`, `deleteTask`, `clearCompleted` |
| Undo / Restore | `undoDelete()` with 5-second undo window |
| Filtering & Search | `getVisibleTasks()` — composable, no side effects |
| DOM Rendering | `render()`, `renderProgress()`, `renderStats()`, `renderTasks()` |
| Toast Notifications | Non-blocking toasts with optional action buttons |
| Accessibility Helpers | `announce()`, `showInputError()`, `clearInputError()` |
| Modal | `openShortcutsModal()` / `closeShortcutsModal()` with focus trap |
| Event Binding | `bindEvents()` — event delegation, zero memory leaks |
| Keyboard Shortcuts | `bindKeyboardShortcuts()` — global hotkeys, input-safe |
| Initialisation | `DOMContentLoaded` — load → bind → render |

---

## Accessibility

- **Semantic HTML**: `<header>`, `<main>`, `<aside>`, `<nav>`, `<footer>`, `<form>`, `<time>`
- **ARIA roles**: `role="list"`, `role="listitem"`, `role="tab"`, `role="tablist"`, `role="dialog"`, `role="status"`, `role="alert"`, `role="progressbar"`
- **ARIA attributes**: `aria-label`, `aria-pressed`, `aria-selected`, `aria-invalid`, `aria-live`, `aria-controls`, `aria-modal`, `aria-valuenow/min/max`
- **Focus management**: Modal traps focus; focus restores to trigger on close
- **Screen reader announcements**: Task add / complete / delete / rename events
- **Keyboard navigation**: Every interactive element reachable and operable via keyboard
- **Touch targets**: Minimum 44×44px tap targets (expanded via `::before` pseudo-element)
- **Colour contrast**: All text meets WCAG AA contrast ratios
- **Forced colours**: `forced-colors: active` media query for Windows High Contrast
- **Reduced motion**: Animations disabled when `prefers-reduced-motion: reduce`

---

## Security

- **No `innerHTML` with raw user data** — task titles pass through `escapeHtml()` before any HTML insertion
- **No `dangerouslySetInnerHTML`** — not applicable (vanilla JS)
- **localStorage validation** — every loaded object is normalised through `normaliseTask()` which checks types and whitelists priority values
- **Corrupt storage recovery** — `JSON.parse` errors are caught; storage is cleared and the app starts fresh
- **Input length capping** — 200-character server-side-style cap enforced in `sanitiseText()` before storage
- **Type coercion** — all field types are explicitly coerced to prevent prototype pollution via `String()`, `Boolean()`, `Number()` coercions

---

## Performance

- **No build step** — zero bundler overhead; files served directly
- **Single render pass** — `renderTasks()` does one `innerHTML` assignment (no per-item DOM operations)
- **`contain: layout style`** — CSS containment on task items limits reflow scope
- **`will-change: width`** — progress bar fill promoted to GPU layer for smooth transitions
- **Font preconnect** — `<link rel="preconnect">` for Google Fonts reduces TTFB
- **No unused dependencies** — zero npm packages
- **Debouncing** — search filters synchronously (dataset is small); no unnecessary timers
- **Event delegation** — one listener on the task list, not per-item

### Core Web Vitals targets
| Metric | Target |
|--------|--------|
| LCP | < 1.5s (no images, no render-blocking resources) |
| INP | < 100ms (synchronous event handlers, minimal DOM work) |
| CLS | 0 (no layout-shifting elements; stat values use `min-width`) |

---

## Data Persistence

Tasks are stored as a JSON array in `localStorage` under the key `focuslist_v2_tasks`.

### Task shape
```json
{
  "id":       1720000000000123,
  "title":    "Review pull request",
  "priority": "High",
  "done":     false,
  "created":  "2025-01-15T10:30:00.000Z",
  "updated":  null
}
```

### Recovery behaviour
If stored JSON is corrupt or invalid:
1. `JSON.parse` error is caught silently
2. `localStorage.removeItem` is called to clear the bad data
3. The app initialises with an empty task list
4. The user is not shown a technical error message

---

## Installation

No build step required.

```bash
# Clone or download the repository
git clone <your-repo-url>
cd focuslist

# Option 1: Open directly in browser
open index.html

# Option 2: Serve locally (any static server)
npx serve .
# or
python3 -m http.server 8080
```

Then open `http://localhost:8080` (or the appropriate port).

---

## Development

Since this is a zero-dependency, no-build project, development is:

1. Edit `index.html`, `style.css`, or `app.js`
2. Reload the browser
3. No compilation, no bundling, no waiting

### Recommended tools
- **Browser DevTools** — Elements, Console, Accessibility tree, Lighthouse
- **Live Server** (VS Code extension) — Auto-reload on file save
- **axe DevTools** (browser extension) — Automated accessibility testing

---

## Testing

### Manual test checklist

**Task Creation**
- [ ] Can add a task with a title
- [ ] Cannot add an empty task (validation message shown)
- [ ] Enter key submits the form
- [ ] Input clears after successful submission
- [ ] Focus returns to input after add

**Task Editing**
- [ ] Click Edit (pencil icon) enters inline edit mode
- [ ] Enter saves the edit
- [ ] Escape cancels without saving
- [ ] Blur (clicking away) saves the edit
- [ ] Saving an empty title cancels the edit

**Task Completion**
- [ ] Clicking the checkbox toggles completion
- [ ] Completed tasks show strikethrough and reduced opacity
- [ ] Stats and progress update immediately
- [ ] Screen reader announces the change

**Task Deletion**
- [ ] Delete (×) removes the task
- [ ] Undo toast appears with 5-second window
- [ ] Clicking "Undo" restores the task at its original position

**Search**
- [ ] Typing in search filters tasks in real time
- [ ] Search is case-insensitive
- [ ] Clear (×) button clears the search and shows all tasks
- [ ] "No matching tasks" empty state shown when no results

**Filters**
- [ ] All / Active / Completed tabs work correctly
- [ ] Priority filter (All / High / Medium / Low) works correctly
- [ ] Filters compose (status + priority + search all apply simultaneously)

**Persistence**
- [ ] Tasks survive page refresh
- [ ] Tasks survive closing and re-opening the tab
- [ ] Clearing localStorage and refreshing shows empty state

**Accessibility**
- [ ] Tab through all interactive elements — every one is reachable
- [ ] Keyboard shortcuts (N, /, ?, 1, 2, 3) all work
- [ ] Modal focus trap works (Tab cycles within dialog)
- [ ] Escape closes modal
- [ ] Skip link is visible on focus

**Responsive**
- [ ] Layout adapts at 768px (sidebar stacks above main)
- [ ] Layout adapts at 480px (form stacks vertically)
- [ ] No horizontal overflow at any breakpoint
- [ ] Touch targets are large enough on mobile

---

## Browser Support

| Browser | Status |
|---------|--------|
| Chrome 90+ | ✅ Full support |
| Firefox 88+ | ✅ Full support |
| Safari 14+ | ✅ Full support |
| Edge 90+ | ✅ Full support |
| Mobile Chrome | ✅ Full support |
| Mobile Safari (iOS 14+) | ✅ Full support |

---

## Project Structure

```
focuslist/
├── index.html          — App shell and static markup
│   ├── Header          — Logo, date, shortcuts button
│   ├── Skip link       — Accessibility
│   ├── Toast container — Notification area
│   ├── Modal           — Keyboard shortcuts dialog
│   ├── Sidebar         — Progress, stats, priority filters
│   └── Main panel      — Form, search, tabs, task list
│
├── style.css           — All styles (tokens → reset → components → responsive)
│   ├── Design tokens   — :root CSS custom properties
│   ├── Reset           — Normalised base styles
│   ├── Accessibility   — sr-only, skip link, focus-visible
│   ├── Layout          — App shell, header, sidebar/panel grid
│   ├── Components      — Progress, stats, filters, form, search, tabs, tasks, toasts, modal
│   └── Responsive      — Tablet (≤800px), mobile (≤480px)
│
├── app.js              — Application logic
│   ├── State           — Single source of truth
│   ├── Persistence     — localStorage load/save
│   ├── Security        — Sanitisation, escaping, validation
│   ├── CRUD            — Task operations
│   ├── Undo            — Delete undo stack
│   ├── Filtering       — Composable filter + search
│   ├── Rendering       — DOM updates
│   ├── Toasts          — Notification system
│   ├── Accessibility   — ARIA helpers
│   ├── Modal           — Focus management
│   └── Shortcuts       — Keyboard hotkeys
│
└── README.md           — This file
```

---

## Design Decisions

**Why vanilla JS?**
The spec requires a frontend-only implementation with no backend. Vanilla JS eliminates build complexity, reduces bundle size to near zero, and demonstrates deep platform knowledge. For a Todo app, a framework would add hundreds of KB for no user benefit.

**Why `innerHTML` for the task list?**
Single-pass rendering via one `innerHTML` assignment is measurably faster for list updates than per-item DOM operations. The risk (XSS) is mitigated by `escapeHtml()` applied to every user-supplied value before insertion.

**Why no debounce on search?**
With an in-memory dataset (localStorage), filtering is sub-millisecond. Debouncing would add latency without any performance benefit.

**Why `contain: layout style` on task items?**
CSS containment tells the browser that layout changes inside a task item don't affect elements outside it, enabling more efficient repaints when toggling completion or editing.

**Why not use `<dialog>` for the modal?**
`<dialog>` has improved support but still has inconsistencies in some mobile browsers. The manual modal implementation provides identical behaviour everywhere and gives full control over the focus trap.

---

## Future Improvements

- Drag-and-drop task reordering
- Due dates with overdue highlighting
- Tags / categories
- Dark/light mode toggle
- Export tasks as CSV or JSON
- Subtasks
- Recurring tasks
- Sync via a backend API (would require server component)

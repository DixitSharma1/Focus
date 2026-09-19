/**
 * FocusList — app.js
 *
 * Architecture:
 *   1. Constants & Config
 *   2. State Management
 *   3. Data Persistence (localStorage with error handling)
 *   4. Security (input sanitization)
 *   5. Core Task Operations (CRUD)
 *   6. Filtering & Search
 *   7. DOM Rendering
 *   8. Accessibility (ARIA, announcements)
 *   9. Event Binding
 *  10. Initialisation
 */

/* ============================================================
   1. CONSTANTS & CONFIG
   ============================================================ */
const STORAGE_KEY   = 'focuslist_tasks';
const MAX_TITLE_LEN = 200;
const PRIORITIES    = ['High', 'Medium', 'Low'];
const STATUSES      = ['All', 'Active', 'Completed'];

/* ============================================================
   2. STATE
   ============================================================ */
const state = {
  tasks:        [],
  statusFilter: 'All',
  prioFilter:   'All',
};

/* ============================================================
   3. DATA PERSISTENCE
   ============================================================ */

/**
 * Load tasks from localStorage.
 * Validates that persisted data is an array of valid task objects.
 * Falls back to empty array on any error (corrupt data, parse failure).
 * @returns {Array}
 */
function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Validate & sanitize each persisted task
    return parsed
      .filter(t => t && typeof t === 'object')
      .map(t => ({
        id:      typeof t.id === 'number' ? t.id : Date.now(),
        title:   sanitizeText(String(t.title || '').slice(0, MAX_TITLE_LEN)),
        priority: PRIORITIES.includes(t.priority) ? t.priority : 'Medium',
        done:    Boolean(t.done),
        created: typeof t.created === 'string' ? t.created : new Date().toISOString(),
      }))
      .filter(t => t.title.length > 0); // drop blank titles
  } catch {
    // Corrupt localStorage — clear and start fresh
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    return [];
  }
}

/**
 * Persist tasks to localStorage with graceful error handling
 * (e.g. private browsing quota exceeded).
 */
function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
  } catch (err) {
    console.warn('FocusList: Could not save to localStorage.', err);
  }
}

/* ============================================================
   4. SECURITY — INPUT SANITIZATION
   ============================================================ */

/**
 * Strip HTML/script-injection characters from user input.
 * Uses the browser's own text node for reliable encoding.
 * @param {string} str
 * @returns {string}
 */
function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  // Trim and enforce length cap
  return str.trim().slice(0, MAX_TITLE_LEN);
}

/**
 * Escape a string for safe insertion into innerHTML.
 * Prevents XSS when rendering task titles.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#x27;');
}

/**
 * Validate task title before saving.
 * @param {string} title
 * @returns {{ valid: boolean, message: string }}
 */
function validateTitle(title) {
  if (!title || title.length === 0) {
    return { valid: false, message: 'Task title cannot be empty.' };
  }
  if (title.length > MAX_TITLE_LEN) {
    return { valid: false, message: `Title must be ${MAX_TITLE_LEN} characters or fewer.` };
  }
  return { valid: true, message: '' };
}

/* ============================================================
   5. CORE TASK OPERATIONS (CRUD)
   ============================================================ */

/** Generate a unique numeric ID using timestamp + random suffix. */
function generateId() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

/** Add a new task to state and persist. */
function addTask(rawTitle, priority) {
  const title = sanitizeText(rawTitle);
  const validation = validateTitle(title);

  if (!validation.valid) {
    showInputError(validation.message);
    return false;
  }

  clearInputError();

  const task = {
    id:       generateId(),
    title,
    priority: PRIORITIES.includes(priority) ? priority : 'Medium',
    done:     false,
    created:  new Date().toISOString(),
  };

  state.tasks.unshift(task);
  saveTasks();
  announce(`Task "${title}" added.`);
  return true;
}

/** Toggle a task's completion status. */
function toggleTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.done = !task.done;
  saveTasks();
  announce(task.done ? `"${task.title}" marked complete.` : `"${task.title}" marked incomplete.`);
}

/** Update a task's title. */
function updateTask(id, rawTitle) {
  const title = sanitizeText(rawTitle);
  const validation = validateTitle(title);
  if (!validation.valid) return false;

  const task = state.tasks.find(t => t.id === id);
  if (!task) return false;

  task.title = title;
  saveTasks();
  announce(`Task renamed to "${title}".`);
  return true;
}

/** Remove a task by id. */
function deleteTask(id) {
  const task = state.tasks.find(t => t.id === id);
  const title = task ? task.title : '';
  state.tasks = state.tasks.filter(t => t.id !== id);
  saveTasks();
  if (title) announce(`Task "${title}" deleted.`);
}

/* ============================================================
   6. FILTERING & SEARCH
   ============================================================ */

/** Return the subset of tasks that match all active filters. */
function getVisibleTasks() {
  const query = getEl('searchInput').value.trim().toLowerCase();

  return state.tasks.filter(task => {
    // Status filter
    if (state.statusFilter === 'Active'    &&  task.done) return false;
    if (state.statusFilter === 'Completed' && !task.done) return false;

    // Priority filter
    if (state.prioFilter !== 'All' && task.priority !== state.prioFilter) return false;

    // Search query (case-insensitive substring)
    if (query && !task.title.toLowerCase().includes(query)) return false;

    return true;
  });
}

/* ============================================================
   7. DOM RENDERING
   ============================================================ */

/** Tiny selector helper — avoids repeated document.getElementById. */
function getEl(id) { return document.getElementById(id); }

/** Update the three statistic counters. */
function renderStats() {
  const total = state.tasks.length;
  const done  = state.tasks.filter(t => t.done).length;
  getEl('statTotal').textContent = total;
  getEl('statDone').textContent  = done;
  getEl('statPend').textContent  = total - done;
}

/** Render the task list based on current state & filters. */
function renderTasks() {
  const list    = getEl('taskList');
  const visible = getVisibleTasks();

  if (visible.length === 0) {
    const msg = state.tasks.length === 0
      ? 'Add your first task above.'
      : 'No tasks match your current filters.';

    list.innerHTML = `
      <div class="empty-state" role="status">
        <div class="empty-icon" aria-hidden="true">✦</div>
        <p class="empty-msg">${escapeHtml(msg)}</p>
      </div>`;
    return;
  }

  // Build HTML string — single innerHTML assignment for performance
  list.innerHTML = visible.map(task => {
    const escapedTitle   = escapeHtml(task.title);
    const isDone         = task.done;
    const checkLabel     = isDone ? 'Mark incomplete' : 'Mark complete';
    const checkClass     = isDone ? 'check-btn checked' : 'check-btn';
    const itemClass      = isDone ? 'task-item done' : 'task-item';

    return `
      <div
        class="${itemClass}"
        data-id="${task.id}"
        data-priority="${escapeHtml(task.priority)}"
        role="listitem"
      >
        <button
          class="${checkClass}"
          data-action="toggle"
          aria-label="${checkLabel}: ${escapedTitle}"
          aria-pressed="${isDone}"
          type="button"
        >
          <span class="tick" aria-hidden="true">✓</span>
        </button>

        <div class="task-body">
          <div class="task-title" id="title-${task.id}">${escapedTitle}</div>
          <div class="task-meta" aria-label="Priority: ${escapeHtml(task.priority)}">
            <span class="priority-badge badge-${escapeHtml(task.priority)}" aria-hidden="true">
              ${escapeHtml(task.priority)}
            </span>
          </div>
        </div>

        <div class="task-actions" role="group" aria-label="Actions for ${escapedTitle}">
          <button
            class="icon-btn edit"
            data-action="edit"
            aria-label="Edit task: ${escapedTitle}"
            title="Edit"
            type="button"
          >✎</button>
          <button
            class="icon-btn del"
            data-action="delete"
            aria-label="Delete task: ${escapedTitle}"
            title="Delete"
            type="button"
          >✕</button>
        </div>
      </div>`;
  }).join('');
}

/** Full render pass — stats + tasks. */
function render() {
  renderStats();
  renderTasks();
}

/* ============================================================
   8. ACCESSIBILITY HELPERS
   ============================================================ */

/**
 * Post a screen-reader announcement via a live region.
 * @param {string} message
 */
function announce(message) {
  const el = getEl('srAnnounce');
  if (!el) return;
  el.textContent = '';
  // Force DOM mutation so assistive tech fires the event
  requestAnimationFrame(() => { el.textContent = message; });
}

/** Show inline validation error below the input. */
function showInputError(message) {
  const el    = getEl('inputError');
  const input = getEl('taskInput');
  if (el)    el.textContent = message;
  if (input) input.classList.add('error');
  if (input) input.setAttribute('aria-invalid', 'true');
}

/** Clear inline validation error. */
function clearInputError() {
  const el    = getEl('inputError');
  const input = getEl('taskInput');
  if (el)    el.textContent = '';
  if (input) input.classList.remove('error');
  if (input) input.removeAttribute('aria-invalid');
}

/* ============================================================
   9. EVENT BINDING
   ============================================================ */
function bindEvents() {

  /* ── Add Task ── */
  getEl('addBtn').addEventListener('click', handleAddTask);
  getEl('taskInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleAddTask();
  });
  getEl('taskInput').addEventListener('input', () => {
    if (getEl('taskInput').value.trim()) clearInputError();
  });

  /* ── Search ── */
  getEl('searchInput').addEventListener('input', render);

  /* ── Status Tabs ── */
  getEl('statusTabs').addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;

    state.statusFilter = btn.dataset.status;

    // Update active state + ARIA
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b === btn);
      b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
    });

    render();
  });

  /* ── Priority Filter Buttons ── */
  getEl('prioFilters').addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;

    state.prioFilter = btn.dataset.prio;

    document.querySelectorAll('.filter-btn').forEach(b => {
      b.classList.toggle('active', b === btn);
      b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
    });

    render();
  });

  /* ── Task List — event delegation ── */
  getEl('taskList').addEventListener('click', e => {
    const btn  = e.target.closest('[data-action]');
    if (!btn) return;

    const item = btn.closest('.task-item');
    if (!item) return;

    const id     = Number(item.dataset.id);
    const action = btn.dataset.action;

    if (action === 'toggle') { toggleTask(id); render(); }
    if (action === 'edit')   { startInlineEdit(id); }
    if (action === 'delete') { deleteTask(id); render(); }
  });

  /* ── Keyboard navigation within task list ── */
  getEl('taskList').addEventListener('keydown', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    // Allow Enter and Space to trigger buttons (redundant for <button> but explicit)
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      btn.click();
    }
  });
}

/* ── Add Task Handler ── */
function handleAddTask() {
  const input    = getEl('taskInput');
  const rawTitle = input.value;
  const priority = getEl('prioSelect').value;

  const success = addTask(rawTitle, priority);
  if (success) {
    render();
    input.value = '';
    input.focus();
  } else {
    input.focus();
  }
}

/* ── Inline Edit ── */
function startInlineEdit(id) {
  const task    = state.tasks.find(t => t.id === id);
  if (!task) return;

  const titleEl = document.querySelector(`.task-item[data-id="${id}"] .task-title`);
  if (!titleEl) return;

  const editInput = document.createElement('input');
  editInput.type      = 'text';
  editInput.className = 'task-edit-input';
  editInput.value     = task.title;
  editInput.maxLength = MAX_TITLE_LEN;
  editInput.setAttribute('aria-label', `Edit task: ${task.title}`);

  titleEl.replaceWith(editInput);
  editInput.focus();
  editInput.select();

  let committed = false;

  function commit() {
    if (committed) return;
    committed = true;
    const success = updateTask(id, editInput.value);
    if (!success) {
      // Revert on invalid input
      announce('Edit cancelled — title cannot be empty.');
    }
    render();
  }

  function cancel() {
    if (committed) return;
    committed = true;
    render();
  }

  editInput.addEventListener('blur',    commit);
  editInput.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { editInput.blur(); }
    if (e.key === 'Escape') {
      editInput.removeEventListener('blur', commit);
      cancel();
    }
  });
}

/* ============================================================
   10. INITIALISATION
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {

  // Set header date
  const dateEl = getEl('headerDate');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    });
    dateEl.setAttribute('datetime', new Date().toISOString().split('T')[0]);
  }

  // Load persisted data into state
  state.tasks = loadTasks();

  // Bind all UI events
  bindEvents();

  // Initial render
  render();
});

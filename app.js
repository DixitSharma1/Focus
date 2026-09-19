/**
 * FocusList — app.js
 *
 * A production-grade, accessible, vanilla-JS Todo application.
 *
 * Architecture:
 *   1.  Constants & Config
 *   2.  State
 *   3.  Data Persistence (localStorage, safe)
 *   4.  Security & Validation (input sanitization, XSS prevention)
 *   5.  Task CRUD Operations
 *   6.  Undo / Restore
 *   7.  Filtering & Search
 *   8.  DOM Rendering
 *   9.  Toast Notifications
 *  10.  Accessibility (ARIA, focus management, announcements)
 *  11.  Modal (keyboard shortcuts)
 *  12.  Event Binding
 *  13.  Keyboard Shortcuts
 *  14.  Initialisation
 */

/* ============================================================
   1. CONSTANTS & CONFIG
   ============================================================ */
const STORAGE_KEY   = 'focuslist_v2_tasks';
const MAX_TITLE_LEN = 200;
const PRIORITIES    = ['High', 'Medium', 'Low'];
const STATUSES      = ['All', 'Active', 'Completed'];

/** How many ms to show the undo toast before auto-dismissing */
const UNDO_TIMEOUT_MS = 5000;

/** How many ms before a toast auto-dismisses (non-undo) */
const TOAST_TIMEOUT_MS = 3000;

/* ============================================================
   2. STATE
   ============================================================ */
const state = {
  tasks:        [],
  statusFilter: 'All',
  prioFilter:   'All',
  searchQuery:  '',

  /**
   * Undo stack — stores the last deleted task so it can be restored.
   * @type {{ task: TaskObject, index: number } | null}
   */
  undoItem: null,
};

/* ============================================================
   3. DATA PERSISTENCE
   ============================================================ */

/**
 * Load tasks from localStorage.
 * Validates the stored structure; recovers gracefully on any error.
 * @returns {TaskObject[]}
 */
function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(t => t && typeof t === 'object')
      .map(normaliseTask)
      .filter(t => t !== null && t.title.length > 0);
  } catch {
    /* Corrupt storage — clear and start fresh */
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage unavailable */ }
    return [];
  }
}

/**
 * Persist the current task list.
 * Fails silently (e.g. private browsing quota exceeded).
 */
function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
  } catch (err) {
    console.warn('[FocusList] Could not persist to localStorage.', err);
    showToast('Changes could not be saved — storage may be full.', 'error');
  }
}

/* ============================================================
   4. SECURITY & VALIDATION
   ============================================================ */

/**
 * Sanitise user input: trim whitespace and cap length.
 * Uses only textContent-equivalent — no innerHTML risk.
 * @param {unknown} value
 * @returns {string}
 */
function sanitiseText(value) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, MAX_TITLE_LEN);
}

/**
 * Escape a string for safe insertion into innerHTML.
 * Prevents XSS when rendering task content.
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
 * Validate a task title.
 * @param {string} title — already sanitised
 * @returns {{ valid: boolean, message: string }}
 */
function validateTitle(title) {
  if (!title) return { valid: false, message: 'Task title cannot be empty.' };
  if (title.length > MAX_TITLE_LEN) {
    return { valid: false, message: `Title must be ${MAX_TITLE_LEN} characters or fewer.` };
  }
  return { valid: true, message: '' };
}

/**
 * Normalise a raw object from localStorage into a valid task.
 * Returns null if the object is fundamentally invalid.
 * @param {unknown} raw
 * @returns {TaskObject | null}
 */
function normaliseTask(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    id:       typeof raw.id === 'number' ? raw.id : generateId(),
    title:    sanitiseText(String(raw.title || '')),
    priority: PRIORITIES.includes(raw.priority) ? raw.priority : 'Medium',
    done:     Boolean(raw.done),
    created:  typeof raw.created === 'string' ? raw.created : new Date().toISOString(),
    updated:  typeof raw.updated === 'string' ? raw.updated : null,
  };
}

/* ============================================================
   5. TASK CRUD
   ============================================================ */

/** Generate a collision-resistant numeric ID. */
function generateId() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

/**
 * Add a new task.
 * @param {string} rawTitle
 * @param {string} priority
 * @returns {boolean} success
 */
function addTask(rawTitle, priority) {
  const title = sanitiseText(rawTitle);
  const { valid, message } = validateTitle(title);

  if (!valid) {
    showInputError(message);
    return false;
  }

  clearInputError();

  /** @type {TaskObject} */
  const task = {
    id:       generateId(),
    title,
    priority: PRIORITIES.includes(priority) ? priority : 'Medium',
    done:     false,
    created:  new Date().toISOString(),
    updated:  null,
  };

  state.tasks.unshift(task);
  saveTasks();
  announce(`Task "${title}" added.`);
  return true;
}

/**
 * Toggle a task between complete and incomplete.
 * @param {number} id
 */
function toggleTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.done    = !task.done;
  task.updated = new Date().toISOString();
  saveTasks();
  announce(task.done
    ? `"${task.title}" marked complete.`
    : `"${task.title}" marked active.`
  );
}

/**
 * Update a task's title (and touch updated timestamp).
 * @param {number} id
 * @param {string} rawTitle
 * @returns {boolean} success
 */
function updateTask(id, rawTitle) {
  const title = sanitiseText(rawTitle);
  const { valid } = validateTitle(title);
  if (!valid) return false;

  const task = state.tasks.find(t => t.id === id);
  if (!task) return false;

  task.title   = title;
  task.updated = new Date().toISOString();
  saveTasks();
  announce(`Task renamed to "${title}".`);
  return true;
}

/**
 * Delete a task and offer an undo action.
 * @param {number} id
 */
function deleteTask(id) {
  const index = state.tasks.findIndex(t => t.id === id);
  if (index === -1) return;

  const task = state.tasks[index];

  /* Store for potential undo */
  state.undoItem = { task: { ...task }, index };

  state.tasks.splice(index, 1);
  saveTasks();

  showToast(
    `"${task.title}" deleted.`,
    'default',
    { label: 'Undo', action: undoDelete }
  );
}

/**
 * Delete all completed tasks.
 */
function clearCompleted() {
  const completed = state.tasks.filter(t => t.done);
  if (!completed.length) return;
  state.tasks = state.tasks.filter(t => !t.done);
  saveTasks();
  announce(`${completed.length} completed task${completed.length > 1 ? 's' : ''} cleared.`);
  render();
}

/* ============================================================
   6. UNDO / RESTORE
   ============================================================ */

/** Restore the last deleted task from the undo stack. */
function undoDelete() {
  if (!state.undoItem) return;
  const { task, index } = state.undoItem;
  state.tasks.splice(index, 0, task);
  state.undoItem = null;
  saveTasks();
  announce(`"${task.title}" restored.`);
  render();
  showToast(`"${task.title}" restored.`, 'success');
}

/* ============================================================
   7. FILTERING & SEARCH
   ============================================================ */

/**
 * Return the visible subset of tasks matching all active filters.
 * @returns {TaskObject[]}
 */
function getVisibleTasks() {
  const query = state.searchQuery;

  return state.tasks.filter(task => {
    /* Status filter */
    if (state.statusFilter === 'Active'    &&  task.done) return false;
    if (state.statusFilter === 'Completed' && !task.done) return false;

    /* Priority filter */
    if (state.prioFilter !== 'All' && task.priority !== state.prioFilter) return false;

    /* Full-text search — case-insensitive, trim-tolerant */
    if (query && !task.title.toLowerCase().includes(query)) return false;

    return true;
  });
}

/* ============================================================
   8. DOM RENDERING
   ============================================================ */

/** @param {string} id @returns {HTMLElement} */
const $ = id => document.getElementById(id);

/** Render the progress bar and percentage. */
function renderProgress() {
  const total = state.tasks.length;
  const done  = state.tasks.filter(t => t.done).length;
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100);

  const fill = $('progressFill');
  const bar  = $('progressBar');
  const pctEl = $('progressPct');

  if (fill)  fill.style.width = `${pct}%`;
  if (bar)   bar.setAttribute('aria-valuenow', String(pct));
  if (pctEl) pctEl.textContent = `${pct}%`;
}

/** Render the three stat counters. */
function renderStats() {
  const total = state.tasks.length;
  const done  = state.tasks.filter(t => t.done).length;
  $('statTotal').textContent = total;
  $('statDone').textContent  = done;
  $('statPend').textContent  = total - done;
}

/** Show or hide "Clear Completed" button. */
function renderClearBtn() {
  const hasCompleted = state.tasks.some(t => t.done);
  const btn = $('clearCompleted');
  if (btn) {
    if (hasCompleted) btn.removeAttribute('hidden');
    else              btn.setAttribute('hidden', '');
  }
}

/**
 * Render the task list.
 * Uses a single innerHTML assignment for DOM performance.
 */
function renderTasks() {
  const list    = $('taskList');
  const visible = getVisibleTasks();

  /* Update list summary */
  const summary = $('listSummary');
  if (summary) {
    if (visible.length === 0) {
      summary.textContent = '';
    } else {
      summary.textContent = `${visible.length} task${visible.length > 1 ? 's' : ''}`;
      if (state.statusFilter !== 'All' || state.prioFilter !== 'All' || state.searchQuery) {
        summary.textContent += ' matched';
      }
    }
  }

  if (visible.length === 0) {
    const isEmpty = state.tasks.length === 0;
    list.innerHTML = `
      <div class="empty-state" role="status" aria-label="${isEmpty ? 'No tasks yet' : 'No tasks match filters'}">
        <span class="empty-icon" aria-hidden="true">${isEmpty ? '✦' : '⊘'}</span>
        <p class="empty-title">${isEmpty ? 'Nothing to focus on yet' : 'No matching tasks'}</p>
        <p class="empty-msg">${isEmpty
          ? 'Add your first task above to get started.'
          : 'Try adjusting your filters or search query.'}</p>
      </div>`;
    return;
  }

  list.innerHTML = visible.map(task => {
    const et        = escapeHtml(task.title);
    const ep        = escapeHtml(task.priority);
    const isDone    = task.done;
    const checkCls  = isDone ? 'check-btn checked' : 'check-btn';
    const itemCls   = isDone ? 'task-item done' : 'task-item';
    const created   = task.created
      ? new Date(task.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '';

    return `
      <div
        class="${itemCls}"
        data-id="${task.id}"
        data-priority="${ep}"
        role="listitem"
      >
        <button
          class="${checkCls}"
          data-action="toggle"
          aria-label="${isDone ? 'Mark incomplete' : 'Mark complete'}: ${et}"
          aria-pressed="${isDone}"
          type="button"
        ><span class="tick" aria-hidden="true">✓</span></button>

        <div class="task-body">
          <div class="task-title" id="title-${task.id}">${et}</div>
          <div class="task-meta">
            <span class="priority-badge badge-${ep}" aria-label="Priority: ${ep}">${ep}</span>
            ${created ? `<time class="task-created" datetime="${task.created}" aria-label="Added ${created}">${created}</time>` : ''}
          </div>
        </div>

        <div class="task-actions" role="group" aria-label="Task actions for ${et}">
          <button
            class="icon-btn edit"
            data-action="edit"
            aria-label="Edit: ${et}"
            title="Edit (Enter)"
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
              <path d="M11.5 2.5l2 2-7.5 7.5-2.5.5.5-2.5 7.5-7.5z"/>
            </svg>
          </button>
          <button
            class="icon-btn del"
            data-action="delete"
            aria-label="Delete: ${et}"
            title="Delete"
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
              <path d="M3 3l10 10M13 3L3 13"/>
            </svg>
          </button>
        </div>
      </div>`;
  }).join('');
}

/** Full render pass. */
function render() {
  renderProgress();
  renderStats();
  renderClearBtn();
  renderTasks();
}

/* ============================================================
   9. TOAST NOTIFICATIONS
   ============================================================ */

/** @type {Map<HTMLElement, number>} Active toast → timer ID */
const _toastTimers = new Map();

/**
 * Show a toast notification, optionally with an action button.
 * @param {string} message
 * @param {'default'|'success'|'error'} type
 * @param {{ label: string, action: () => void } | null} actionBtn
 */
function showToast(message, type = 'default', actionBtn = null) {
  const container = $('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');

  const msgSpan = document.createElement('span');
  msgSpan.textContent = message;
  toast.appendChild(msgSpan);

  if (actionBtn) {
    const btn = document.createElement('button');
    btn.className   = 'toast-undo';
    btn.type        = 'button';
    btn.textContent = actionBtn.label;
    btn.addEventListener('click', () => {
      dismissToast(toast);
      actionBtn.action();
    });
    toast.appendChild(btn);
  }

  container.appendChild(toast);

  const timeout = actionBtn ? UNDO_TIMEOUT_MS : TOAST_TIMEOUT_MS;
  const timer   = window.setTimeout(() => dismissToast(toast), timeout);
  _toastTimers.set(toast, timer);
}

/** @param {HTMLElement} toast */
function dismissToast(toast) {
  const timer = _toastTimers.get(toast);
  if (timer) { clearTimeout(timer); _toastTimers.delete(toast); }

  toast.classList.add('leaving');
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
}

/* ============================================================
   10. ACCESSIBILITY HELPERS
   ============================================================ */

/**
 * Post a screen-reader announcement via an assertive live region.
 * Clears and re-sets so repeated messages still fire.
 * @param {string} message
 */
function announce(message) {
  const el = $('srAnnounce');
  if (!el) return;
  el.textContent = '';
  requestAnimationFrame(() => { el.textContent = message; });
}

/** @param {string} message */
function showInputError(message) {
  const el    = $('inputError');
  const input = $('taskInput');
  if (el)    el.textContent = message;
  if (input) {
    input.classList.add('error');
    input.setAttribute('aria-invalid', 'true');
  }
}

function clearInputError() {
  const el    = $('inputError');
  const input = $('taskInput');
  if (el)    el.textContent = '';
  if (input) {
    input.classList.remove('error');
    input.removeAttribute('aria-invalid');
  }
}

/* ============================================================
   11. MODAL — KEYBOARD SHORTCUTS
   ============================================================ */

/** Element that triggered the modal (for focus restoration). */
let _modalTrigger = null;

function openShortcutsModal(trigger) {
  const modal = $('shortcutsModal');
  if (!modal) return;
  _modalTrigger = trigger || null;
  modal.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';

  /* Move focus into modal */
  const closeBtn = $('shortcutsClose');
  if (closeBtn) closeBtn.focus();
}

function closeShortcutsModal() {
  const modal = $('shortcutsModal');
  if (!modal) return;
  modal.setAttribute('hidden', '');
  document.body.style.overflow = '';

  /* Restore focus */
  if (_modalTrigger) { _modalTrigger.focus(); _modalTrigger = null; }
}

/* Trap focus inside modal while open */
function trapFocus(e) {
  const modal = $('shortcutsModal');
  if (!modal || modal.hasAttribute('hidden')) return;

  const focusable = Array.from(
    modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
  );
  if (!focusable.length) return;

  const first = focusable[0];
  const last  = focusable[focusable.length - 1];

  if (e.key === 'Tab') {
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
  }
}

/* ============================================================
   12. EVENT BINDING
   ============================================================ */
function bindEvents() {

  /* ── Add Task Form (native submit) ── */
  $('addForm').addEventListener('submit', e => {
    e.preventDefault();
    handleAddTask();
  });

  /* Clear error on input */
  $('taskInput').addEventListener('input', () => {
    if ($('taskInput').value.trim()) clearInputError();
  });

  /* ── Search ── */
  const searchInput = $('searchInput');
  const searchClear = $('searchClear');

  searchInput.addEventListener('input', () => {
    state.searchQuery = searchInput.value.trim().toLowerCase();
    /* Show/hide clear button */
    if (state.searchQuery) {
      searchClear.removeAttribute('hidden');
    } else {
      searchClear.setAttribute('hidden', '');
    }
    render();
  });

  searchClear.addEventListener('click', () => {
    searchInput.value   = '';
    state.searchQuery   = '';
    searchClear.setAttribute('hidden', '');
    searchInput.focus();
    render();
  });

  /* ── Status Tabs ── */
  $('statusTabs').addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    state.statusFilter = btn.dataset.status;
    document.querySelectorAll('.tab-btn').forEach(b => {
      const active = b === btn;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', String(active));
    });
    render();
  });

  /* Keyboard: arrow keys between tabs */
  $('statusTabs').addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const tabs  = Array.from(document.querySelectorAll('.tab-btn'));
    const curr  = tabs.indexOf(document.activeElement);
    if (curr === -1) return;
    const next  = e.key === 'ArrowRight'
      ? (curr + 1) % tabs.length
      : (curr - 1 + tabs.length) % tabs.length;
    tabs[next].focus();
    tabs[next].click();
  });

  /* ── Priority Filters ── */
  $('prioFilters').addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    state.prioFilter = btn.dataset.prio;
    document.querySelectorAll('.filter-btn').forEach(b => {
      const active = b === btn;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    render();
  });

  /* ── Clear Completed ── */
  $('clearCompleted').addEventListener('click', clearCompleted);

  /* ── Task List — event delegation ── */
  $('taskList').addEventListener('click', e => {
    const btn  = e.target.closest('[data-action]');
    if (!btn)  return;
    const item = btn.closest('.task-item');
    if (!item) return;
    const id     = Number(item.dataset.id);
    const action = btn.dataset.action;

    if (action === 'toggle') { toggleTask(id); render(); }
    if (action === 'edit')   { startInlineEdit(id); }
    if (action === 'delete') { deleteTask(id); render(); }
  });

  /* ── Shortcuts Modal ── */
  [$('shortcutsBtn'), $('shortcutsBtnFooter')].forEach(btn => {
    if (!btn) return;
    btn.addEventListener('click', () => openShortcutsModal(btn));
  });

  $('shortcutsClose').addEventListener('click', closeShortcutsModal);

  $('shortcutsModal').addEventListener('click', e => {
    if (e.target === $('shortcutsModal')) closeShortcutsModal();
  });

  /* Focus trap in modal */
  document.addEventListener('keydown', trapFocus);

  /* Esc to close modal */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const modal = $('shortcutsModal');
      if (modal && !modal.hasAttribute('hidden')) closeShortcutsModal();
    }
  });
}

/* ── Add Task Handler ── */
function handleAddTask() {
  const input    = $('taskInput');
  const priority = $('prioSelect').value;

  const success = addTask(input.value, priority);
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
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  const titleEl = document.querySelector(`.task-item[data-id="${id}"] .task-title`);
  if (!titleEl) return;

  const editInput = document.createElement('input');
  editInput.type      = 'text';
  editInput.className = 'task-edit-input';
  editInput.value     = task.title;
  editInput.maxLength = MAX_TITLE_LEN;
  editInput.setAttribute('aria-label', `Edit task: ${task.title}`);
  editInput.setAttribute('aria-describedby', 'task-hint');

  titleEl.replaceWith(editInput);
  editInput.focus();
  editInput.select();

  let committed = false;

  function commit() {
    if (committed) return;
    committed = true;
    const success = updateTask(id, editInput.value);
    if (!success) {
      announce('Edit cancelled — title cannot be empty.');
    }
    render();
  }

  function cancel() {
    if (committed) return;
    committed = true;
    announce('Edit cancelled.');
    render();
  }

  editInput.addEventListener('blur', commit);
  editInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      editInput.removeEventListener('blur', commit);
      commit();
    }
    if (e.key === 'Escape') {
      editInput.removeEventListener('blur', commit);
      cancel();
    }
  });
}

/* ============================================================
   13. KEYBOARD SHORTCUTS
   ============================================================ */
function bindKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    /* Skip when typing in an input/textarea */
    const tag = document.activeElement?.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;

    /* Skip when modal is open */
    const modal = $('shortcutsModal');
    if (modal && !modal.hasAttribute('hidden')) return;

    switch (e.key) {
      case 'n':
      case 'N':
        e.preventDefault();
        $('taskInput').focus();
        break;

      case '/':
        e.preventDefault();
        $('searchInput').focus();
        break;

      case '?':
        openShortcutsModal($('shortcutsBtn'));
        break;

      case '1':
        activateStatusTab('All');
        break;
      case '2':
        activateStatusTab('Active');
        break;
      case '3':
        activateStatusTab('Completed');
        break;
    }
  });
}

/**
 * Programmatically activate a status tab.
 * @param {string} status
 */
function activateStatusTab(status) {
  const btn = document.querySelector(`.tab-btn[data-status="${status}"]`);
  if (btn) btn.click();
}

/* ============================================================
   14. INITIALISATION
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {

  /* Set header date */
  const dateEl = $('headerDate');
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    });
    dateEl.setAttribute('datetime', now.toISOString().split('T')[0]);
  }

  /* Load & initialise */
  state.tasks = loadTasks();

  bindEvents();
  bindKeyboardShortcuts();
  render();

  /* Auto-focus task input on desktop */
  if (window.innerWidth >= 768) {
    $('taskInput').focus();
  }
});

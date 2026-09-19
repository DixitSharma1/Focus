/* ============================================
   FocusList — app.js
   Frontend To-Do Application
   ============================================ */

// ── STATE ──
let tasks        = JSON.parse(localStorage.getItem('focuslist_tasks') || '[]');
let statusFilter = 'All';
let prioFilter   = 'All';


// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  setDate();
  bindEvents();
  render();
});


// ── DATE ──
function setDate() {
  const el = document.getElementById('headerDate');
  if (!el) return;
  el.textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  });
}


// ── BIND EVENTS ──
function bindEvents() {
  // Add task button
  document.getElementById('addBtn').addEventListener('click', addTask);

  // Enter key on task input
  document.getElementById('taskInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') addTask();
  });

  // Live search
  document.getElementById('searchInput').addEventListener('input', render);

  // Status tabs
  document.getElementById('statusTabs').addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    statusFilter = btn.dataset.status;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    render();
  });

  // Priority filters
  document.getElementById('prioFilters').addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    prioFilter = btn.dataset.prio;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    render();
  });

  // Task list delegation (check / edit / delete)
  document.getElementById('taskList').addEventListener('click', e => {
    const checkBtn = e.target.closest('.check-btn');
    const editBtn  = e.target.closest('.icon-btn.edit');
    const delBtn   = e.target.closest('.icon-btn.del');

    if (checkBtn) {
      const id = getTaskId(checkBtn);
      if (id !== null) toggleTask(id);
    } else if (editBtn) {
      const id = getTaskId(editBtn);
      if (id !== null) startEdit(id);
    } else if (delBtn) {
      const id = getTaskId(delBtn);
      if (id !== null) deleteTask(id);
    }
  });
}


// ── HELPERS ──
function getTaskId(el) {
  const item = el.closest('.task-item');
  return item ? Number(item.dataset.id) : null;
}

function save() {
  localStorage.setItem('focuslist_tasks', JSON.stringify(tasks));
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


// ── ADD TASK ──
function addTask() {
  const input = document.getElementById('taskInput');
  const title = input.value.trim();
  if (!title) { input.focus(); return; }

  const priority = document.getElementById('prioSelect').value;

  tasks.unshift({
    id:       Date.now(),
    title,
    priority,
    done:     false,
    created:  new Date().toISOString()
  });

  save();
  render();
  input.value = '';
  input.focus();
}


// ── TOGGLE COMPLETE ──
function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.done = !task.done;
  save();
  render();
}


// ── DELETE TASK ──
function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  save();
  render();
}


// ── EDIT TASK (inline) ──
function startEdit(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const titleEl = document.querySelector(`.task-item[data-id="${id}"] .task-title`);
  if (!titleEl) return;

  // Replace title with input
  const input = document.createElement('input');
  input.className = 'task-edit-input';
  input.value = task.title;
  titleEl.replaceWith(input);
  input.focus();
  input.select();

  function commit() {
    const newTitle = input.value.trim();
    if (newTitle) task.title = newTitle;
    save();
    render();
  }

  function cancel() {
    input.removeEventListener('blur', commit);
    render();
  }

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { input.blur(); }
    if (e.key === 'Escape') { cancel(); }
  });
}


// ── UPDATE STATS ──
function updateStats() {
  const total = tasks.length;
  const done  = tasks.filter(t => t.done).length;
  document.getElementById('statTotal').textContent = total;
  document.getElementById('statDone').textContent  = done;
  document.getElementById('statPend').textContent  = total - done;
}


// ── RENDER ──
function render() {
  updateStats();

  const query = document.getElementById('searchInput').value.trim().toLowerCase();

  const visible = tasks.filter(task => {
    if (statusFilter === 'Active'    &&  task.done) return false;
    if (statusFilter === 'Completed' && !task.done) return false;
    if (prioFilter !== 'All' && task.priority !== prioFilter) return false;
    if (query && !task.title.toLowerCase().includes(query)) return false;
    return true;
  });

  const list = document.getElementById('taskList');

  if (visible.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✦</div>
        <div class="empty-msg">
          ${tasks.length === 0
            ? 'Add your first task above.'
            : 'No tasks match your current filters.'}
        </div>
      </div>`;
    return;
  }

  list.innerHTML = visible.map(task => `
    <div class="task-item ${task.done ? 'done' : ''}" data-id="${task.id}" data-priority="${task.priority}">
      <button
        class="check-btn ${task.done ? 'checked' : ''}"
        aria-label="${task.done ? 'Mark incomplete' : 'Mark complete'}"
        title="${task.done ? 'Mark incomplete' : 'Mark complete'}"
      >
        <span class="tick">✓</span>
      </button>

      <div class="task-body">
        <div class="task-title">${escHtml(task.title)}</div>
        <div class="task-meta">
          <span class="priority-badge badge-${task.priority}">${task.priority}</span>
        </div>
      </div>

      <div class="task-actions">
        <button class="icon-btn edit" aria-label="Edit task" title="Edit">✎</button>
        <button class="icon-btn del"  aria-label="Delete task" title="Delete">✕</button>
      </div>
    </div>
  `).join('');
}

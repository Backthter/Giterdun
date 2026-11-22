import { store } from './store.js';

/* ================= constants ================= */
const STATUSES = [
  { key: 'researching', label: 'Researching', emoji: '🔍' },
  { key: 'preparing', label: 'Preparing', emoji: '✍️' },
  { key: 'submitted', label: 'Submitted', emoji: '📨' },
  { key: 'interview', label: 'Interview', emoji: '🗣️' },
  { key: 'offer', label: 'Offer / Accepted', emoji: '🎉' },
  { key: 'rejected', label: 'Not this time', emoji: '🌧️' },
];
const STATUS = Object.fromEntries(STATUSES.map((s) => [s.key, s]));
const OPEN_STATUSES = ['researching', 'preparing'];
const SENT_STATUSES = ['submitted', 'interview', 'offer'];
const KINDS = {
  job: { label: 'Job', emoji: '💼' },
  masters: { label: 'Masters', emoji: '🎓' },
  other: { label: 'Other', emoji: '✨' },
};
const NOTE_COLORS = ['#fff3a8', '#ffd6e0', '#d4f0ff', '#d9f7d6', '#eadcff', '#ffe2c2'];
const SWATCHES = ['#e07a8b', '#6c9bd2', '#e9a23b', '#5fb49c', '#9b7fd1', '#d9775a', '#4f8a8b', '#c06c84'];
const PLANT = [
  { min: 0, emoji: '🌰' },
  { min: 1, emoji: '🌱' },
  { min: 3, emoji: '🌿' },
  { min: 6, emoji: '🪴' },
  { min: 9, emoji: '🌷' },
  { min: 13, emoji: '🌻' },
];
const CHEERS = [
  "You've got this. One small step today is still a step.",
  'Proud of you for showing up, even on the slow days.',
  'Rejections are just redirections. Keep going!',
  'Drink some water, then go crush that application.',
  'Future you is going to be so grateful.',
  "We're doing this together, every single deadline.",
  'Your best is enough. Seriously.',
  'Hit submit. Then celebrate. In that order.',
  "Every 'no' gets you closer to the 'yes'.",
  'Tiny progress is still progress 🐢',
  'Done is better than perfect. Send it!',
  "Look how far you've already come.",
];
const DEFAULTS = {
  names: { a: 'Rubs', b: 'Me' },
  focus: { a: 'Jobs', b: 'Masters' },
  colors: { a: '#e07a8b', b: '#6c9bd2' },
  emoji: { a: '💼', b: '🎓' },
};

/* ================= helpers ================= */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => ymd(new Date());
const parseDay = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const daysUntil = (s) => Math.round((parseDay(s) - parseDay(todayStr())) / 864e5);
const fmtDay = (s, opts = { weekday: 'short', month: 'short', day: 'numeric' }) => parseDay(s).toLocaleDateString(undefined, opts);
const relDays = (n) =>
  n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : n > 0 ? `in ${n} days` : `${-n} days ago`;
const timeAgo = (ms) => {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
};
const hash = (s) => {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
};
const byType = (type, owners) => store.all(type).filter((i) => !owners || owners.includes(i.owner));
const empty = (msg) => `<p class="empty">${msg}</p>`;
const lsGet = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const lsSet = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function S() {
  const d = store.get('settings')?.data || {};
  return {
    names: { ...DEFAULTS.names, ...d.names },
    focus: { ...DEFAULTS.focus, ...d.focus },
    colors: { ...DEFAULTS.colors, ...d.colors },
    emoji: { ...DEFAULTS.emoji, ...d.emoji },
  };
}
const nameOf = (o) => (o === 'shared' ? 'Both of us' : S().names[o]);
const colorOf = (o) => (o === 'shared' ? 'var(--together)' : S().colors[o]);
const otherOf = (o) => (o === 'a' ? 'b' : 'a');

/* ================= ui state ================= */
const ui = {
  route: 'together',
  todoFilter: {},
  cal: {},
  calCfg: {},
  arranging: false,
  selected: null,
  modal: null,
  pending: false,
  me: lsGet('giterdun-me'),
};

function parseRoute() {
  const r = location.hash.replace(/^#\/?/, '');
  return ['a', 'b', 'together'].includes(r) ? r : ui.me || 'together';
}

/* ================= rendering ================= */
let raf = 0;
function scheduleRender() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    render();
  });
}
function isEditing() {
  const a = document.activeElement;
  return !!(a && a.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea') && a.closest('#view, #modal'));
}
function render(force = false) {
  if (!force && isEditing()) {
    ui.pending = true;
    return;
  }
  ui.pending = false;
  const s = S();
  document.documentElement.style.setProperty('--accent', ui.route === 'together' ? 'var(--together)' : s.colors[ui.route]);
  document.title = ui.route === 'together' ? 'Giterdun · Together' : `Giterdun · ${s.names[ui.route]}`;
  $('#nav').innerHTML = navHTML();
  $('#view').innerHTML = ui.route === 'together' ? togetherView() : personalView(ui.route);
  renderStickers();
  renderModal();
  renderDrawer();
}
document.addEventListener('focusout', () =>
  setTimeout(() => {
    if (ui.pending && !isEditing()) render();
  }, 0)
);
// After a form submit we re-render immediately and put the cursor back in the same form.
function refocus(key) {
  render(true);
  if (key) $(`form[data-key="${key}"] [name=text]`)?.focus();
}

function navHTML() {
  const s = S();
  const tab = (o) =>
    `<a class="tab ${ui.route === o ? 'on' : ''}" href="#/${o}" style="--tab:${o === 'together' ? 'var(--together)' : s.colors[o]}">${
      o === 'together' ? '💞 Together' : `${esc(s.emoji[o])} ${esc(s.names[o])}`
    }</a>`;
  return `<a class="logo" href="#/together">Giterdun<span>.</span></a>
    <div class="tabs">${tab('a')}${tab('together')}${tab('b')}</div>
    <div class="nav-tools">
      <button type="button" class="btn ghost ${ui.arranging ? 'on' : ''}" data-act="toggleArrange">✨ Stickers</button>
      <button type="button" class="btn ghost icon" data-act="openSettings" aria-label="Settings">⚙️</button>
    </div>`;
}

const stat = (n, label, cls = '') => `<div class="stat ${cls}"><b>${n}</b><span>${label}</span></div>`;

function greeting(o) {
  const h = new Date().getHours();
  const hi = h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return `${hi}, ${esc(S().names[o])}. ${CHEERS[hash(todayStr() + o) % CHEERS.length]}`;
}

/* ---------- personal page ---------- */
function personalView(o) {
  const s = S();
  const t = todayStr();
  const open = byType('todo', [o]).filter((x) => !x.data.done);
  const dueToday = open.filter((x) => x.data.due && x.data.due <= t).length;
  const projects = byType('project', [o]);
  const active = projects.filter((p) => OPEN_STATUSES.includes(p.data.status)).length;
  const sent = projects.filter((p) => SENT_STATUSES.includes(p.data.status)).length;
  return `
  <header class="page-head">
    <p class="kicker">${esc(s.emoji[o])} ${esc(s.focus[o])} applications</p>
    <h1>${esc(s.names[o])}'s board</h1>
    <p class="sub">${greeting(o)}</p>
    <div class="stats">
      ${stat(open.length, 'open tasks')}${stat(dueToday, 'due today or late', dueToday ? 'warn' : '')}${stat(active, 'in progress')}${stat(sent, 'sent off')}
    </div>
  </header>
  <div class="grid">
    ${projectsSection(o)}
    ${todosSection({ owners: [o], addOwner: o, key: 'todo-' + o, title: 'To-dos', cls: 'span-2' })}
    ${countdownSection({ owners: [o, 'shared'], addOwner: o, key: 'cd-' + o })}
    ${calendarSection({ owners: [o, 'shared'], addOwner: o, key: 'cal-' + o, cls: 'span-2' })}
    ${cheersForYou(o)}
    ${notesSection({ owner: o, cls: 'span-3' })}
  </div>`;
}

/* ---------- together page ---------- */
function togetherView() {
  const s = S();
  const hf = store.get('highfives')?.data.count || 0;
  return `
  <header class="page-head together-head">
    <p class="kicker">Team ${esc(s.names.a)} &amp; ${esc(s.names.b)}</p>
    <h1>We're in this together</h1>
    <p class="sub">${CHEERS[hash(todayStr()) % CHEERS.length]}</p>
    <button type="button" class="btn big" data-act="highFive">🙌 High five! <span class="hf-count">${hf}</span></button>
  </header>
  <div class="grid">
    ${gardenSection()}
    ${winsSection()}
    ${pipelineSection()}
    ${countdownSection({ owners: ['a', 'b', 'shared'], addOwner: 'shared', key: 'cd-shared', showOwner: true })}
    ${cheerSection()}
    ${calendarSection({ owners: ['a', 'b', 'shared'], addOwner: 'shared', key: 'cal-shared', cls: 'span-2' })}
    ${todosSection({ owners: ['shared'], addOwner: 'shared', key: 'todo-shared', title: 'Shared to-dos' })}
    ${notesSection({ owner: 'shared', cls: 'span-3', title: 'Shared notes' })}
  </div>`;
}

/* ---------- projects (applications) ---------- */
function projectStats(p) {
  const ts = byType('todo').filter((t) => t.data.projectId === p.id);
  const done = ts.filter((t) => t.data.done).length;
  return { total: ts.length, done, pct: ts.length ? Math.round((done / ts.length) * 100) : 0 };
}
function projectCard(p) {
  const d = p.data;
  const st = STATUS[d.status] || STATUS.researching;
  const k = KINDS[d.kind] || KINDS.other;
  const { total, done, pct } = projectStats(p);
  const n = d.deadline ? daysUntil(d.deadline) : null;
  const dl =
    d.deadline != null && d.deadline !== ''
      ? `<span class="chip due ${n < 0 && OPEN_STATUSES.includes(d.status) ? 'late' : n <= 7 && n >= 0 ? 'today' : ''}">📌 ${fmtDay(d.deadline)} · ${relDays(n)}</span>`
      : '';
  return `<div class="proj s-${esc(d.status)}" role="button" tabindex="0" data-act="openProject" data-id="${p.id}">
    <span class="proj-kind">${k.emoji} ${esc(d.org || k.label)}</span>
    <strong class="proj-name">${esc(d.name)}</strong>
    <span class="status">${st.emoji} ${st.label}</span>
    ${dl}
    <span class="bar" aria-hidden="true"><i style="width:${pct}%"></i></span>
    <small class="muted">${total ? `${done}/${total} tasks done` : 'No tasks yet'}</small>
  </div>`;
}
function projectsSection(o) {
  const order = (p) => STATUSES.findIndex((s) => s.key === p.data.status);
  const list = byType('project', [o]).sort(
    (a, b) => order(a) - order(b) || (a.data.deadline || '9999').localeCompare(b.data.deadline || '9999')
  );
  return `<section class="card span-3 projects">
    <div class="card-head"><h2>Applications</h2><small class="muted">Each one gets its own tasks, deadline and notes</small></div>
    <div class="proj-grid">
      ${list.map(projectCard).join('')}
      <button type="button" class="proj add" data-act="newProject" data-owner="${o}">＋<span>New application</span></button>
    </div>
  </section>`;
}
function projectModal(id, owner) {
  const p = id ? store.get(id) : null;
  if (id && !p) return null;
  const own = p?.owner || owner;
  const d =
    p?.data || { status: 'researching', kind: /master/i.test(S().focus[own] || '') ? 'masters' : 'job' };
  const at = p ? `data-patch="${p.id}"` : '';
  const opt = (list, val) =>
    list.map(([k, label]) => `<option value="${k}" ${k === val ? 'selected' : ''}>${label}</option>`).join('');
  const fields = `<div class="form-grid">
      <label class="wide">Name<input name="name" value="${esc(d.name || '')}" placeholder="e.g. MSc Data Science, Junior Designer" required ${at}></label>
      <label>Company / university<input name="org" value="${esc(d.org || '')}" ${at}></label>
      <label>Location<input name="location" value="${esc(d.location || '')}" ${at}></label>
      <label>Type<select name="kind" ${at}>${opt(Object.entries(KINDS).map(([k, v]) => [k, `${v.emoji} ${v.label}`]), d.kind)}</select></label>
      <label>Status<select name="status" ${at}>${opt(STATUSES.map((s) => [s.key, `${s.emoji} ${s.label}`]), d.status)}</select></label>
      <label>Deadline<input type="date" name="deadline" value="${esc(d.deadline || '')}" ${at}></label>
      <label>Link<input type="url" name="link" value="${esc(d.link || '')}" placeholder="https://…" ${at}></label>
      <label class="wide">Notes<textarea name="notes" rows="4" placeholder="Requirements, contacts, what makes this one special…" ${at}>${esc(d.notes || '')}</textarea></label>
    </div>`;
  if (!p) {
    return `<p class="kicker">${esc(nameOf(own))} · new application</p><h2>What are you applying to?</h2>
      <form data-form="project" data-owner="${own}">${fields}<div class="row end"><button class="btn solid">Create</button></div></form>`;
  }
  const todos = byType('todo')
    .filter((t) => t.data.projectId === p.id)
    .sort((a, b) => a.data.done - b.data.done || (a.data.due || '9999').localeCompare(b.data.due || '9999'));
  const { pct } = projectStats(p);
  return `<p class="kicker">${esc(nameOf(own))} · ${KINDS[d.kind]?.emoji || ''} ${KINDS[d.kind]?.label || ''}</p>
    <h2>${esc(d.name)} ${d.link ? `<a class="ext" href="${esc(d.link)}" target="_blank" rel="noopener">open ↗</a>` : ''}</h2>
    <p class="muted small">Changes save automatically.</p>
    ${fields}
    <h3>Tasks for this application <small class="muted">${pct}% done</small></h3>
    <form class="add-row" data-form="todo" data-key="ptodo" data-owner="${own}" data-project="${p.id}">
      <input name="text" placeholder="e.g. Ask for reference letter" required>
      <input name="due" type="date" aria-label="Due date">
      <button class="btn">Add</button>
    </form>
    <ul class="todo-list">${todos.map((t) => todoLi(t, false, true)).join('') || '<li class="empty">No tasks yet. What needs doing?</li>'}</ul>
    <div class="row between"><button type="button" class="btn danger ghost" data-act="delProject" data-id="${p.id}">Delete application</button>
    <button type="button" class="btn solid" data-act="closeModal">Done</button></div>`;
}

/* ---------- to-dos ---------- */
function projectSelect(owner) {
  const ps = byType('project', owner === 'shared' ? ['a', 'b'] : [owner]);
  if (!ps.length) return '';
  return `<select name="projectId" aria-label="Application"><option value="">No application</option>${ps
    .map((p) => `<option value="${p.id}">${esc(p.data.name)}</option>`)
    .join('')}</select>`;
}
function todoLi(t, showOwner, inProject) {
  const p = !inProject && t.data.projectId && store.get(t.data.projectId);
  const d = t.data.due;
  const n = d ? daysUntil(d) : null;
  const dueCls = n === null || t.data.done ? '' : n < 0 ? 'late' : n === 0 ? 'today' : '';
  return `<li class="todo ${t.data.done ? 'done' : ''}">
    <button type="button" class="check" data-act="toggleTodo" data-id="${t.id}" aria-label="${t.data.done ? 'Mark not done' : 'Mark done'}">${t.data.done ? '✓' : ''}</button>
    <span class="t-text">${esc(t.data.text)}</span>
    <span class="t-meta">
      ${showOwner ? `<span class="who" style="--c:${colorOf(t.owner)}">${esc(nameOf(t.owner))}</span>` : ''}
      ${p ? `<button type="button" class="chip" data-act="openProject" data-id="${p.id}">${esc(p.data.name)}</button>` : ''}
      ${d ? `<span class="chip due ${dueCls}" title="${fmtDay(d)}">${relDays(n)}</span>` : ''}
    </span>
    <button type="button" class="x" data-act="del" data-id="${t.id}" aria-label="Delete">×</button>
  </li>`;
}
function todosSection({ owners, addOwner, key, title, cls = '', showOwner }) {
  const f = ui.todoFilter[key] || 'open';
  const t = todayStr();
  let list = byType('todo', owners);
  if (f === 'open') list = list.filter((x) => !x.data.done);
  if (f === 'today') list = list.filter((x) => !x.data.done && x.data.due && x.data.due <= t);
  if (f === 'done') list = list.filter((x) => x.data.done).sort((a, b) => (b.data.doneAt || 0) - (a.data.doneAt || 0)).slice(0, 40);
  else list.sort((a, b) => (a.data.due || '9999').localeCompare(b.data.due || '9999') || (a.data.createdAt || 0) - (b.data.createdAt || 0));
  const labels = { open: 'To do', today: 'Today', done: 'Done' };
  const msgs = { open: 'All clear! Treat yourself ☕', today: 'Nothing due today 🌤️', done: 'Nothing ticked off yet. You can do it!' };
  return `<section class="card todos ${cls}">
    <div class="card-head"><h2>${title}</h2>
      <div class="pills">${Object.keys(labels)
        .map((k) => `<button type="button" class="pill ${k === f ? 'on' : ''}" data-act="todoFilter" data-key="${key}" data-f="${k}">${labels[k]}</button>`)
        .join('')}</div>
    </div>
    <form class="add-row" data-form="todo" data-key="${key}" data-owner="${addOwner}">
      <input name="text" placeholder="Add a to-do…" required>
      <input name="due" type="date" aria-label="Due date">
      ${projectSelect(addOwner)}
      <button class="btn">Add</button>
    </form>
    <ul class="todo-list">${list.map((x) => todoLi(x, showOwner)).join('') || `<li class="empty">${msgs[f]}</li>`}</ul>
  </section>`;
}

/* ---------- countdowns ---------- */
function countdownSection({ owners, addOwner, key, showOwner, cls = '' }) {
  const list = [
    ...byType('countdown', owners).map((c) => ({ id: c.id, title: c.data.title, date: c.data.date, emoji: c.data.emoji || '⏳', owner: c.owner, own: true })),
    ...byType('project', owners)
      .filter((p) => p.data.deadline && OPEN_STATUSES.includes(p.data.status) && daysUntil(p.data.deadline) >= 0)
      .map((p) => ({ id: p.id, title: p.data.name, date: p.data.deadline, emoji: '📌', owner: p.owner, project: true })),
  ]
    .filter((x) => x.date && (daysUntil(x.date) >= 0 || x.own))
    .sort((a, b) => a.date.localeCompare(b.date));
  const card = (x) => {
    const n = daysUntil(x.date);
    const attrs = x.project ? `role="button" tabindex="0" data-act="openProject" data-id="${x.id}"` : '';
    return `<div class="cd ${n < 0 ? 'past' : n <= 3 ? 'soon' : ''}" style="--c:${colorOf(x.owner)}" ${attrs}>
      <div class="cd-num">${n < 0 ? '✔' : n === 0 ? '🎯' : n}</div>
      <div class="cd-body">
        <div class="cd-title">${esc(x.emoji)} ${esc(x.title)}</div>
        <div class="cd-date">${n < 0 ? 'passed' : n === 0 ? 'today!' : n === 1 ? 'day to go' : 'days to go'} · ${fmtDay(x.date)}${showOwner ? ` · ${esc(nameOf(x.owner))}` : ''}</div>
      </div>
      ${x.own ? `<button type="button" class="x" data-act="del" data-id="${x.id}" aria-label="Delete">×</button>` : ''}
    </div>`;
  };
  return `<section class="card countdowns ${cls}">
    <div class="card-head"><h2>Countdowns</h2></div>
    <div class="cd-list">${list.map(card).join('') || empty('No countdowns yet. Application deadlines show up here too.')}</div>
    <form class="add-row compact" data-form="countdown" data-key="${key}" data-owner="${addOwner}">
      <input name="emoji" value="⏳" maxlength="4" class="emoji-in" aria-label="Emoji">
      <input name="text" placeholder="Count down to…" required>
      <input name="date" type="date" required aria-label="Date">
      <button class="btn">Add</button>
    </form>
  </section>`;
}

/* ---------- calendar ---------- */
function entriesByDate(owners) {
  const map = {};
  const add = (date, e) => date && (map[date] ||= []).push(e);
  byType('event', owners).forEach((e) => add(e.data.date, { kind: 'event', id: e.id, owner: e.owner, emoji: '📅', label: e.data.title, time: e.data.time }));
  byType('project', owners).forEach((p) => add(p.data.deadline, { kind: 'project', id: p.id, owner: p.owner, emoji: '📌', label: p.data.name }));
  byType('countdown', owners).forEach((c) => add(c.data.date, { kind: 'countdown', id: c.id, owner: c.owner, emoji: c.data.emoji || '⏳', label: c.data.title }));
  byType('todo', owners).forEach((t) =>
    add(t.data.due, { kind: 'todo', id: t.id, owner: t.owner, emoji: t.data.done ? '✅' : '📝', label: t.data.text, done: t.data.done })
  );
  for (const k in map) map[k].sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  return map;
}
function calendarSection({ owners, addOwner, key, cls = '' }) {
  const now = new Date();
  const st = (ui.cal[key] ||= { y: now.getFullYear(), m: now.getMonth() });
  ui.calCfg[key] = { owners, addOwner };
  const first = new Date(st.y, st.m, 1);
  const daysIn = new Date(st.y, st.m + 1, 0).getDate();
  const t = todayStr();
  const map = entriesByDate(owners);
  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push('<div class="cday blank"></div>');
  for (let d = 1; d <= daysIn; d++) {
    const ds = `${st.y}-${pad(st.m + 1)}-${pad(d)}`;
    const es = map[ds] || [];
    cells.push(`<button type="button" class="cday ${ds === t ? 'today' : ''} ${ds < t ? 'pastday' : ''}" data-act="openDay" data-date="${ds}" data-key="${key}" aria-label="${fmtDay(ds)}, ${es.length} items">
      <span class="dnum">${d}</span>
      ${es
        .slice(0, 3)
        .map((e) => `<span class="cev ${e.done ? 'done' : ''}" style="--c:${colorOf(e.owner)}">${e.emoji}<em>${esc(e.label)}</em></span>`)
        .join('')}
      ${es.length > 3 ? `<span class="more">+${es.length - 3}</span>` : ''}
    </button>`);
  }
  return `<section class="card calendar ${cls}">
    <div class="card-head"><h2>${first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
      <div class="pills">
        <button type="button" class="pill" data-act="calMove" data-key="${key}" data-d="-1" aria-label="Previous month">‹</button>
        <button type="button" class="pill" data-act="calMove" data-key="${key}" data-d="0">Today</button>
        <button type="button" class="pill" data-act="calMove" data-key="${key}" data-d="1" aria-label="Next month">›</button>
      </div>
    </div>
    <div class="cal-grid">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => `<div class="dow">${d}</div>`).join('')}${cells.join('')}</div>
    <p class="muted small">Tap a day to add events, interviews or to-dos.</p>
  </section>`;
}
function ownerSelect(selected = 'shared') {
  const s = S();
  return `<select name="owner" aria-label="For whom">${[
    ['shared', 'Both of us'],
    ['a', s.names.a],
    ['b', s.names.b],
  ]
    .map(([v, l]) => `<option value="${v}" ${v === selected ? 'selected' : ''}>${esc(l)}</option>`)
    .join('')}</select>`;
}
function dayModal(date, key) {
  const { owners, addOwner } = ui.calCfg[key];
  const es = entriesByDate(owners)[date] || [];
  return `<p class="kicker">${relDays(daysUntil(date))}</p>
    <h2>${fmtDay(date, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
    <ul class="day-list">${
      es
        .map(
          (e) => `<li style="--c:${colorOf(e.owner)}" class="${e.done ? 'done' : ''}">
        <span>${e.emoji} ${esc(e.label)}${e.time ? ` <b>${esc(e.time)}</b>` : ''}</span>
        <small class="who" style="--c:${colorOf(e.owner)}">${esc(nameOf(e.owner))}</small>
        ${e.kind === 'project' ? `<button type="button" class="chip" data-act="openProject" data-id="${e.id}">open</button>` : ''}
        ${e.kind === 'todo' ? `<button type="button" class="chip" data-act="toggleTodo" data-id="${e.id}">${e.done ? 'undo' : 'done'}</button>` : ''}
        ${e.kind !== 'project' ? `<button type="button" class="x" data-act="del" data-id="${e.id}" aria-label="Delete">×</button>` : ''}
      </li>`
        )
        .join('') || '<li class="empty">Nothing planned. A free day! 🌈</li>'
    }</ul>
    <h3>Add to this day</h3>
    <form class="add-row" data-form="dayAdd" data-key="day" data-date="${date}" data-owner="${addOwner}">
      <select name="kind" aria-label="Kind"><option value="event">📅 Event / interview</option><option value="todo">📝 To-do</option></select>
      <input name="text" placeholder="What's happening?" required>
      <input name="time" type="time" aria-label="Time">
      ${addOwner === 'shared' ? ownerSelect() : ''}
      <button class="btn">Add</button>
    </form>`;
}

/* ---------- notes ---------- */
function noteHTML(n) {
  const rot = (hash(n.id) % 5) - 2;
  return `<div class="note" style="--bg:${esc(n.data.color || NOTE_COLORS[0])};--r:${rot}deg">
    <input class="note-title" data-live="${n.id}" name="title" value="${esc(n.data.title || '')}" placeholder="Title" aria-label="Note title">
    <textarea data-live="${n.id}" name="body" placeholder="Write anything…" aria-label="Note">${esc(n.data.body || '')}</textarea>
    <div class="note-foot">
      ${NOTE_COLORS.map((c) => `<button type="button" class="dot" style="background:${c}" data-act="noteColor" data-id="${n.id}" data-c="${c}" aria-label="Note colour"></button>`).join('')}
      <button type="button" class="x" data-act="del" data-id="${n.id}" aria-label="Delete note">×</button>
    </div>
  </div>`;
}
function notesSection({ owner, cls = '', title = 'Notes' }) {
  const notes = byType('note', [owner]).sort((a, b) => (b.data.createdAt || 0) - (a.data.createdAt || 0));
  return `<section class="card notes ${cls}">
    <div class="card-head"><h2>${title}</h2><button type="button" class="btn" data-act="addNote" data-owner="${owner}">＋ Sticky note</button></div>
    <div class="note-grid">${notes.map(noteHTML).join('') || empty('No notes yet. Brain-dump something!')}</div>
  </section>`;
}

/* ---------- together: garden, wins, pipeline, cheers ---------- */
function gardenSection() {
  const s = S();
  const week = Date.now() - 7 * 864e5;
  const plot = (o) => {
    const done = byType('todo').filter((t) => t.data.done && t.data.doneAt >= week && (t.data.doneBy || t.owner) === o).length;
    const stage = [...PLANT].reverse().find((p) => done >= p.min);
    const next = PLANT.find((p) => p.min > done);
    const stars = byType('project', [o]).filter((p) => SENT_STATUSES.includes(p.data.status));
    return `<div class="plot" style="--c:${s.colors[o]}">
      <div class="plant">${stage.emoji}</div>
      <strong>${esc(s.names[o])}</strong>
      <span>${done} task${done === 1 ? '' : 's'} this week</span>
      <small class="muted">${next ? `${next.min - done} more until ${next.emoji}` : 'Full bloom! 🌟'}</small>
      <div class="jar" title="Applications sent">${
        stars.map((p) => `<span title="${esc(p.data.name)}">${p.data.status === 'offer' ? '🏆' : '⭐'}</span>`).join('') || '<em>empty jar… for now</em>'
      }</div>
    </div>`;
  };
  return `<section class="card span-2 garden">
    <div class="card-head"><h2>Our little garden</h2><small class="muted">Plants grow with every task finished this week · a star for every application sent</small></div>
    <div class="plots">${plot('a')}<div class="plot-mid" aria-hidden="true">🤝</div>${plot('b')}</div>
  </section>`;
}
function winsSection() {
  const wins = [
    ...byType('todo')
      .filter((t) => t.data.done && t.data.doneAt)
      .map((t) => ({ at: t.data.doneAt, who: t.data.doneBy || t.owner, text: `ticked off “${esc(t.data.text)}”` })),
    ...byType('project', ['a', 'b'])
      .filter((p) => p.data.statusAt && SENT_STATUSES.includes(p.data.status))
      .map((p) => ({
        at: p.data.statusAt,
        who: p.owner,
        text: {
          submitted: `sent off <b>${esc(p.data.name)}</b> 📨`,
          interview: `got an interview for <b>${esc(p.data.name)}</b> 🗣️`,
          offer: `got an offer from <b>${esc(p.data.name)}</b> 🎉`,
        }[p.data.status],
      })),
  ]
    .sort((x, y) => y.at - x.at)
    .slice(0, 8);
  return `<section class="card wins">
    <div class="card-head"><h2>Recent wins</h2></div>
    <ul class="win-list">${
      wins
        .map((w) => `<li style="--c:${colorOf(w.who)}"><span><b class="who-name">${esc(w.who === 'shared' ? 'We' : nameOf(w.who))}</b> ${w.text}</span><small class="muted">${timeAgo(w.at)}</small></li>`)
        .join('') || '<li class="empty">Wins will show up here as you tick things off.</li>'
    }</ul>
  </section>`;
}
function pipelineSection() {
  const ps = byType('project', ['a', 'b']);
  const s = S();
  return `<section class="card span-3 pipeline">
    <div class="card-head"><h2>The pipeline</h2><small class="muted">Both of your applications · drag a card to move it along</small></div>
    <div class="kanban">${STATUSES.map((st) => {
      const col = ps.filter((p) => (p.data.status || 'researching') === st.key).sort((a, b) => (a.data.deadline || '9999').localeCompare(b.data.deadline || '9999'));
      return `<div class="kcol" data-drop="${st.key}">
        <h3>${st.emoji} ${st.label} <span class="count">${col.length}</span></h3>
        ${col
          .map(
            (p) => `<div class="kcard" draggable="true" data-drag="${p.id}" role="button" tabindex="0" data-act="openProject" data-id="${p.id}" style="--c:${s.colors[p.owner]}">
            <strong>${esc(p.data.name)}</strong>
            <small>${esc(s.names[p.owner])}${p.data.org ? ` · ${esc(p.data.org)}` : ''}${p.data.deadline ? ` · 📌 ${fmtDay(p.data.deadline, { month: 'short', day: 'numeric' })}` : ''}</small>
          </div>`
          )
          .join('')}
      </div>`;
    }).join('')}</div>
  </section>`;
}
function cheerHTML(c) {
  const s = S();
  const to = c.data.to === 'both' ? 'both of us' : s.names[c.data.to] || 'you';
  const rot = (hash(c.id) % 7) - 3;
  return `<div class="cheer" style="--bg:${esc(c.data.color)};--r:${rot}deg">
    <small>to ${esc(to)}</small>
    <p>${esc(c.data.text)}</p>
    <small class="from">— ${esc(s.names[c.data.from] || 'someone')} · ${timeAgo(c.data.createdAt)}</small>
    <button type="button" class="x" data-act="del" data-id="${c.id}" aria-label="Remove">×</button>
  </div>`;
}
const cheersSorted = () => byType('cheer').sort((a, b) => b.data.createdAt - a.data.createdAt);
function cheerSection() {
  const s = S();
  const to = ui.me ? otherOf(ui.me) : 'both';
  return `<section class="card span-2 cheers">
    <div class="card-head"><h2>Cheer wall 💌</h2><small class="muted">Leave each other little notes</small></div>
    <form class="add-row" data-form="cheer" data-key="cheer">
      <select name="to" aria-label="To">${[['a', s.names.a], ['b', s.names.b], ['both', 'Both of us']]
        .map(([v, l]) => `<option value="${v}" ${v === to ? 'selected' : ''}>To ${esc(l)}</option>`)
        .join('')}</select>
      <input name="text" placeholder="You're going to smash that interview…" required maxlength="200">
      <button type="button" class="btn ghost" data-act="randomCheer" title="Inspire me">✨</button>
      <button class="btn">Stick it</button>
    </form>
    <div class="cheer-grid">${cheersSorted().slice(0, 24).map(cheerHTML).join('') || empty('No notes yet. Be the first to say something nice!')}</div>
  </section>`;
}
function cheersForYou(o) {
  const list = cheersSorted().filter((c) => c.data.to === o || c.data.to === 'both').slice(0, 3);
  return `<section class="card cheers-mini">
    <div class="card-head"><h2>Notes for you 💌</h2></div>
    <div class="cheer-stack">${list.map(cheerHTML).join('') || empty(`Nothing yet. Leave a note for ${esc(S().names[otherOf(o)])} on the <a href="#/together">Together</a> page!`)}</div>
  </section>`;
}

/* ================= modal ================= */
function openModal(fn) {
  ui.modal = fn;
  renderModal();
  setTimeout(() => $('#modal .sheet input:not([type=hidden]), #modal .sheet select')?.focus(), 30);
}
function renderModal() {
  const m = $('#modal');
  const html = ui.modal?.();
  if (!html) {
    const wasOpen = !!m.innerHTML;
    ui.modal = null;
    m.innerHTML = '';
    document.body.classList.remove('modal-open');
    // Removing a focused input fires no focusout, so flush any render we deferred while typing.
    if (wasOpen && ui.pending) setTimeout(() => render(), 0);
    return;
  }
  document.body.classList.add('modal-open');
  const scroll = $('#modal .sheet')?.scrollTop || 0;
  m.innerHTML = `<div class="backdrop" data-act="closeModal"><div class="sheet" role="dialog" aria-modal="true">
    <button type="button" class="x close" data-act="closeModal" aria-label="Close">×</button>${html}</div></div>`;
  $('#modal .sheet').scrollTop = scroll;
}

/* ================= settings ================= */
function settingsModal(welcome) {
  const s = S();
  return `<h2>${welcome ? 'Welcome to Giterdun! 👋' : 'Settings'}</h2>
  ${welcome ? "<p>Let's set up who's who. You can change all of this later from ⚙️.</p>" : ''}
  <form data-form="settings" class="settings">
    ${['a', 'b']
      .map(
        (o) => `<fieldset style="--c:${s.colors[o]}"><legend>${o === 'a' ? 'Left tab' : 'Right tab'}</legend>
      <div class="form-grid">
        <label>Name<input name="name_${o}" value="${esc(s.names[o])}" required maxlength="20"></label>
        <label>Applying for<input name="focus_${o}" value="${esc(s.focus[o])}" placeholder="Jobs, Masters…" maxlength="30"></label>
        <label>Emoji<input name="emoji_${o}" value="${esc(s.emoji[o])}" maxlength="4" class="emoji-in"></label>
      </div>
      <div class="swatches" role="radiogroup" aria-label="Colour">${SWATCHES.map(
        (c) => `<label class="sw" style="--sw:${c}"><input type="radio" name="color_${o}" value="${c}" ${c === s.colors[o] ? 'checked' : ''}><span></span></label>`
      ).join('')}</div>
    </fieldset>`
      )
      .join('')}
    <fieldset><legend>This device belongs to…</legend>
      <div class="me-pick">${['a', 'b']
        .map((o) => `<label><input type="radio" name="me" value="${o}" ${ui.me === o ? 'checked' : ''} required> ${esc(s.names[o])}</label>`)
        .join('')}</div>
      <small class="muted">Opens your board first, and signs your cheers and wins.</small>
    </fieldset>
    <div class="row end"><button class="btn solid">Save</button></div>
  </form>
  <div class="settings-extra">
    <p class="mode">${
      store.mode === 'supabase'
        ? '☁️ Synced with Supabase. You both see the same planner, live.'
        : '💾 Saving to <b>this browser only</b>. Follow the README to connect Supabase so you two can share.'
    }</p>
    <div class="row">
      <button type="button" class="btn ghost" data-act="exportData">⬇ Download backup</button>
      <label class="btn ghost">⬆ Restore backup<input type="file" accept="application/json,.json" data-import hidden></label>
      ${store.mode === 'supabase' ? '<button type="button" class="btn ghost" data-act="signOut">Sign out</button>' : ''}
    </div>
  </div>`;
}

/* ================= stickers ================= */
let drag = null;
function renderStickers() {
  const layer = $('#stickers');
  layer.classList.toggle('arranging', ui.arranging);
  document.body.classList.toggle('arranging', ui.arranging);
  if (drag) return;
  const list = byType('sticker')
    .filter((s) => s.data.page === ui.route)
    .sort((a, b) => (a.data.z || 0) - (b.data.z || 0));
  layer.innerHTML = list
    .map((s) => {
      const sel = ui.arranging && ui.selected === s.id;
      return `<div class="sticker ${sel ? 'sel' : ''}" data-sticker="${s.id}" style="left:${s.data.x}%;top:${s.data.y}px;width:${s.data.w}px;--rot:${s.data.rot || 0}deg">
        <img src="${esc(s.data.src)}" alt="" draggable="false">
        ${
          sel
            ? `<div class="st-tools">
          <button type="button" data-act="stRot" data-id="${s.id}" data-d="-15" aria-label="Rotate left">⟲</button>
          <button type="button" data-act="stRot" data-id="${s.id}" data-d="15" aria-label="Rotate right">⟳</button>
          <button type="button" data-act="stSize" data-id="${s.id}" data-d="-20" aria-label="Smaller">−</button>
          <button type="button" data-act="stSize" data-id="${s.id}" data-d="20" aria-label="Bigger">＋</button>
          <button type="button" data-act="stFront" data-id="${s.id}" aria-label="Bring to front">⬆</button>
          <button type="button" data-act="del" data-id="${s.id}" aria-label="Remove sticker">🗑</button>
        </div>`
            : ''
        }
      </div>`;
    })
    .join('');
}
function renderDrawer() {
  const dr = $('#drawer');
  if (!ui.arranging) {
    dr.hidden = true;
    dr.innerHTML = '';
    return;
  }
  dr.hidden = false;
  const lib = byType('stickerlib').sort((a, b) => (a.data.createdAt || 0) - (b.data.createdAt || 0));
  dr.innerHTML = `<div class="drawer-head">
      <strong>Sticker book</strong>
      <span class="muted small">Tap a sticker to stick it on this page · drag to move · tap one on the page to rotate, resize or remove</span>
      <label class="btn">⬆ Upload PNGs<input type="file" accept="image/png,image/webp,image/gif,image/jpeg" multiple data-upload hidden></label>
      <button type="button" class="btn solid" data-act="toggleArrange">Done</button>
    </div>
    <div class="lib">${
      lib
        .map(
          (l) => `<div class="lib-item"><button type="button" data-act="placeSticker" data-id="${l.id}" aria-label="Place sticker"><img src="${esc(l.data.src)}" alt=""></button>
        <button type="button" class="x" data-act="libDel" data-id="${l.id}" aria-label="Remove from sticker book">×</button></div>`
        )
        .join('') || '<p class="empty">Your sticker book is empty. Upload some PNGs you love! (Transparent backgrounds look best.)</p>'
    }</div>`;
}
async function shrink(file, max = 420) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * k));
  c.height = Math.max(1, Math.round(bmp.height * k));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob(r, 'image/webp', 0.9));
}
async function uploadStickers(files) {
  for (const file of files) {
    try {
      const blob = await shrink(file);
      const src = await store.uploadImage(blob);
      await store.put({ owner: 'shared', type: 'stickerlib', data: { src, name: file.name, createdAt: Date.now() } });
    } catch (err) {
      console.error(err);
      toast(`Couldn't add ${file.name}`);
    }
  }
}
const maxZ = () => Math.max(0, ...byType('sticker').map((s) => s.data.z || 0));

document.addEventListener('pointerdown', (e) => {
  if (!ui.arranging) return;
  const st = e.target.closest('.sticker');
  if (!st) {
    if (ui.selected && !e.target.closest('#drawer')) {
      ui.selected = null;
      renderStickers();
    }
    return;
  }
  if (e.target.closest('.st-tools')) return;
  e.preventDefault();
  const id = st.dataset.sticker;
  const s = store.get(id);
  if (!s) return;
  if (ui.selected !== id) {
    ui.selected = id;
    renderStickers();
  }
  const W = $('#stickers').clientWidth;
  drag = { id, el: $(`[data-sticker="${id}"]`), sx: e.clientX, sy: e.clientY, x0: (s.data.x / 100) * W, y0: s.data.y, W, moved: false };
});
document.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.sx;
  const dy = e.clientY - drag.sy;
  if (!drag.moved && Math.hypot(dx, dy) < 3) return;
  drag.moved = true;
  drag.nx = Math.min(100, Math.max(-10, ((drag.x0 + dx) / drag.W) * 100));
  drag.ny = Math.max(0, drag.y0 + dy);
  drag.el.style.left = drag.nx + '%';
  drag.el.style.top = drag.ny + 'px';
});
document.addEventListener('pointerup', () => {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (d.moved) store.patch(d.id, { x: d.nx, y: d.ny });
  else renderStickers();
});

/* ================= fun bits ================= */
function confetti(x, y, { n = 26, emoji } = {}) {
  if (reducedMotion) return;
  const colors = ['#e07a8b', '#6c9bd2', '#f2c14e', '#5fb49c', '#9b7fd1'];
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'confetti' + (emoji ? ' emo' : '');
    if (emoji) s.textContent = emoji[i % emoji.length];
    else s.style.background = colors[i % colors.length];
    const a = Math.random() * Math.PI * 2;
    const d = 50 + Math.random() * 130;
    s.style.left = x + 'px';
    s.style.top = y + 'px';
    s.style.setProperty('--dx', Math.cos(a) * d + 'px');
    s.style.setProperty('--dy', Math.sin(a) * d - 70 + 'px');
    s.style.setProperty('--rr', Math.random() * 720 - 360 + 'deg');
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1300);
  }
}
const centerOf = (el) => {
  const r = el.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
};
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  $('#toasts').append(t);
  setTimeout(() => t.remove(), 3000);
}

/* ================= actions ================= */
const actions = {
  toggleArrange() {
    ui.arranging = !ui.arranging;
    ui.selected = null;
    render(true);
  },
  openSettings() {
    openModal(() => settingsModal(false));
  },
  todoFilter(el) {
    ui.todoFilter[el.dataset.key] = el.dataset.f;
    render(true);
  },
  toggleTodo(el) {
    const t = store.get(el.dataset.id);
    if (!t) return;
    const done = !t.data.done;
    if (done) confetti(...centerOf(el), { n: 14 });
    store.patch(t.id, { done, doneAt: done ? Date.now() : null, doneBy: done ? ui.me || t.owner : null });
  },
  del(el) {
    const it = store.get(el.dataset.id);
    if (!it) return;
    if (it.type === 'note' && (it.data.body || it.data.title) && !confirm('Delete this note?')) return;
    if (it.type === 'sticker') ui.selected = null;
    store.remove(it.id);
  },
  openProject(el) {
    const id = el.dataset.id;
    openModal(() => projectModal(id));
  },
  newProject(el) {
    const owner = el.dataset.owner;
    openModal(() => projectModal(null, owner));
  },
  delProject(el) {
    const p = store.get(el.dataset.id);
    if (!p || !confirm(`Delete “${p.data.name}”? Its to-dos are kept, just unlinked.`)) return;
    byType('todo')
      .filter((t) => t.data.projectId === p.id)
      .forEach((t) => store.patch(t.id, { projectId: '' }));
    store.remove(p.id);
  },
  closeModal(el, e) {
    if (el.classList.contains('backdrop') && e.target !== el) return;
    ui.modal = null;
    renderModal();
  },
  calMove(el) {
    const st = ui.cal[el.dataset.key];
    const d = +el.dataset.d;
    if (d === 0) {
      const n = new Date();
      st.y = n.getFullYear();
      st.m = n.getMonth();
    } else {
      const n = new Date(st.y, st.m + d, 1);
      st.y = n.getFullYear();
      st.m = n.getMonth();
    }
    render(true);
  },
  openDay(el) {
    const { date, key } = el.dataset;
    openModal(() => dayModal(date, key));
  },
  async addNote(el) {
    const row = await store.put({
      owner: el.dataset.owner,
      type: 'note',
      data: { title: '', body: '', color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)], createdAt: Date.now() },
    });
    render(true);
    $(`[data-live="${row.id}"][name=title]`)?.focus();
  },
  noteColor(el) {
    store.patch(el.dataset.id, { color: el.dataset.c });
  },
  highFive(el) {
    confetti(...centerOf(el), { n: 18, emoji: ['🙌', '✨', '💖', '⭐'] });
    const cur = store.get('highfives');
    store.put({ id: 'highfives', owner: 'shared', type: 'stat', data: { count: (cur?.data.count || 0) + 1 }, created_at: cur?.created_at });
  },
  randomCheer() {
    const input = $('form[data-form="cheer"] [name=text]');
    if (input) input.value = CHEERS[Math.floor(Math.random() * CHEERS.length)];
  },
  placeSticker(el) {
    const lib = store.get(el.dataset.id);
    if (!lib) return;
    const layer = $('#stickers');
    const rect = layer.getBoundingClientRect();
    const w = 130;
    const x = ((rect.width / 2 - w / 2) / rect.width) * 100 + (Math.random() * 16 - 8);
    const y = Math.max(0, innerHeight / 2 - rect.top - w / 2 - 80);
    store
      .put({ owner: 'shared', type: 'sticker', data: { page: ui.route, src: lib.data.src, x, y, w, rot: Math.round(Math.random() * 20 - 10), z: maxZ() + 1 } })
      .then((row) => {
        ui.selected = row.id;
        renderStickers();
      });
    ui.selected = null;
  },
  stRot(el) {
    const s = store.get(el.dataset.id);
    store.patch(s.id, { rot: (s.data.rot || 0) + +el.dataset.d });
  },
  stSize(el) {
    const s = store.get(el.dataset.id);
    store.patch(s.id, { w: Math.min(500, Math.max(40, s.data.w + +el.dataset.d)) });
  },
  stFront(el) {
    store.patch(el.dataset.id, { z: maxZ() + 1 });
  },
  libDel(el) {
    if (confirm('Remove this sticker from the sticker book? (Ones already stuck on pages stay.)')) store.remove(el.dataset.id);
  },
  exportData() {
    const blob = new Blob([JSON.stringify({ app: 'giterdun', version: 1, items: store.dump() }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `giterdun-backup-${todayStr()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  signOut() {
    store.signOut();
  },
};

const forms = {
  todo(fd, f) {
    store.put({
      owner: f.dataset.owner,
      type: 'todo',
      data: { text: fd.text.trim(), due: fd.due || '', projectId: fd.projectId || f.dataset.project || '', done: false, createdAt: Date.now() },
    });
    refocus(f.dataset.key);
  },
  countdown(fd, f) {
    store.put({ owner: f.dataset.owner, type: 'countdown', data: { title: fd.text.trim(), date: fd.date, emoji: fd.emoji || '⏳', createdAt: Date.now() } });
    refocus(f.dataset.key);
  },
  dayAdd(fd, f) {
    const owner = fd.owner || f.dataset.owner;
    const date = f.dataset.date;
    if (fd.kind === 'todo') store.put({ owner, type: 'todo', data: { text: fd.text.trim(), due: date, done: false, createdAt: Date.now() } });
    else store.put({ owner, type: 'event', data: { title: fd.text.trim(), date, time: fd.time || '', createdAt: Date.now() } });
    refocus('day');
  },
  async project(fd, f) {
    const row = await store.put({
      owner: f.dataset.owner,
      type: 'project',
      data: { name: fd.name.trim(), org: fd.org, location: fd.location, kind: fd.kind, status: fd.status, deadline: fd.deadline, link: fd.link, notes: fd.notes, statusAt: Date.now(), createdAt: Date.now() },
    });
    ui.modal = () => projectModal(row.id);
    render(true);
  },
  cheer(fd, f) {
    if (!ui.me) {
      toast('Pick who this device belongs to in ⚙️ Settings first.');
      return actions.openSettings();
    }
    store.put({
      owner: 'shared',
      type: 'cheer',
      data: { from: ui.me, to: fd.to, text: fd.text.trim(), color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)], createdAt: Date.now() },
    });
    const [x, y] = centerOf(f);
    confetti(x, y, { n: 10, emoji: ['💌', '💖'] });
    refocus('cheer');
  },
  settings(fd) {
    const data = { names: {}, focus: {}, colors: {}, emoji: {} };
    for (const o of ['a', 'b']) {
      data.names[o] = fd['name_' + o].trim() || DEFAULTS.names[o];
      data.focus[o] = fd['focus_' + o].trim();
      data.colors[o] = fd['color_' + o] || DEFAULTS.colors[o];
      data.emoji[o] = fd['emoji_' + o].trim() || DEFAULTS.emoji[o];
    }
    const firstTime = !ui.me;
    store.put({ id: 'settings', owner: 'shared', type: 'settings', data, created_at: store.get('settings')?.created_at });
    ui.me = fd.me;
    lsSet('giterdun-me', fd.me);
    ui.modal = null;
    if (firstTime && !location.hash) location.hash = '#/' + fd.me;
    render(true);
    toast('Saved ✓');
  },
};

/* ================= global listeners ================= */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  actions[el.dataset.act]?.(el, e);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ui.modal) {
    ui.modal = null;
    renderModal();
  }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-act]')) {
    e.preventDefault();
    e.target.click();
  }
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  forms[f.dataset.form]?.(Object.fromEntries(new FormData(f)), f);
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.patch) {
    if (el.name === 'name' && !el.value.trim()) return;
    const part = { [el.name]: el.value };
    if (el.name === 'status') {
      part.statusAt = Date.now();
      if (SENT_STATUSES.includes(el.value)) confetti(...centerOf(el), { n: 30 });
    }
    store.patch(el.dataset.patch, part);
  }
  if (el.matches('[data-upload]') && el.files.length) uploadStickers([...el.files]);
  if (el.matches('[data-import]') && el.files[0]) importBackup(el.files[0]);
});
const timers = {};
document.addEventListener('input', (e) => {
  const el = e.target;
  if (!el.dataset.live) return;
  const k = el.dataset.live + el.name;
  clearTimeout(timers[k]);
  timers[k] = setTimeout(() => store.patch(el.dataset.live, { [el.name]: el.value }), 400);
});

// pipeline drag & drop
document.addEventListener('dragstart', (e) => {
  const c = e.target.closest?.('[data-drag]');
  if (!c) return;
  e.dataTransfer.setData('text/plain', c.dataset.drag);
  e.dataTransfer.effectAllowed = 'move';
  c.classList.add('dragging');
});
document.addEventListener('dragover', (e) => {
  const col = e.target.closest?.('[data-drop]');
  if (!col) return;
  e.preventDefault();
  document.querySelectorAll('.kcol.over').forEach((c) => c !== col && c.classList.remove('over'));
  col.classList.add('over');
});
document.addEventListener('dragend', () => document.querySelectorAll('.kcol.over, .dragging').forEach((c) => c.classList.remove('over', 'dragging')));
document.addEventListener('drop', (e) => {
  const col = e.target.closest?.('[data-drop]');
  if (!col) return;
  e.preventDefault();
  const p = store.get(e.dataTransfer.getData('text/plain'));
  const st = col.dataset.drop;
  if (p && p.data.status !== st) {
    store.patch(p.id, { status: st, statusAt: Date.now() });
    if (SENT_STATUSES.includes(st)) confetti(e.clientX, e.clientY, { n: 30 });
  }
});

window.addEventListener('hashchange', () => {
  ui.route = parseRoute();
  ui.selected = null;
  render(true);
  scrollTo(0, 0);
});

async function importBackup(file) {
  try {
    const json = JSON.parse(await file.text());
    const rows = Array.isArray(json) ? json : json.items;
    if (!Array.isArray(rows)) throw new Error('not a backup');
    if (!confirm(`Restore ${rows.length} items from this backup? Items with the same id get replaced; nothing else is deleted.`)) return;
    await store.bulkPut(rows);
    toast('Backup restored ✓');
  } catch (err) {
    console.error(err);
    toast("That file doesn't look like a Giterdun backup.");
  }
}

/* ================= login + boot ================= */
function showLogin(msg = '') {
  $('#app').hidden = true;
  const l = $('#login');
  l.hidden = false;
  l.innerHTML = `<div class="login-card card">
    <h1 class="logo big">Giterdun<span>.</span></h1>
    <p>Sign in to your shared planner.</p>
    <form id="login-form">
      <label>Email<input type="email" name="email" required autocomplete="email"></label>
      <label>Password<input type="password" name="password" required minlength="6" autocomplete="current-password"></label>
      <p class="err" role="alert">${esc(msg)}</p>
      <div class="row"><button class="btn solid" value="in">Sign in</button><button class="btn ghost" value="up">Create account</button></div>
    </form>
    <small class="muted">Only the two of you should have accounts. Turn off new sign-ups in Supabase once you're both in.</small>
  </div>`;
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { email, password } = Object.fromEntries(new FormData(e.target));
    try {
      if (e.submitter?.value === 'up') {
        const signedIn = await store.signUp(email, password);
        if (!signedIn) return showLogin('Account created! Check your email to confirm it, then sign in.');
      } else {
        await store.signIn(email, password);
      }
      start();
    } catch (err) {
      showLogin(err.message || 'Something went wrong.');
    }
  });
}

let booted = false;
async function start() {
  let status;
  try {
    status = await store.init();
  } catch {
    return showLogin("Couldn't reach Supabase. Check js/config.js and your connection.");
  }
  if (status === 'login') return showLogin();
  $('#login').hidden = true;
  $('#app').hidden = false;
  if (!booted) {
    booted = true;
    store.onChange(scheduleRender);
    store.onError(toast);
  }
  ui.route = parseRoute();
  render(true);
  if (!ui.me) openModal(() => settingsModal(!store.get('settings')));
}
start();

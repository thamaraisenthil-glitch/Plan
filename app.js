import {
  toDateStr, parseDate, addDays, monthKey, addMonths, lastDayOfMonth, round2,
  REPEATS, occursOn, eventsOn, dueAlarms, nextAlarm, toICS,
  isTaskDone, monthCompletions, sumRewards, isValidSplit, splitAmount,
  unsplitMonths, lifetimeTotals, normalizeState, pruneFired,
} from './logic.js';

const STORAGE_KEY = 'plan-app-state-v1';
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

// ---------- Persistence ----------

function load() {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return normalizeState(null);
  }
}

let state = load();

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    toast('Could not save — storage is unavailable');
  }
}

// ---------- Helpers ----------

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const today = () => toDateStr(new Date());

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function money(n) {
  const v = round2(Number(n) || 0);
  const s = v.toLocaleString(undefined, { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
  return `${state.settings.currency}${s}`;
}

function fmtDay(ds, opts = { weekday: 'long', day: 'numeric', month: 'long' }) {
  return parseDate(ds).toLocaleDateString(undefined, opts);
}

function fmtMonth(key) {
  return parseDate(`${key}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function fmtTime(t) {
  const [h, m] = t.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---------- Navigation ----------

const ui = { tab: 'schedule', day: today(), taskFilter: 'active', month: monthKey(today()) };

function showTab(tab) {
  ui.tab = tab;
  $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $$('.view').forEach((v) => (v.hidden = v.dataset.view !== tab));
  render();
}

$$('.tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

// ---------- Banner (month-end reminders) ----------

function renderBanner() {
  const cur = monthKey(today());
  const pending = unsplitMonths(state.completions, state.allocations, cur);
  const el = $('#banner');
  if (pending.length) {
    const k = pending[0];
    const total = sumRewards(monthCompletions(state.completions, k));
    el.innerHTML = `<button class="banner" data-month="${k}">💰 ${esc(fmtMonth(k))} is over — split your ${esc(money(total))} into expenses, savings &amp; investment →</button>`;
  } else if (today() === lastDayOfMonth(cur) && sumRewards(monthCompletions(state.completions, cur)) > 0) {
    el.innerHTML = `<button class="banner soft" data-month="${cur}">📅 Month ends today — review your rewards split →</button>`;
  } else {
    el.innerHTML = '';
  }
}

$('#banner').addEventListener('click', (e) => {
  const b = e.target.closest('[data-month]');
  if (!b) return;
  ui.month = b.dataset.month;
  splitDraft = null;
  showTab('rewards');
});

// ---------- Schedule ----------

function renderSchedule() {
  $('#day-picker').value = ui.day;
  const start = addDays(ui.day, -((parseDate(ui.day).getDay() + 6) % 7)); // Monday
  const t = today();
  let strip = '';
  for (let i = 0; i < 7; i++) {
    const ds = addDays(start, i);
    const d = parseDate(ds);
    const count = eventsOn(state.events, ds).length;
    strip += `<button class="day ${ds === ui.day ? 'sel' : ''} ${ds === t ? 'today' : ''}" data-day="${ds}">
      <span class="dow">${d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
      <span class="dom">${d.getDate()}</span>
      <span class="dots">${count ? '•'.repeat(Math.min(count, 3)) : '&nbsp;'}</span>
    </button>`;
  }
  $('#week-strip').innerHTML = strip;

  const na = nextAlarm(state.events, new Date());
  $('#next-alarm').textContent = na
    ? `Next alarm: ${na.event.title} — ${fmtDay(na.date, { weekday: 'short', day: 'numeric', month: 'short' })}, ${new Date(na.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
    : '';

  const items = eventsOn(state.events, ui.day);
  $('#event-list').innerHTML = items.length
    ? items.map((ev) => `
      <li class="item event" data-id="${ev.id}">
        <div class="time">${esc(fmtTime(ev.time))}</div>
        <div class="body">
          <div class="title">${esc(ev.title)}</div>
          <div class="meta">${ev.alarm ? `⏰ ${ev.alarmOffset > 0 ? `${ev.alarmOffset} min before` : 'on time'}` : '🔕 no alarm'}${ev.repeat !== 'none' ? ` · 🔁 ${esc(REPEATS[ev.repeat])}` : ''}</div>
          ${ev.notes ? `<div class="notes">${esc(ev.notes)}</div>` : ''}
        </div>
      </li>`).join('')
    : `<li class="empty">Nothing scheduled for ${esc(fmtDay(ui.day))}.<br>Tap ＋ to add something.</li>`;
}

$('#week-strip').addEventListener('click', (e) => {
  const b = e.target.closest('[data-day]');
  if (b) { ui.day = b.dataset.day; render(); }
});
$('#day-picker').addEventListener('change', (e) => { if (e.target.value) { ui.day = e.target.value; render(); } });
$('#day-prev').addEventListener('click', () => { ui.day = addDays(ui.day, -7); render(); });
$('#day-next').addEventListener('click', () => { ui.day = addDays(ui.day, 7); render(); });

let editingEvent = null;

function openEvent(ev) {
  editingEvent = ev;
  const f = $('#event-form');
  f.reset();
  $('#event-dialog-title').textContent = ev ? 'Edit schedule item' : 'New schedule item';
  const now = new Date();
  const nextHour = `${String((now.getHours() + 1) % 24).padStart(2, '0')}:00`;
  f.title.value = ev?.title ?? '';
  f.date.value = ev?.date ?? ui.day;
  f.time.value = ev?.time ?? nextHour;
  f.repeat.value = ev?.repeat ?? 'none';
  f.duration.value = ev?.duration ?? 30;
  f.alarm.checked = ev ? !!ev.alarm : true;
  f.alarmOffset.value = String(ev?.alarmOffset ?? 0);
  f.notes.value = ev?.notes ?? '';
  $('#event-delete').hidden = !ev;
  $('#event-ics').hidden = !ev;
  $('#event-dialog').showModal();
  unlockAudio();
}

$('#add-event').addEventListener('click', () => openEvent(null));
$('#event-list').addEventListener('click', (e) => {
  const li = e.target.closest('[data-id]');
  if (li) openEvent(state.events.find((x) => x.id === li.dataset.id));
});

$('#event-form').addEventListener('submit', (e) => {
  const f = e.target;
  const data = {
    title: f.title.value.trim(),
    date: f.date.value,
    time: f.time.value,
    repeat: f.repeat.value,
    duration: Number(f.duration.value) || 30,
    alarm: f.alarm.checked,
    alarmOffset: Number(f.alarmOffset.value) || 0,
    notes: f.notes.value.trim(),
  };
  if (editingEvent) {
    Object.assign(editingEvent, data);
    // Changing the time should let today's alarm ring again.
    for (const k of Object.keys(state.fired)) if (k.startsWith(editingEvent.id + '|')) delete state.fired[k];
  } else {
    state.events.push({ id: uid(), ...data });
  }
  save();
  if (!occursOn({ ...data }, ui.day)) ui.day = data.date;
  render();
  if (data.alarm && 'Notification' in window && Notification.permission === 'default') {
    toast('Tip: tap 🔔 to allow alarm notifications');
  }
});

$('#event-delete').addEventListener('click', () => {
  if (!editingEvent || !confirm(`Delete “${editingEvent.title}”?`)) return;
  state.events = state.events.filter((x) => x !== editingEvent);
  save();
  $('#event-dialog').close();
  render();
});

$('#event-ics').addEventListener('click', () => {
  if (!editingEvent) return;
  download(`${editingEvent.title.replace(/[^\w-]+/g, '_') || 'event'}.ics`, toICS(editingEvent), 'text/calendar');
});

// ---------- Tasks ----------

function renderTasks() {
  const t = today();
  const todays = state.completions.filter((c) => c.date === t);
  $('#stat-today').textContent = money(sumRewards(todays));
  $('#stat-month').textContent = money(sumRewards(monthCompletions(state.completions, monthKey(t))));
  $$('.seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.filter === ui.taskFilter));

  const withDone = state.tasks.map((task) => ({ task, done: isTaskDone(task, state.completions, t) }));
  const shown = withDone
    .filter(({ done }) => ui.taskFilter === 'all' || (ui.taskFilter === 'done') === done)
    .sort((a, b) => a.done - b.done || (a.task.due || '9999').localeCompare(b.task.due || '9999') || a.task.createdAt - b.task.createdAt);

  $('#task-list').innerHTML = shown.length
    ? shown.map(({ task, done }) => {
      const overdue = !done && task.due && task.due < t;
      return `
      <li class="item task ${done ? 'done' : ''}" data-id="${task.id}">
        <button class="checkbox" data-toggle aria-label="${done ? 'Mark as not done' : 'Mark as done'}">${done ? '✓' : ''}</button>
        <div class="body" data-edit>
          <div class="title">${esc(task.title)}</div>
          <div class="meta">${task.repeat === 'daily' ? '🔁 Daily' : ''}${task.due ? `<span class="${overdue ? 'overdue' : ''}">${task.repeat === 'daily' ? ' · ' : ''}Due ${esc(fmtDay(task.due, { day: 'numeric', month: 'short' }))}</span>` : ''}</div>
        </div>
        <span class="chip">+${esc(money(task.reward))}</span>
      </li>`;
    }).join('')
    : `<li class="empty">${ui.taskFilter === 'done' ? 'No completed tasks yet.' : state.tasks.length ? 'All done — nice work! 🎉' : 'No tasks yet.<br>Tap ＋ to add one with a reward.'}</li>`;
}

$$('.seg-btn').forEach((b) => b.addEventListener('click', () => { ui.taskFilter = b.dataset.filter; render(); }));

$('#task-list').addEventListener('click', (e) => {
  const li = e.target.closest('[data-id]');
  if (!li) return;
  const task = state.tasks.find((x) => x.id === li.dataset.id);
  if (!task) return;
  if (e.target.closest('[data-toggle]')) toggleTask(task);
  else openTask(task);
});

function toggleTask(task) {
  const t = today();
  if (isTaskDone(task, state.completions, t)) {
    // Undo: remove today's completion (daily) or the completion (one-time).
    const idx = state.completions.findIndex((c) => c.taskId === task.id && (task.repeat !== 'daily' || c.date === t));
    const [removed] = state.completions.splice(idx, 1);
    toast(`Undone — ${money(removed.reward)} removed`);
  } else {
    state.completions.push({ id: uid(), taskId: task.id, title: task.title, reward: Number(task.reward) || 0, date: t, at: Date.now() });
    toast(`🎉 +${money(task.reward)} earned!`);
  }
  save();
  render();
}

let editingTask = null;

function openTask(task) {
  editingTask = task;
  const f = $('#task-form');
  f.reset();
  $('#task-dialog-title').textContent = task ? 'Edit task' : 'New task';
  f.title.value = task?.title ?? '';
  f.reward.value = task?.reward ?? 10;
  f.due.value = task?.due ?? '';
  f.repeat.value = task?.repeat ?? 'none';
  $('#task-delete').hidden = !task;
  $('#task-dialog').showModal();
}

$('#add-task').addEventListener('click', () => openTask(null));

$('#task-form').addEventListener('submit', (e) => {
  const f = e.target;
  const data = {
    title: f.title.value.trim(),
    reward: Math.max(0, round2(Number(f.reward.value) || 0)),
    due: f.due.value || null,
    repeat: f.repeat.value,
  };
  if (editingTask) Object.assign(editingTask, data);
  else state.tasks.push({ id: uid(), createdAt: Date.now(), ...data });
  save();
  render();
});

$('#task-delete').addEventListener('click', () => {
  if (!editingTask || !confirm(`Delete “${editingTask.title}”? Rewards already earned are kept.`)) return;
  state.tasks = state.tasks.filter((x) => x !== editingTask);
  save();
  $('#task-dialog').close();
  render();
});

// ---------- Rewards & monthly split ----------

const PARTS = [
  { key: 'expenses', label: 'Expenses', icon: '🛒' },
  { key: 'savings', label: 'Savings', icon: '🏦' },
  { key: 'investment', label: 'Investment', icon: '📈' },
];

let splitDraft = null; // percentages being edited for ui.month

function currentPct() {
  return splitDraft ?? state.allocations[ui.month]?.pct ?? state.settings.defaultSplit;
}

function renderRewards() {
  const cur = monthKey(today());
  $('#month-label').textContent = fmtMonth(ui.month);
  $('#month-next').disabled = ui.month >= cur;

  const comps = monthCompletions(state.completions, ui.month).sort((a, b) => b.at - a.at);
  const total = sumRewards(comps);
  const alloc = state.allocations[ui.month];
  $('#month-total').textContent = money(total);

  let status;
  if (alloc && round2(alloc.total) !== total) status = `⚠️ Rewards changed since you split ${money(alloc.total)} — save again to update.`;
  else if (alloc) status = `✓ Split saved ${new Date(alloc.savedAt).toLocaleDateString()}`;
  else if (ui.month < cur) status = total > 0 ? 'Month ended — not split yet' : 'No rewards earned this month';
  else {
    const left = Math.round((parseDate(lastDayOfMonth(cur)) - parseDate(today())) / 86400000);
    status = left === 0 ? 'Month ends today' : `${left} day${left === 1 ? '' : 's'} left this month`;
  }
  $('#month-status').textContent = status;

  const pct = currentPct();
  const amounts = splitAmount(total, pct);
  $('#split-rows').innerHTML = PARTS.map((p) => `
    <div class="split-row">
      <div class="row between">
        <span>${p.icon} ${p.label}</span>
        <span class="amt">${esc(money(amounts[p.key]))}</span>
      </div>
      <div class="row">
        <input type="range" min="0" max="100" step="1" value="${Number(pct[p.key])}" data-part="${p.key}" aria-label="${p.label} percent">
        <input type="number" min="0" max="100" step="1" value="${Number(pct[p.key])}" data-part="${p.key}" class="pct" aria-label="${p.label} percent">
        <span>%</span>
      </div>
    </div>`).join('');
  const valid = isValidSplit(pct);
  const sum = PARTS.reduce((s, p) => s + Number(pct[p.key] || 0), 0);
  $('#split-error').textContent = valid ? '' : `Percentages add up to ${sum}% — they must total 100%.`;
  $('#split-save').disabled = !valid;
  $('#split-save').textContent = alloc ? 'Update split' : 'Save split';

  const life = lifetimeTotals(state.allocations);
  $('#lifetime').innerHTML = PARTS.map((p) => `
    <div class="card stat ${p.key}"><span class="label">${p.icon} ${p.label}</span><span class="value">${esc(money(life[p.key]))}</span></div>`).join('');

  $('#month-completions').innerHTML = comps.length
    ? comps.map((c) => `<li class="item"><div class="body"><div class="title">${esc(c.title)}</div><div class="meta">${esc(fmtDay(c.date, { weekday: 'short', day: 'numeric', month: 'short' }))}</div></div><span class="chip">+${esc(money(c.reward))}</span></li>`).join('')
    : '<li class="empty">No completed tasks this month.</li>';

  const months = Object.keys(state.allocations).sort().reverse();
  $('#history').innerHTML = months.length
    ? `<thead><tr><th>Month</th><th>Total</th>${PARTS.map((p) => `<th>${p.label}</th>`).join('')}</tr></thead><tbody>${months.map((k) => {
      const a = state.allocations[k];
      return `<tr data-month="${k}"><td>${esc(fmtMonth(k))}</td><td>${esc(money(a.total))}</td>${PARTS.map((p) => `<td>${esc(money(a.amounts[p.key]))} <small>${a.pct[p.key]}%</small></td>`).join('')}</tr>`;
    }).join('')}</tbody>`
    : '<tbody><tr><td class="empty">No months split yet.</td></tr></tbody>';
}

// Keep the three percentages summing to 100 when a slider moves: the change
// is taken from (or given to) the other two parts, expenses first.
function setPart(key, value) {
  const pct = { ...currentPct() };
  value = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  pct[key] = value;
  let diff = PARTS.reduce((s, p) => s + Number(pct[p.key]), 0) - 100;
  for (const p of PARTS) {
    if (p.key === key || diff === 0) continue;
    const take = Math.max(-(100 - pct[p.key]), Math.min(pct[p.key], diff));
    pct[p.key] -= take;
    diff -= take;
  }
  splitDraft = pct;
  renderRewards();
  const again = document.querySelector(`input[type=range][data-part="${key}"]`);
  if (again && document.activeElement?.type !== 'number') again.focus();
}

$('#split-rows').addEventListener('input', (e) => {
  const part = e.target.dataset.part;
  if (part && e.target.type === 'range') setPart(part, e.target.value);
});
$('#split-rows').addEventListener('change', (e) => {
  const part = e.target.dataset.part;
  if (part && e.target.type === 'number') setPart(part, e.target.value);
});

$('#split-reset').addEventListener('click', () => { splitDraft = { ...state.settings.defaultSplit }; renderRewards(); });

$('#split-save').addEventListener('click', () => {
  const pct = currentPct();
  if (!isValidSplit(pct)) return;
  const total = sumRewards(monthCompletions(state.completions, ui.month));
  state.allocations[ui.month] = { pct: { ...pct }, total, amounts: splitAmount(total, pct), savedAt: Date.now() };
  splitDraft = null;
  save();
  render();
  toast(`Saved ${fmtMonth(ui.month)} split`);
});

$('#month-prev').addEventListener('click', () => { ui.month = addMonths(ui.month, -1); splitDraft = null; render(); });
$('#month-next').addEventListener('click', () => { ui.month = addMonths(ui.month, 1); splitDraft = null; render(); });
$('#history').addEventListener('click', (e) => {
  const tr = e.target.closest('[data-month]');
  if (tr) { ui.month = tr.dataset.month; splitDraft = null; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
});

// ---------- Settings ----------

$('#btn-settings').addEventListener('click', () => {
  const f = $('#settings-form');
  f.currency.value = state.settings.currency;
  for (const p of PARTS) f[p.key].value = state.settings.defaultSplit[p.key];
  $('#settings-error').textContent = '';
  $('#settings-dialog').showModal();
});

$('#settings-form').addEventListener('submit', (e) => {
  const f = e.target;
  const split = Object.fromEntries(PARTS.map((p) => [p.key, Number(f[p.key].value)]));
  if (!isValidSplit(split)) {
    e.preventDefault();
    $('#settings-error').textContent = 'Percentages must add up to 100%.';
    return;
  }
  state.settings.currency = f.currency.value;
  state.settings.defaultSplit = split;
  save();
  render();
});

$('#export-data').addEventListener('click', () => {
  download(`plan-backup-${today()}.json`, JSON.stringify(state, null, 2), 'application/json');
});

$('#import-data').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!confirm('Replace all current data with this backup?')) return;
    state = normalizeState(data);
    save();
    $('#settings-dialog').close();
    render();
    toast('Backup restored');
  } catch {
    toast('That file is not a valid backup');
  }
});

$('#clear-data').addEventListener('click', () => {
  if (!confirm('Erase all schedules, tasks and rewards from this device?')) return;
  state = normalizeState(null);
  save();
  $('#settings-dialog').close();
  render();
});

$$('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Alarms ----------

let audioCtx = null;
function unlockAudio() {
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* audio not available */ }
}
document.addEventListener('pointerdown', unlockAudio, { once: true });

let beepTimer = null;
function startBeeping() {
  stopBeeping();
  const beep = () => {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, t + i * 0.25);
      gain.gain.exponentialRampToValueAtTime(0.3, t + i * 0.25 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.25 + 0.18);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t + i * 0.25);
      osc.stop(t + i * 0.25 + 0.2);
    }
    navigator.vibrate?.([200, 100, 200]);
  };
  beep();
  beepTimer = setInterval(beep, 1500);
  setTimeout(stopBeeping, 60000); // give up after a minute
}
function stopBeeping() {
  clearInterval(beepTimer);
  beepTimer = null;
}

const ringQueue = [];
let ringing = null;

function ring(item) {
  ringQueue.push(item);
  if (!ringing) showNextRing();
}

function showNextRing() {
  ringing = ringQueue.shift() || null;
  if (!ringing) { stopBeeping(); return; }
  $('#alarm-title').textContent = ringing.title;
  $('#alarm-time').textContent = ringing.subtitle;
  if (!$('#alarm-dialog').open) $('#alarm-dialog').showModal();
  startBeeping();
  notify(ringing.title, ringing.subtitle, ringing.tag);
}

$('#alarm-dismiss').addEventListener('click', () => { $('#alarm-dialog').close(); showNextRing(); });
$('#alarm-snooze').addEventListener('click', () => {
  state.snoozes.push({ title: ringing.title, subtitle: 'Snoozed alarm', at: Date.now() + 5 * 60000 });
  save();
  $('#alarm-dialog').close();
  showNextRing();
});
$('#alarm-dialog').addEventListener('cancel', (e) => { e.preventDefault(); $('#alarm-dismiss').click(); });

async function notify(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const opts = { body, tag, icon: 'icon.svg', badge: 'icon.svg', requireInteraction: true, vibrate: [200, 100, 200] };
    if (reg) await reg.showNotification(title, opts);
    else new Notification(title, opts);
  } catch { /* notifications unsupported in this context */ }
}

function checkAlarms() {
  const now = new Date();
  for (const a of dueAlarms(state.events, now, state.fired)) {
    state.fired[a.key] = now.getTime();
    const off = Number(a.event.alarmOffset) || 0;
    ring({
      title: a.event.title,
      subtitle: `${fmtTime(a.event.time)}${off ? ` · starts in ${off} min` : ''}`,
      tag: a.key,
    });
  }
  const due = state.snoozes.filter((s) => s.at <= now.getTime());
  if (due.length) {
    state.snoozes = state.snoozes.filter((s) => s.at > now.getTime());
    due.forEach((s) => ring({ title: s.title, subtitle: s.subtitle, tag: `snooze-${s.at}` }));
  }
  state.fired = pruneFired(state.fired, toDateStr(now));
  save();
}

function updateNotifyButton() {
  const btn = $('#btn-notify');
  const supported = 'Notification' in window;
  btn.hidden = !supported || Notification.permission === 'granted';
}

$('#btn-notify').addEventListener('click', async () => {
  unlockAudio();
  try {
    const res = await Notification.requestPermission();
    toast(res === 'granted' ? 'Alarm notifications enabled' : 'Notifications blocked — alarms will only ring with the app open');
  } catch {
    toast('Notifications are not supported here');
  }
  updateNotifyButton();
});

// ---------- Render loop ----------

let lastDay = today();

function render() {
  $('#today-label').textContent = fmtDay(today());
  renderBanner();
  if (ui.tab === 'schedule') renderSchedule();
  if (ui.tab === 'tasks') renderTasks();
  if (ui.tab === 'rewards') renderRewards();
  updateNotifyButton();
}

setInterval(() => {
  checkAlarms();
  if (today() !== lastDay) { lastDay = today(); render(); } // daily tasks reset at midnight
}, 15000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkAlarms(); render(); } });

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

render();
checkAlarms();

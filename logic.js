// Pure helpers shared by the UI and the tests. No DOM access here.

export const pad = (n) => String(n).padStart(2, '0');

export function toDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export const monthKey = (dateStr) => dateStr.slice(0, 7);

export function addMonths(key, n) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function lastDayOfMonth(key) {
  const [y, m] = key.split('-').map(Number);
  return toDateStr(new Date(y, m, 0));
}

export const round2 = (n) => Math.round(n * 100) / 100;

// ---------- Schedule ----------

export const REPEATS = {
  none: 'Once',
  daily: 'Every day',
  weekdays: 'Weekdays',
  weekly: 'Every week',
};

export function occursOn(ev, dateStr) {
  if (dateStr < ev.date) return false;
  switch (ev.repeat) {
    case 'daily':
      return true;
    case 'weekdays': {
      const w = parseDate(dateStr).getDay();
      return w > 0 && w < 6;
    }
    case 'weekly':
      return parseDate(dateStr).getDay() === parseDate(ev.date).getDay();
    default:
      return dateStr === ev.date;
  }
}

export function eventsOn(events, dateStr) {
  return events
    .filter((e) => occursOn(e, dateStr))
    .sort((a, b) => a.time.localeCompare(b.time));
}

export function occurrenceTime(dateStr, time) {
  const d = parseDate(dateStr);
  const [h, m] = time.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

// Alarms whose ring time has passed within `windowMs` and haven't fired yet.
// Yesterday/tomorrow are scanned so offsets that cross midnight still work.
export function dueAlarms(events, now, fired, windowMs = 5 * 60 * 1000) {
  const out = [];
  const today = toDateStr(now);
  for (const ds of [addDays(today, -1), today, addDays(today, 1)]) {
    for (const ev of events) {
      if (!ev.alarm || !occursOn(ev, ds)) continue;
      const key = `${ev.id}|${ds}`;
      if (fired[key]) continue;
      const at = occurrenceTime(ds, ev.time) - (Number(ev.alarmOffset) || 0) * 60000;
      const diff = now.getTime() - at;
      if (diff >= 0 && diff < windowMs) out.push({ event: ev, date: ds, key });
    }
  }
  return out;
}

export function nextAlarm(events, now, days = 7) {
  const today = toDateStr(now);
  let best = null;
  for (let i = 0; i <= days; i++) {
    const ds = addDays(today, i);
    for (const ev of events) {
      if (!ev.alarm || !occursOn(ev, ds)) continue;
      const at = occurrenceTime(ds, ev.time) - (Number(ev.alarmOffset) || 0) * 60000;
      if (at > now.getTime() && (!best || at < best.at)) best = { event: ev, date: ds, at };
    }
    if (best) return best;
  }
  return best;
}

const ICS_RRULE = {
  daily: 'RRULE:FREQ=DAILY',
  weekdays: 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
  weekly: 'RRULE:FREQ=WEEKLY',
};

function icsEscape(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// Calendar file so the phone's own calendar can ring the alarm even when
// the app is closed.
export function toICS(ev, stamp = new Date()) {
  const dt = ev.date.replace(/-/g, '') + 'T' + ev.time.replace(':', '') + '00';
  const end = new Date(occurrenceTime(ev.date, ev.time) + (Number(ev.duration) || 30) * 60000);
  const dtEnd = toDateStr(end).replace(/-/g, '') + 'T' + pad(end.getHours()) + pad(end.getMinutes()) + '00';
  const utc = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Plan//Day Planner//EN',
    'BEGIN:VEVENT',
    `UID:${ev.id}@plan`,
    `DTSTAMP:${utc}`,
    `DTSTART:${dt}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${icsEscape(ev.title)}`,
  ];
  if (ev.notes) lines.push(`DESCRIPTION:${icsEscape(ev.notes)}`);
  if (ICS_RRULE[ev.repeat]) lines.push(ICS_RRULE[ev.repeat]);
  if (ev.alarm) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsEscape(ev.title)}`,
      `TRIGGER:-PT${Number(ev.alarmOffset) || 0}M`,
      'END:VALARM'
    );
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

// ---------- Tasks & rewards ----------

export function isTaskDone(task, completions, today) {
  const mine = completions.filter((c) => c.taskId === task.id);
  if (task.repeat === 'daily') return mine.some((c) => c.date === today);
  return mine.length > 0;
}

export function monthCompletions(completions, key) {
  return completions.filter((c) => monthKey(c.date) === key);
}

export function sumRewards(completions) {
  return round2(completions.reduce((s, c) => s + (Number(c.reward) || 0), 0));
}

export function isValidSplit(pct) {
  const vals = [pct.expenses, pct.savings, pct.investment].map(Number);
  return vals.every((v) => Number.isFinite(v) && v >= 0) && Math.abs(vals.reduce((a, b) => a + b, 0) - 100) < 1e-9;
}

// Rounds savings and investment to cents; expenses absorbs the remainder so
// the three parts always add up to the exact total.
export function splitAmount(total, pct) {
  const savings = round2((total * Number(pct.savings)) / 100);
  const investment = round2((total * Number(pct.investment)) / 100);
  return { expenses: round2(total - savings - investment), savings, investment };
}

// Past months that earned rewards but haven't been split yet.
export function unsplitMonths(completions, allocations, currentKey) {
  const months = new Set(completions.map((c) => monthKey(c.date)));
  return [...months]
    .filter((k) => k < currentKey && !allocations[k] && sumRewards(monthCompletions(completions, k)) > 0)
    .sort();
}

export function lifetimeTotals(allocations) {
  const t = { expenses: 0, savings: 0, investment: 0 };
  for (const a of Object.values(allocations)) {
    for (const k of Object.keys(t)) t[k] = round2(t[k] + (Number(a.amounts?.[k]) || 0));
  }
  return t;
}

// ---------- State ----------

export const DEFAULT_SPLIT = { expenses: 50, savings: 30, investment: 20 };

export function freshState() {
  return {
    version: 1,
    events: [],
    tasks: [],
    completions: [],
    allocations: {},
    fired: {},
    snoozes: [],
    settings: { currency: '$', defaultSplit: { ...DEFAULT_SPLIT } },
  };
}

export function normalizeState(raw) {
  const base = freshState();
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    events: Array.isArray(raw.events) ? raw.events : [],
    tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
    completions: Array.isArray(raw.completions) ? raw.completions : [],
    allocations: raw.allocations && typeof raw.allocations === 'object' ? raw.allocations : {},
    fired: raw.fired && typeof raw.fired === 'object' ? raw.fired : {},
    snoozes: Array.isArray(raw.snoozes) ? raw.snoozes : [],
    settings: {
      ...base.settings,
      ...(raw.settings || {}),
      defaultSplit: isValidSplit(raw.settings?.defaultSplit || {}) ? raw.settings.defaultSplit : { ...DEFAULT_SPLIT },
    },
  };
}

// Drop fired-alarm markers older than a few days so storage doesn't grow forever.
export function pruneFired(fired, today) {
  const cutoff = addDays(today, -3);
  const out = {};
  for (const [k, v] of Object.entries(fired)) {
    if (k.split('|')[1] >= cutoff) out[k] = v;
  }
  return out;
}

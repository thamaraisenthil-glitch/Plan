// Pure helpers shared by the screens and the tests. No React Native imports here.

export type Repeat = 'none' | 'daily' | 'weekdays' | 'weekly';
export type TaskRepeat = 'none' | 'daily';
export type Part = 'expenses' | 'savings' | 'investment';
export type Split = Record<Part, number>;

export interface ScheduleEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD, first occurrence
  time: string; // HH:MM
  repeat: Repeat;
  duration: number;
  alarm: boolean;
  alarmOffset: number; // minutes before start
  notes: string;
}

export interface Task {
  id: string;
  title: string;
  reward: number;
  due: string | null;
  repeat: TaskRepeat;
  createdAt: number;
}

export interface Completion {
  id: string;
  taskId: string;
  title: string;
  reward: number;
  date: string;
  at: number;
}

export interface Allocation {
  pct: Split;
  total: number;
  amounts: Split;
  savedAt: number;
}

export interface Settings {
  currency: string;
  defaultSplit: Split;
  monthEndReminder: boolean;
}

export interface AppState {
  version: number;
  events: ScheduleEvent[];
  tasks: Task[];
  completions: Completion[];
  allocations: Record<string, Allocation>;
  settings: Settings;
}

export const PARTS: Part[] = ['expenses', 'savings', 'investment'];

export const pad = (n: number) => String(n).padStart(2, '0');

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export const monthKey = (dateStr: string) => dateStr.slice(0, 7);

export function addMonths(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function lastDayOfMonth(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return toDateStr(new Date(y, m, 0));
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

// Rupee amounts use Indian digit grouping (1,00,000); others follow the phone's locale.
export function formatMoney(n: number, currency: string): string {
  const v = round2(Number(n) || 0);
  const s = v.toLocaleString(currency === '₹' ? 'en-IN' : undefined, { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
  return `${currency}${s}`;
}

// ---------- Schedule ----------

export const REPEAT_LABELS: Record<Repeat, string> = {
  none: 'Once',
  daily: 'Every day',
  weekdays: 'Weekdays',
  weekly: 'Every week',
};

// Whether the repeat pattern matches a day, ignoring the start date.
function matchesPattern(ev: ScheduleEvent, dateStr: string): boolean {
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

export function occursOn(ev: ScheduleEvent, dateStr: string): boolean {
  return dateStr >= ev.date && matchesPattern(ev, dateStr);
}

export function eventsOn(events: ScheduleEvent[], dateStr: string): ScheduleEvent[] {
  return events.filter((e) => occursOn(e, dateStr)).sort((a, b) => a.time.localeCompare(b.time));
}

export function occurrenceTime(dateStr: string, time: string): number {
  const d = parseDate(dateStr);
  const [h, m] = time.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

export const alarmTimeFor = (ev: ScheduleEvent, dateStr: string) =>
  occurrenceTime(dateStr, ev.time) - (Number(ev.alarmOffset) || 0) * 60000;

// Alarm times for occurrences starting on `from` for `days` days.
function alarmInstances(ev: ScheduleEvent, from: string, days: number, respectStart = true): number[] {
  const out: number[] = [];
  for (let i = 0; i < days; i++) {
    const ds = addDays(from, i);
    if (respectStart ? occursOn(ev, ds) : matchesPattern(ev, ds)) out.push(alarmTimeFor(ev, ds));
  }
  return out;
}

export function nextAlarm(events: ScheduleEvent[], now: Date, days = 8) {
  let best: { event: ScheduleEvent; at: number } | null = null;
  const from = addDays(toDateStr(now), -1);
  for (const ev of events) {
    if (!ev.alarm) continue;
    const at = alarmInstances(ev, from, days + 2).find((t) => t > now.getTime());
    if (at !== undefined && (!best || at < best.at)) best = { event: ev, at };
  }
  return best;
}

// ---------- Notification plan ----------

export type AlarmTrigger =
  | { kind: 'date'; at: number }
  | { kind: 'daily'; hour: number; minute: number }
  | { kind: 'weekly'; weekday: number; hour: number; minute: number }; // weekday 1 = Sunday

export interface PlannedNotification {
  id: string;
  kind: 'alarm' | 'monthEnd';
  title: string;
  body: string;
  trigger: AlarmTrigger;
  eventId?: string;
  firstAt: number; // used to prioritise when over the OS limit
}

// iOS keeps at most 64 pending local notifications per app; leave room for snoozes.
export const MAX_PENDING = 60;
// Look-ahead for alarms that can't use a repeating trigger yet.
export const DATE_WINDOW_DAYS = 21;

function alarmBody(ev: ScheduleEvent, fmtTime: (t: string) => string): string {
  const off = Number(ev.alarmOffset) || 0;
  if (!off) return `${fmtTime(ev.time)} · Starting now`;
  return `${fmtTime(ev.time)} · Starts in ${off >= 60 && off % 60 === 0 ? `${off / 60} h` : `${off} min`}`;
}

// Works out which OS notifications to schedule. A repeating item uses the
// OS's own daily/weekly trigger (keeps ringing even if the app is never
// opened again) once its start date is the next matching slot; before that,
// it gets one-off date triggers for the next few weeks.
export function planNotifications(
  state: Pick<AppState, 'events' | 'completions' | 'allocations' | 'settings'>,
  now: Date,
  fmtTime: (t: string) => string = (t) => t
): PlannedNotification[] {
  const out: PlannedNotification[] = [];
  const nowMs = now.getTime();
  const today = toDateStr(now);

  for (const ev of state.events) {
    if (!ev.alarm) continue;
    const body = alarmBody(ev, fmtTime);
    const base = { kind: 'alarm' as const, title: ev.title, body, eventId: ev.id };

    if (ev.repeat === 'none') {
      const at = alarmTimeFor(ev, ev.date);
      if (at > nowMs) out.push({ ...base, id: `alarm-${ev.id}`, trigger: { kind: 'date', at }, firstAt: at });
      continue;
    }

    const firstAt = alarmTimeFor(ev, ev.date);
    const nextSlot = alarmInstances(ev, addDays(today, -1), 10, false).find((t) => t > nowMs) ?? Infinity;
    const nextReal = alarmInstances(ev, addDays(today, -1), DATE_WINDOW_DAYS + 2).find((t) => t > nowMs);

    if (firstAt <= nextSlot) {
      // Ring time may fall on the previous day when the offset crosses midnight.
      const [h, m] = ev.time.split(':').map(Number);
      let mins = h * 60 + m - (Number(ev.alarmOffset) || 0);
      const dayShift = Math.floor(mins / 1440);
      mins = ((mins % 1440) + 1440) % 1440;
      const hour = Math.floor(mins / 60);
      const minute = mins % 60;
      const first = nextReal ?? firstAt;
      if (ev.repeat === 'daily') {
        out.push({ ...base, id: `alarm-${ev.id}`, trigger: { kind: 'daily', hour, minute }, firstAt: first });
      } else {
        const days = ev.repeat === 'weekly' ? [parseDate(ev.date).getDay()] : [1, 2, 3, 4, 5];
        for (const d of days) {
          const weekday = ((d + dayShift + 7) % 7) + 1;
          out.push({ ...base, id: `alarm-${ev.id}-w${weekday}`, trigger: { kind: 'weekly', weekday, hour, minute }, firstAt: first });
        }
      }
    } else {
      const from = ev.date > today ? addDays(ev.date, -1) : addDays(today, -1);
      for (const at of alarmInstances(ev, from, DATE_WINDOW_DAYS + 1)) {
        if (at > nowMs && at - nowMs <= DATE_WINDOW_DAYS * 86400000) {
          out.push({ ...base, id: `alarm-${ev.id}-${at}`, trigger: { kind: 'date', at }, firstAt: at });
        }
      }
    }
  }

  if (state.settings.monthEndReminder) {
    let key = monthKey(today);
    for (let i = 0; i < 3; i++, key = addMonths(key, 1)) {
      const at = occurrenceTime(lastDayOfMonth(key), '20:00');
      if (at <= nowMs) continue;
      out.push({
        id: `month-${key}`,
        kind: 'monthEnd',
        title: 'Month ends today 💰',
        body: 'Split this month’s rewards into expenses, savings and investment.',
        trigger: { kind: 'date', at },
        firstAt: at,
      });
    }
  }

  return out.sort((a, b) => a.firstAt - b.firstAt).slice(0, MAX_PENDING);
}

// ---------- Tasks & rewards ----------

export function isTaskDone(task: Task, completions: Completion[], today: string): boolean {
  const mine = completions.filter((c) => c.taskId === task.id);
  if (task.repeat === 'daily') return mine.some((c) => c.date === today);
  return mine.length > 0;
}

export function monthCompletions(completions: Completion[], key: string): Completion[] {
  return completions.filter((c) => monthKey(c.date) === key);
}

export function sumRewards(completions: Completion[]): number {
  return round2(completions.reduce((s, c) => s + (Number(c.reward) || 0), 0));
}

export function isValidSplit(pct: Partial<Split> | null | undefined): pct is Split {
  if (!pct) return false;
  const vals = PARTS.map((p) => Number(pct[p]));
  return vals.every((v) => Number.isFinite(v) && v >= 0) && Math.abs(vals.reduce((a, b) => a + b, 0) - 100) < 1e-9;
}

// Rounds savings and investment to cents; expenses absorbs the remainder so
// the three parts always add up to the exact total.
export function splitAmount(total: number, pct: Split): Split {
  const savings = round2((total * Number(pct.savings)) / 100);
  const investment = round2((total * Number(pct.investment)) / 100);
  return { expenses: round2(total - savings - investment), savings, investment };
}

// Sets one part and takes the difference from the others (in PARTS order) so
// the split keeps totalling 100%.
export function rebalanceSplit(pct: Split, part: Part, value: number): Split {
  const next = { ...pct };
  next[part] = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  let diff = PARTS.reduce((s, p) => s + next[p], 0) - 100;
  for (const p of PARTS) {
    if (p === part || diff === 0) continue;
    const take = Math.max(-(100 - next[p]), Math.min(next[p], diff));
    next[p] -= take;
    diff -= take;
  }
  return next;
}

// Past months that earned rewards but haven't been split yet.
export function unsplitMonths(completions: Completion[], allocations: Record<string, Allocation>, currentKey: string): string[] {
  const months = new Set(completions.map((c) => monthKey(c.date)));
  return [...months]
    .filter((k) => k < currentKey && !allocations[k] && sumRewards(monthCompletions(completions, k)) > 0)
    .sort();
}

export function lifetimeTotals(allocations: Record<string, Allocation>): Split {
  const t: Split = { expenses: 0, savings: 0, investment: 0 };
  for (const a of Object.values(allocations)) {
    for (const p of PARTS) t[p] = round2(t[p] + (Number(a.amounts?.[p]) || 0));
  }
  return t;
}

// ---------- State ----------

export const DEFAULT_SPLIT: Split = { expenses: 50, savings: 30, investment: 20 };

export function freshState(): AppState {
  return {
    version: 1,
    events: [],
    tasks: [],
    completions: [],
    allocations: {},
    settings: { currency: '₹', defaultSplit: { ...DEFAULT_SPLIT }, monthEndReminder: true },
  };
}

// Accepts anything (stored data, an imported backup — including one from the
// earlier web version) and returns a well-formed state.
export function normalizeState(raw: unknown): AppState {
  const base = freshState();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<AppState> & { settings?: Partial<Settings> };
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    version: 1,
    events: arr<ScheduleEvent>(r.events),
    tasks: arr<Task>(r.tasks),
    completions: arr<Completion>(r.completions),
    allocations: r.allocations && typeof r.allocations === 'object' ? r.allocations : {},
    settings: {
      currency: typeof r.settings?.currency === 'string' ? r.settings.currency : base.settings.currency,
      defaultSplit: isValidSplit(r.settings?.defaultSplit) ? r.settings.defaultSplit : { ...DEFAULT_SPLIT },
      monthEndReminder: r.settings?.monthEndReminder ?? true,
    },
  };
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

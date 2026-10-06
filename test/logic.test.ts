import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  occursOn, eventsOn, nextAlarm, planNotifications, addMonths, lastDayOfMonth,
  isTaskDone, monthCompletions, sumRewards, splitAmount, isValidSplit, rebalanceSplit,
  unsplitMonths, lifetimeTotals, normalizeState, freshState, MAX_PENDING,
  type ScheduleEvent, type Completion,
} from '../src/lib/logic.ts';

const ev = (o: Partial<ScheduleEvent> = {}): ScheduleEvent => ({
  id: 'e1', title: 'Walk', date: '2026-10-05', time: '07:00', repeat: 'none',
  duration: 30, alarm: true, alarmOffset: 0, notes: '', ...o,
});
const comp = (date: string, reward: number, taskId = 't'): Completion => ({ id: date + reward, taskId, title: 'x', reward, date, at: 0 });
const plan = (events: ScheduleEvent[], now: Date, monthEndReminder = false) =>
  planNotifications({ ...freshState(), events, settings: { ...freshState().settings, monthEndReminder } }, now);

test('repeat rules', () => {
  assert.ok(occursOn(ev(), '2026-10-05'));
  assert.ok(!occursOn(ev(), '2026-10-06'));
  assert.ok(occursOn(ev({ repeat: 'daily' }), '2026-12-25'));
  assert.ok(!occursOn(ev({ repeat: 'daily' }), '2026-10-04'), 'not before start');
  // 2026-10-10 is a Saturday, 2026-10-12 a Monday
  assert.ok(!occursOn(ev({ repeat: 'weekdays' }), '2026-10-10'));
  assert.ok(occursOn(ev({ repeat: 'weekdays' }), '2026-10-12'));
  assert.ok(occursOn(ev({ repeat: 'weekly' }), '2026-10-12'));
  assert.ok(!occursOn(ev({ repeat: 'weekly' }), '2026-10-13'));
});

test('eventsOn sorts by time', () => {
  const list = eventsOn([ev({ id: 'b', time: '09:00' }), ev({ id: 'a', time: '06:30' })], '2026-10-05');
  assert.deepEqual(list.map((e) => e.id), ['a', 'b']);
});

test('nextAlarm finds the soonest upcoming alarm', () => {
  const n = nextAlarm([ev({ repeat: 'daily' })], new Date(2026, 9, 5, 8, 0));
  assert.equal(n?.at, new Date(2026, 9, 6, 7, 0).getTime());
});

test('one-time alarm becomes a date trigger, only if in the future', () => {
  const p = plan([ev({ alarmOffset: 10 })], new Date(2026, 9, 5, 6, 0));
  assert.equal(p.length, 1);
  assert.deepEqual(p[0].trigger, { kind: 'date', at: new Date(2026, 9, 5, 6, 50).getTime() });
  assert.match(p[0].body, /Starts in 10 min/);
  assert.equal(plan([ev()], new Date(2026, 9, 5, 7, 1)).length, 0);
  assert.equal(plan([ev({ alarm: false })], new Date(2026, 9, 5, 6, 0)).length, 0);
});

test('started daily item uses an OS daily trigger', () => {
  const p = plan([ev({ repeat: 'daily', time: '00:10', alarmOffset: 15 })], new Date(2026, 9, 8, 12, 0));
  assert.equal(p.length, 1);
  assert.deepEqual(p[0].trigger, { kind: 'daily', hour: 23, minute: 55 });
});

test('daily item starting later today still uses a daily trigger', () => {
  const p = plan([ev({ repeat: 'daily', date: '2026-10-05', time: '18:00' })], new Date(2026, 9, 5, 9, 0));
  assert.equal(p[0].trigger.kind, 'daily');
});

test('weekday item maps to five weekly triggers (1 = Sunday)', () => {
  const p = plan([ev({ repeat: 'weekdays' })], new Date(2026, 9, 6, 12, 0));
  assert.deepEqual(p.map((x) => x.trigger.kind === 'weekly' && x.trigger.weekday).sort(), [2, 3, 4, 5, 6]);
});

test('weekly alarm crossing midnight moves to the previous weekday', () => {
  // 2026-10-05 is a Monday (weekday 2); 00:05 with 30 min offset rings Sunday 23:35
  const p = plan([ev({ repeat: 'weekly', time: '00:05', alarmOffset: 30 })], new Date(2026, 9, 6, 12, 0));
  assert.deepEqual(p[0].trigger, { kind: 'weekly', weekday: 1, hour: 23, minute: 35 });
});

test('repeating item that starts in the future gets date triggers until it starts', () => {
  const p = plan([ev({ repeat: 'daily', date: '2026-10-09' })], new Date(2026, 9, 5, 12, 0));
  assert.ok(p.length > 1);
  assert.ok(p.every((x) => x.trigger.kind === 'date'));
  assert.equal(p[0].firstAt, new Date(2026, 9, 9, 7, 0).getTime());
});

test('month-end reminders and the pending-notification cap', () => {
  const p = plan([], new Date(2026, 9, 6, 12, 0), true);
  assert.deepEqual(p.map((x) => x.id), ['month-2026-10', 'month-2026-11', 'month-2026-12']);
  const many = Array.from({ length: 80 }, (_, i) => ev({ id: `e${i}`, date: '2026-10-20' }));
  assert.equal(plan(many, new Date(2026, 9, 6)).length, MAX_PENDING);
});

test('month helpers', () => {
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(lastDayOfMonth('2028-02'), '2028-02-29');
});

test('task done state: one-time vs daily', () => {
  const comps = [comp('2026-10-04', 5, 't1')];
  const task = { id: 't1', title: '', reward: 5, due: null, createdAt: 0 };
  assert.ok(isTaskDone({ ...task, repeat: 'none' }, comps, '2026-10-05'));
  assert.ok(!isTaskDone({ ...task, repeat: 'daily' }, comps, '2026-10-05'));
  assert.ok(isTaskDone({ ...task, repeat: 'daily' }, comps, '2026-10-04'));
});

test('rewards add up per month', () => {
  const comps = [comp('2026-09-30', 10), comp('2026-10-01', 2.5), comp('2026-10-20', 0.1), comp('2026-10-21', 0.2)];
  assert.equal(sumRewards(monthCompletions(comps, '2026-10')), 2.8);
  assert.equal(sumRewards(monthCompletions(comps, '2026-09')), 10);
});

test('split always sums to the total', () => {
  const pct = { expenses: 50, savings: 30, investment: 20 };
  assert.deepEqual(splitAmount(100, pct), { expenses: 50, savings: 30, investment: 20 });
  const odd = splitAmount(33.33, { expenses: 33, savings: 33, investment: 34 });
  assert.equal(Math.round((odd.expenses + odd.savings + odd.investment) * 100), 3333);
  assert.ok(isValidSplit(pct));
  assert.ok(!isValidSplit({ expenses: 50, savings: 30, investment: 30 }));
  assert.ok(!isValidSplit({ expenses: 120, savings: -20, investment: 0 }));
});

test('rebalanceSplit keeps 100%', () => {
  const base = { expenses: 50, savings: 30, investment: 20 };
  assert.deepEqual(rebalanceSplit(base, 'savings', 40), { expenses: 40, savings: 40, investment: 20 });
  assert.deepEqual(rebalanceSplit(base, 'investment', 90), { expenses: 0, savings: 10, investment: 90 });
  assert.deepEqual(rebalanceSplit(base, 'expenses', 10), { expenses: 10, savings: 70, investment: 20 });
});

test('unsplit past months are reported, current month is not', () => {
  const comps = [comp('2026-08-03', 4), comp('2026-09-03', 4), comp('2026-10-03', 4)];
  const a = { pct: { expenses: 100, savings: 0, investment: 0 }, total: 4, amounts: { expenses: 4, savings: 0, investment: 0 }, savedAt: 0 };
  assert.deepEqual(unsplitMonths(comps, { '2026-08': a }, '2026-10'), ['2026-09']);
});

test('lifetime totals', () => {
  const mk = (e: number, s: number, i: number) => ({ pct: { expenses: 0, savings: 0, investment: 100 }, total: 0, savedAt: 0, amounts: { expenses: e, savings: s, investment: i } });
  assert.deepEqual(lifetimeTotals({ a: mk(10, 5.5, 1), b: mk(1, 0.5, 2) }), { expenses: 11, savings: 6, investment: 3 });
});

test('normalizeState repairs bad input and accepts web-version backups', () => {
  const s = normalizeState({ tasks: 'nope', fired: {}, settings: { currency: '₹', defaultSplit: { expenses: 90, savings: 90, investment: 0 } } });
  assert.deepEqual(s.tasks, []);
  assert.equal(s.settings.currency, '₹');
  assert.ok(isValidSplit(s.settings.defaultSplit));
  assert.equal(s.settings.monthEndReminder, true);
  assert.ok(!('fired' in s));
});

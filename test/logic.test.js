import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  occursOn, eventsOn, dueAlarms, nextAlarm, toICS, addMonths, lastDayOfMonth,
  isTaskDone, monthCompletions, sumRewards, splitAmount, isValidSplit,
  unsplitMonths, lifetimeTotals, normalizeState, pruneFired,
} from '../logic.js';

const ev = (o) => ({ id: 'e1', title: 'Walk', date: '2026-10-05', time: '07:00', repeat: 'none', alarm: true, alarmOffset: 0, ...o });

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

test('alarms fire once inside the window, honouring offset', () => {
  const events = [ev({ alarmOffset: 10 })];
  assert.equal(dueAlarms(events, new Date(2026, 9, 5, 6, 49), {}).length, 0);
  const due = dueAlarms(events, new Date(2026, 9, 5, 6, 50, 5), {});
  assert.equal(due.length, 1);
  assert.equal(due[0].key, 'e1|2026-10-05');
  assert.equal(dueAlarms(events, new Date(2026, 9, 5, 6, 51), { [due[0].key]: 1 }).length, 0);
  assert.equal(dueAlarms(events, new Date(2026, 9, 5, 7, 30), {}).length, 0, 'stale alarms are skipped');
  assert.equal(dueAlarms([ev({ alarm: false })], new Date(2026, 9, 5, 7, 0), {}).length, 0);
});

test('alarm offset crossing midnight', () => {
  const events = [ev({ date: '2026-10-06', time: '00:10', alarmOffset: 15 })];
  assert.equal(dueAlarms(events, new Date(2026, 9, 5, 23, 56), {}).length, 1);
});

test('nextAlarm finds the soonest upcoming alarm', () => {
  const n = nextAlarm([ev({ repeat: 'daily' })], new Date(2026, 9, 5, 8, 0));
  assert.equal(n.date, '2026-10-06');
});

test('ICS export includes repeat rule and alarm', () => {
  const ics = toICS(ev({ repeat: 'weekdays', alarmOffset: 5, title: 'Gym, legs' }), new Date(Date.UTC(2026, 0, 1)));
  assert.match(ics, /DTSTART:20261005T070000/);
  assert.match(ics, /DTEND:20261005T073000/);
  assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR/);
  assert.match(ics, /TRIGGER:-PT5M/);
  assert.match(ics, /SUMMARY:Gym\\, legs/);
});

test('month helpers', () => {
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(lastDayOfMonth('2028-02'), '2028-02-29');
});

test('task done state: one-time vs daily', () => {
  const comps = [{ taskId: 't1', date: '2026-10-04', reward: 5 }];
  assert.ok(isTaskDone({ id: 't1', repeat: 'none' }, comps, '2026-10-05'));
  assert.ok(!isTaskDone({ id: 't1', repeat: 'daily' }, comps, '2026-10-05'));
  assert.ok(isTaskDone({ id: 't1', repeat: 'daily' }, comps, '2026-10-04'));
});

test('rewards add up per month', () => {
  const comps = [
    { date: '2026-09-30', reward: 10 },
    { date: '2026-10-01', reward: 2.5 },
    { date: '2026-10-20', reward: 0.1 },
    { date: '2026-10-21', reward: 0.2 },
  ];
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

test('unsplit past months are reported, current month is not', () => {
  const comps = [{ date: '2026-08-03', reward: 4 }, { date: '2026-09-03', reward: 4 }, { date: '2026-10-03', reward: 4 }];
  assert.deepEqual(unsplitMonths(comps, { '2026-08': {} }, '2026-10'), ['2026-09']);
});

test('lifetime totals', () => {
  const t = lifetimeTotals({
    a: { amounts: { expenses: 10, savings: 5.5, investment: 1 } },
    b: { amounts: { expenses: 1, savings: 0.5, investment: 2 } },
  });
  assert.deepEqual(t, { expenses: 11, savings: 6, investment: 3 });
});

test('normalizeState repairs bad input', () => {
  const s = normalizeState({ tasks: 'nope', settings: { currency: '₹', defaultSplit: { expenses: 90, savings: 90, investment: 0 } } });
  assert.deepEqual(s.tasks, []);
  assert.equal(s.settings.currency, '₹');
  assert.ok(isValidSplit(s.settings.defaultSplit));
});

test('pruneFired drops old keys', () => {
  assert.deepEqual(Object.keys(pruneFired({ 'a|2026-09-01': 1, 'b|2026-10-04': 1 }, '2026-10-05')), ['b|2026-10-04']);
});

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Empty, Fab, IconButton, Ionicons, Screen } from '../../components/ui';
import { fmtClock, fmtDay, fmtMonth, fmtTime, formatMoney } from '../../lib/format';
import { addDays, eventsOn, monthCompletions, monthKey, nextAlarm, parseDate, REPEAT_LABELS, sumRewards, toDateStr, unsplitMonths } from '../../lib/logic';
import { getPermission, requestPermission } from '../../lib/notifications';
import { useStore } from '../../lib/store';
import { useColors } from '../../lib/theme';

// Bumped on each banner tap so the Rewards tab re-applies the month even if it's unchanged.
let linkSeq = 0;

export default function ScheduleScreen() {
  const c = useColors();
  const { state, today } = useStore();
  const [day, setDay] = useState(today);
  const [perm, setPerm] = useState<'granted' | 'denied' | 'undetermined' | null>(null);

  useFocusEffect(
    useCallback(() => {
      getPermission().then(setPerm, () => setPerm(null));
    }, [])
  );

  const weekStart = addDays(day, -((parseDate(day).getDay() + 6) % 7)); // Monday
  const items = eventsOn(state.events, day);
  const na = nextAlarm(state.events, new Date());
  const pending = unsplitMonths(state.completions, state.allocations, monthKey(today));
  const hasAlarms = state.events.some((e) => e.alarm);

  const enable = async () => {
    if (perm === 'denied') return Linking.openSettings();
    setPerm((await requestPermission()) ? 'granted' : await getPermission());
  };

  const openPending = () => router.navigate({ pathname: '/rewards', params: { month: pending[0], t: String(++linkSeq) } });

  return (
    <Screen
      title="Schedule"
      subtitle={fmtDay(today)}
      right={<IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />}
      fab={<Fab label="Add schedule item" onPress={() => router.push({ pathname: '/event', params: { date: day } })} />}
    >
      {pending.length > 0 && (
        <Pressable onPress={openPending} accessibilityRole="button">
          <Card style={{ backgroundColor: c.goodSoft, borderColor: c.goodSoft, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 0, marginBottom: 10 }}>
            <Ionicons name="wallet" size={22} color={c.good} />
            <Text style={{ color: c.good, fontWeight: '700', flex: 1 }}>
              {fmtMonth(pending[0])} is over — split your {formatMoney(sumRewards(monthCompletions(state.completions, pending[0])), state.settings.currency)}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={c.good} />
          </Card>
        </Pressable>
      )}

      {hasAlarms && perm !== null && perm !== 'granted' && (
        <Card style={{ backgroundColor: c.dangerSoft, borderColor: c.dangerSoft, gap: 10, marginTop: 0, marginBottom: 10 }}>
          <Text style={{ color: c.text, fontWeight: '600' }}>
            {perm === 'denied' ? 'Notifications are turned off, so alarms can’t ring.' : 'Allow notifications so your alarms can ring.'}
          </Text>
          <Button title={perm === 'denied' ? 'Open settings' : 'Allow notifications'} kind="primary" icon="notifications-outline" onPress={enable} />
        </Card>
      )}

      <View style={styles.weekNav}>
        <IconButton icon="chevron-back" label="Previous week" onPress={() => setDay(addDays(day, -7))} />
        <Pressable onPress={() => setDay(today)} accessibilityRole="button" accessibilityLabel="Go to today">
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>{fmtMonth(monthKey(day))}</Text>
          {day !== today ? <Text style={{ color: c.accent, fontSize: 12, textAlign: 'center' }}>Today</Text> : null}
        </Pressable>
        <IconButton icon="chevron-forward" label="Next week" onPress={() => setDay(addDays(day, 7))} />
      </View>

      <View style={styles.week}>
        {Array.from({ length: 7 }, (_, i) => {
          const ds = addDays(weekStart, i);
          const d = parseDate(ds);
          const sel = ds === day;
          const count = eventsOn(state.events, ds).length;
          return (
            <Pressable
              key={ds}
              onPress={() => setDay(ds)}
              accessibilityRole="button"
              accessibilityState={{ selected: sel }}
              accessibilityLabel={`${fmtDay(ds)}, ${count} item${count === 1 ? '' : 's'}`}
              style={[styles.day, { backgroundColor: sel ? c.accent : c.surface, borderColor: c.border }]}
            >
              <Text style={{ fontSize: 11, color: sel ? c.accentInk : c.muted, textTransform: 'uppercase' }}>
                {d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3)}
              </Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: sel ? c.accentInk : ds === today ? c.accent : c.text }}>{d.getDate()}</Text>
              <View style={styles.dots}>
                {Array.from({ length: Math.min(count, 3) }, (_, k) => (
                  <View key={k} style={[styles.dot, { backgroundColor: sel ? c.accentInk : c.accent }]} />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      {na && (
        <View style={styles.next}>
          <Ionicons name="alarm-outline" size={16} color={c.muted} />
          <Text style={{ color: c.muted, fontSize: 13, flex: 1 }} numberOfLines={1}>
            Next alarm: {na.event.title} — {fmtDay(toDateStr(new Date(na.at)), { weekday: 'short', day: 'numeric', month: 'short' })}, {fmtClock(na.at)}
          </Text>
        </View>
      )}

      <Text style={{ color: c.text, fontWeight: '700', fontSize: 17, marginTop: 14 }}>{day === today ? 'Today' : fmtDay(day)}</Text>

      {items.length === 0 ? (
        <Empty icon="sunny-outline" text={'Nothing scheduled.\nTap + to add something.'} />
      ) : (
        items.map((ev) => (
          <Pressable key={ev.id} onPress={() => router.push({ pathname: '/event', params: { id: ev.id } })} accessibilityRole="button">
            {({ pressed }) => (
              <Card style={{ flexDirection: 'row', gap: 12, opacity: pressed ? 0.7 : 1 }}>
                <Text style={{ color: c.accent, fontWeight: '800', minWidth: 72, fontVariant: ['tabular-nums'] }}>{fmtTime(ev.time)}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>{ev.title}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <Ionicons name={ev.alarm ? 'alarm-outline' : 'notifications-off-outline'} size={14} color={c.muted} />
                    <Text style={{ color: c.muted, fontSize: 13 }}>
                      {ev.alarm ? (ev.alarmOffset > 0 ? `${ev.alarmOffset} min before` : 'On time') : 'No alarm'}
                      {ev.repeat !== 'none' ? ` · ${REPEAT_LABELS[ev.repeat]}` : ''}
                    </Text>
                  </View>
                  {ev.notes ? <Text style={{ color: c.muted, fontSize: 13 }}>{ev.notes}</Text> : null}
                </View>
              </Card>
            )}
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  week: { flexDirection: 'row', gap: 5, marginTop: 12 },
  day: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, gap: 2 },
  dots: { flexDirection: 'row', gap: 3, height: 5 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  next: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
});

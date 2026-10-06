import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useToast } from '../../components/Toast';
import { Card, Chip, Empty, Fab, Ionicons, Screen, Segmented, Stat } from '../../components/ui';
import { fmtDay, formatMoney } from '../../lib/format';
import { isTaskDone, monthCompletions, monthKey, sumRewards } from '../../lib/logic';
import { useStore } from '../../lib/store';
import { useColors } from '../../lib/theme';

type Filter = 'active' | 'done' | 'all';

export default function TasksScreen() {
  const c = useColors();
  const toast = useToast();
  const { state, today, toggleTask } = useStore();
  const [filter, setFilter] = useState<Filter>('active');
  const money = (n: number) => formatMoney(n, state.settings.currency);

  const rows = state.tasks
    .map((task) => ({ task, done: isTaskDone(task, state.completions, today) }))
    .filter(({ done }) => filter === 'all' || (filter === 'done') === done)
    .sort((a, b) => Number(a.done) - Number(b.done) || (a.task.due ?? '9999').localeCompare(b.task.due ?? '9999') || a.task.createdAt - b.task.createdAt);

  const onToggle = (id: string) => {
    const delta = toggleTask(id);
    if (Platform.OS !== 'web') {
      if (delta > 0) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      else Haptics.selectionAsync().catch(() => {});
    }
    toast(delta >= 0 ? `🎉 +${money(delta)} earned!` : `Undone — ${money(-delta)} removed`);
  };

  return (
    <Screen title="Tasks" subtitle="Finish tasks to earn rewards" fab={<Fab label="Add task" onPress={() => router.push('/task')} />}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Stat label="Earned today" icon="today-outline" value={money(sumRewards(state.completions.filter((x) => x.date === today)))} color={c.good} />
        <Stat label="This month" icon="calendar-outline" value={money(sumRewards(monthCompletions(state.completions, monthKey(today))))} color={c.good} />
      </View>

      <Segmented<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'active', label: 'To do' },
          { value: 'done', label: 'Done' },
          { value: 'all', label: 'All' },
        ]}
      />

      {rows.length === 0 ? (
        <Empty
          icon={filter === 'done' ? 'hourglass-outline' : state.tasks.length ? 'trophy-outline' : 'list-outline'}
          text={filter === 'done' ? 'No completed tasks yet.' : state.tasks.length ? 'All done — nice work! 🎉' : 'No tasks yet.\nTap + to add one with a reward.'}
        />
      ) : (
        rows.map(({ task, done }) => {
          const overdue = !done && task.due && task.due < today;
          return (
            <Card key={task.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable
                onPress={() => onToggle(task.id)}
                hitSlop={10}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done }}
                accessibilityLabel={`${task.title}, reward ${money(task.reward)}`}
                style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: done ? c.good : c.border, backgroundColor: done ? c.good : 'transparent', alignItems: 'center', justifyContent: 'center' }}
              >
                {done ? <Ionicons name="checkmark" size={18} color={c.surface} /> : null}
              </Pressable>
              <Pressable style={{ flex: 1, gap: 2 }} onPress={() => router.push({ pathname: '/task', params: { id: task.id } })} accessibilityRole="button" accessibilityHint="Edit task">
                <Text style={{ color: done ? c.muted : c.text, fontWeight: '700', fontSize: 16, textDecorationLine: done ? 'line-through' : 'none' }}>{task.title}</Text>
                {(task.repeat === 'daily' || task.due) && (
                  <Text style={{ color: c.muted, fontSize: 13 }}>
                    {task.repeat === 'daily' ? '🔁 Daily' : ''}
                    {task.repeat === 'daily' && task.due ? ' · ' : ''}
                    {task.due ? <Text style={{ color: overdue ? c.danger : c.muted }}>Due {fmtDay(task.due, { day: 'numeric', month: 'short' })}</Text> : null}
                  </Text>
                )}
              </Pressable>
              <Chip text={`+${money(task.reward)}`} />
            </Card>
          );
        })
      )}
    </Screen>
  );
}

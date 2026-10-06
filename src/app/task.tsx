import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Switch, Text, View } from 'react-native';
import { DateTimeField } from '../components/DateTimeField';
import { Button, Card, Field, Input, Segmented } from '../components/ui';
import { round2, type TaskRepeat } from '../lib/logic';
import { useStore } from '../lib/store';
import { useColors } from '../lib/theme';

export default function TaskScreen() {
  const c = useColors();
  const { state, today, saveTask, deleteTask } = useStore();
  const params = useLocalSearchParams<{ id?: string }>();
  const existing = state.tasks.find((t) => t.id === params.id);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [reward, setReward] = useState(existing ? String(existing.reward) : '10');
  const [hasDue, setHasDue] = useState(!!existing?.due);
  const [due, setDue] = useState(existing?.due ?? today);
  const [repeat, setRepeat] = useState<TaskRepeat>(existing?.repeat ?? 'none');

  const save = () => {
    if (!title.trim()) return Alert.alert('Add a title', 'Give this task a name.');
    const amount = Number(reward.replace(',', '.'));
    if (!Number.isFinite(amount) || amount < 0) return Alert.alert('Check the reward', 'Enter a reward of 0 or more.');
    saveTask({ id: existing?.id, title: title.trim(), reward: round2(amount), due: hasDue ? due : null, repeat });
    router.back();
  };

  const remove = () => {
    if (!existing) return;
    const go = () => {
      deleteTask(existing.id);
      router.back();
    };
    if (Platform.OS === 'web') return go();
    Alert.alert('Delete task?', 'Rewards you already earned from it are kept.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: go },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: existing ? 'Edit task' : 'New task' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Field label="Task">
          <Input value={title} onChangeText={setTitle} placeholder="e.g. Clean the room" maxLength={120} autoFocus={!existing} />
        </Field>

        <Field label={`Reward (${state.settings.currency})`}>
          <Input value={reward} onChangeText={setReward} keyboardType="decimal-pad" maxLength={10} selectTextOnFocus />
        </Field>

        <Field label="Repeat">
          <Segmented<TaskRepeat>
            value={repeat}
            onChange={setRepeat}
            options={[
              { value: 'none', label: 'One-time' },
              { value: 'daily', label: 'Daily (earn every day)' },
            ]}
          />
        </Field>

        <Card style={{ gap: 12, marginTop: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>Due date</Text>
            <Switch value={hasDue} onValueChange={setHasDue} trackColor={{ true: c.accent }} accessibilityLabel="Has due date" />
          </View>
          {hasDue && <DateTimeField mode="date" value={due} onChange={setDue} />}
        </Card>

        <Button title="Save" kind="primary" icon="checkmark" onPress={save} />
        {existing && <Button title="Delete" kind="danger" icon="trash-outline" onPress={remove} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

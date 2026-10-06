import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Switch, Text, View } from 'react-native';
import { DateTimeField } from '../components/DateTimeField';
import { Button, Card, Field, Input, Segmented } from '../components/ui';
import { pad, REPEAT_LABELS, type Repeat } from '../lib/logic';
import { getPermission, requestPermission } from '../lib/notifications';
import { useStore } from '../lib/store';
import { useColors } from '../lib/theme';

const OFFSETS = [0, 5, 10, 15, 30, 60];

export default function EventScreen() {
  const c = useColors();
  const { state, today, saveEvent, deleteEvent } = useStore();
  const params = useLocalSearchParams<{ id?: string; date?: string }>();
  const existing = state.events.find((e) => e.id === params.id);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [date, setDate] = useState(existing?.date ?? params.date ?? today);
  const [time, setTime] = useState(existing?.time ?? `${pad((new Date().getHours() + 1) % 24)}:00`);
  const [repeat, setRepeat] = useState<Repeat>(existing?.repeat ?? 'none');
  const [duration, setDuration] = useState(String(existing?.duration ?? 30));
  const [alarm, setAlarm] = useState(existing?.alarm ?? true);
  const [offset, setOffset] = useState(existing?.alarmOffset ?? 0);
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const save = async () => {
    if (!title.trim()) return Alert.alert('Add a title', 'Give this item a name.');
    saveEvent({ id: existing?.id, title: title.trim(), date, time, repeat, duration: Number(duration) || 30, alarm, alarmOffset: offset, notes: notes.trim() });
    if (alarm && Platform.OS !== 'web' && (await getPermission()) === 'undetermined') await requestPermission();
    router.back();
  };

  const remove = () => {
    if (!existing) return;
    const go = () => {
      deleteEvent(existing.id);
      router.back();
    };
    if (Platform.OS === 'web') return go();
    Alert.alert('Delete item?', `“${existing.title}” will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: go },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: existing ? 'Edit item' : 'New item' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Field label="Title">
          <Input value={title} onChangeText={setTitle} placeholder="e.g. Morning walk" maxLength={120} autoFocus={!existing} returnKeyType="done" />
        </Field>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Field label="Date" style={{ flex: 1 }}>
            <DateTimeField mode="date" value={date} onChange={setDate} />
          </Field>
          <Field label="Time" style={{ flex: 1 }}>
            <DateTimeField mode="time" value={time} onChange={setTime} />
          </Field>
        </View>

        <Field label="Repeat">
          <Segmented<Repeat>
            value={repeat}
            onChange={setRepeat}
            options={(Object.keys(REPEAT_LABELS) as Repeat[]).map((r) => ({ value: r, label: REPEAT_LABELS[r] }))}
          />
        </Field>

        <Card style={{ gap: 12, marginTop: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>⏰ Alarm</Text>
            <Switch value={alarm} onValueChange={setAlarm} trackColor={{ true: c.accent }} accessibilityLabel="Alarm" />
          </View>
          {alarm && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {OFFSETS.map((o) => (
                <Button
                  key={o}
                  title={o === 0 ? 'At start' : o === 60 ? '1 h before' : `${o} min before`}
                  kind={offset === o ? 'primary' : 'ghost'}
                  onPress={() => setOffset(o)}
                  style={{ paddingVertical: 8, paddingHorizontal: 12 }}
                />
              ))}
            </View>
          )}
        </Card>

        <Field label="Duration (minutes)">
          <Input value={duration} onChangeText={(t) => setDuration(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={4} />
        </Field>

        <Field label="Notes">
          <Input value={notes} onChangeText={setNotes} multiline maxLength={500} style={{ minHeight: 70, textAlignVertical: 'top' }} />
        </Field>

        <Button title="Save" kind="primary" icon="checkmark" onPress={save} />
        {existing && <Button title="Delete" kind="danger" icon="trash-outline" onPress={remove} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

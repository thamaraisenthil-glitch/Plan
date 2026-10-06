import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, ScrollView, Switch, Text, View } from 'react-native';
import { useToast } from '../components/Toast';
import { Button, Card, Field, H2, Input } from '../components/ui';
import { isValidSplit, PARTS, type Split } from '../lib/logic';
import { getPermission, requestPermission, sendTestAlarm } from '../lib/notifications';
import { useStore } from '../lib/store';
import { PART_META, useColors } from '../lib/theme';

function confirm(title: string, message: string, action: string, onYes: () => void) {
  if (Platform.OS === 'web') return onYes();
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onYes },
  ]);
}

export default function SettingsScreen() {
  const c = useColors();
  const toast = useToast();
  const { state, today, updateSettings, replaceAll } = useStore();
  const [currency, setCurrency] = useState(state.settings.currency);
  const [split, setSplit] = useState<Record<keyof Split, string>>({
    expenses: String(state.settings.defaultSplit.expenses),
    savings: String(state.settings.defaultSplit.savings),
    investment: String(state.settings.defaultSplit.investment),
  });
  const [perm, setPerm] = useState<string>('…');

  useEffect(() => {
    getPermission().then(setPerm, () => setPerm('unknown'));
  }, []);

  const parsed = Object.fromEntries(PARTS.map((p) => [p, Number(split[p])])) as Split;
  const splitOk = isValidSplit(parsed);

  const save = () => {
    if (!splitOk) return;
    updateSettings({ currency, defaultSplit: parsed });
    toast('Settings saved');
    router.back();
  };

  const exportData = async () => {
    try {
      const json = JSON.stringify(state, null, 2);
      if (Platform.OS === 'web') return toast('Backups are available in the phone app');
      const file = new File(Paths.cache, `tamplan-backup-${today}.json`);
      if (file.exists) file.delete();
      file.create();
      file.write(json);
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save your Tamplan backup', UTI: 'public.json' });
    } catch (e) {
      Alert.alert('Export failed', String(e));
    }
  };

  const importData = async () => {
    try {
      if (Platform.OS === 'web') return toast('Backups are available in the phone app');
      const picked = await File.pickFileAsync({ mimeTypes: ['application/json', 'text/plain', '*/*'] });
      if (picked.canceled) return;
      const data = JSON.parse(await picked.result.text());
      confirm('Restore backup?', 'This replaces all current schedules, tasks and rewards.', 'Restore', () => {
        replaceAll(data);
        toast('Backup restored');
        router.back();
      });
    } catch {
      Alert.alert('Import failed', 'That file is not a valid Tamplan backup.');
    }
  };

  const enable = async () => {
    if (perm === 'denied') return Linking.openSettings();
    await requestPermission();
    setPerm(await getPermission());
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <Field label="Currency symbol">
        <Input value={currency} onChangeText={setCurrency} maxLength={4} autoCorrect={false} />
      </Field>

      <H2>Default monthly split</H2>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {PARTS.map((p) => (
          <Field key={p} label={`${PART_META[p].label} %`} style={{ flex: 1 }}>
            <Input value={split[p]} onChangeText={(t) => setSplit({ ...split, [p]: t.replace(/[^0-9]/g, '') })} keyboardType="number-pad" maxLength={3} />
          </Field>
        ))}
      </View>
      {!splitOk && <Text style={{ color: c.danger, marginTop: 6 }}>Percentages must add up to 100%.</Text>}

      <Button title="Save settings" kind="primary" icon="checkmark" onPress={save} disabled={!splitOk} style={{ marginTop: 16 }} />

      <H2>Alarms & reminders</H2>
      <Card style={{ gap: 12, marginTop: 0 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: c.text, fontSize: 16 }}>Notifications</Text>
          <Text style={{ color: perm === 'granted' ? c.good : c.danger, fontWeight: '700' }}>
            {perm === 'granted' ? 'Allowed' : perm === 'denied' ? 'Blocked' : perm === 'undetermined' ? 'Not set' : perm}
          </Text>
        </View>
        {perm !== 'granted' && <Button title={perm === 'denied' ? 'Open phone settings' : 'Allow notifications'} kind="primary" onPress={enable} />}
        {perm === 'granted' && <Button title="Send a test alarm (5 s)" icon="alarm-outline" onPress={() => sendTestAlarm().then(() => toast('Test alarm in 5 seconds'))} />}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontSize: 16 }}>Month-end reminder</Text>
            <Text style={{ color: c.muted, fontSize: 13 }}>8 PM on the last day of each month</Text>
          </View>
          <Switch
            value={state.settings.monthEndReminder}
            onValueChange={(v) => updateSettings({ monthEndReminder: v })}
            trackColor={{ true: c.accent }}
            accessibilityLabel="Month-end reminder"
          />
        </View>
      </Card>

      <H2>Backup</H2>
      <View style={{ gap: 10 }}>
        <Button title="Export backup" icon="share-outline" onPress={exportData} />
        <Button title="Restore from backup" icon="download-outline" onPress={importData} />
        <Button
          title="Erase all data"
          kind="danger"
          icon="trash-outline"
          onPress={() =>
            confirm('Erase everything?', 'All schedules, tasks and rewards on this phone will be deleted.', 'Erase', () => {
              replaceAll(null);
              router.back();
            })
          }
        />
      </View>
      <Text style={{ color: c.muted, fontSize: 13, marginTop: 10 }}>Your data is stored only on this phone.</Text>
    </ScrollView>
  );
}

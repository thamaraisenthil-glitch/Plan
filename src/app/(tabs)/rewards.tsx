import Slider from '@react-native-community/slider';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useToast } from '../../components/Toast';
import { Button, Card, Chip, Empty, H2, IconButton, Input, Ionicons, Screen, Stat } from '../../components/ui';
import { fmtDay, fmtMonth, formatMoney } from '../../lib/format';
import {
  addMonths, isValidSplit, lastDayOfMonth, lifetimeTotals, monthCompletions, monthKey, parseDate,
  PARTS, rebalanceSplit, round2, splitAmount, sumRewards, type Split,
} from '../../lib/logic';
import { useStore } from '../../lib/store';
import { PART_META, useColors } from '../../lib/theme';

export default function RewardsScreen() {
  const c = useColors();
  const toast = useToast();
  const { state, today, saveSplit } = useStore();
  const params = useLocalSearchParams<{ month?: string; t?: string }>();
  const current = monthKey(today);
  const [month, setMonth] = useState(() => (params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : current));
  const [draft, setDraft] = useState<Split | null>(null);
  const money = (n: number) => formatMoney(n, state.settings.currency);

  // Deep link from the month-end banner (`t` makes repeated taps re-apply it).
  const link = params.month && /^\d{4}-\d{2}$/.test(params.month) ? `${params.month}|${params.t ?? ''}` : null;
  const [seenLink, setSeenLink] = useState(link);
  if (link !== seenLink) {
    setSeenLink(link);
    if (params.month && link) {
      setMonth(params.month);
      setDraft(null);
    }
  }

  const go = (n: number) => {
    setMonth(addMonths(month, n));
    setDraft(null);
  };

  const comps = monthCompletions(state.completions, month).sort((a, b) => b.at - a.at);
  const total = sumRewards(comps);
  const alloc = state.allocations[month];
  const pct = draft ?? alloc?.pct ?? state.settings.defaultSplit;
  const amounts = splitAmount(total, pct);
  const valid = isValidSplit(pct);
  const life = lifetimeTotals(state.allocations);
  const history = Object.keys(state.allocations).sort().reverse();
  const partColor = { expenses: c.expenses, savings: c.savings, investment: c.investment };

  let status: string;
  if (alloc && round2(alloc.total) !== total) status = `⚠️ Rewards changed since you split ${money(alloc.total)} — save again to update.`;
  else if (alloc) status = `✓ Split saved ${new Date(alloc.savedAt).toLocaleDateString()}`;
  else if (month < current) status = total > 0 ? 'Month ended — not split yet' : 'No rewards earned this month';
  else {
    const left = Math.round((parseDate(lastDayOfMonth(current)).getTime() - parseDate(today).getTime()) / 86400000);
    status = left === 0 ? 'Month ends today — time to split!' : `${left} day${left === 1 ? '' : 's'} left this month`;
  }

  const save = () => {
    if (!valid) return;
    saveSplit(month, pct);
    setDraft(null);
    toast(`Saved ${fmtMonth(month)} split`);
  };

  return (
    <Screen title="Rewards" subtitle="Split each month’s rewards">
      <View style={styles.monthNav}>
        <IconButton icon="chevron-back" label="Previous month" onPress={() => go(-1)} />
        <Text style={{ color: c.text, fontWeight: '800', fontSize: 18 }}>{fmtMonth(month)}</Text>
        <IconButton icon="chevron-forward" label="Next month" onPress={() => go(1)} disabled={month >= current} />
      </View>

      <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
        <Text style={{ color: c.muted }}>Total rewards earned</Text>
        <Text style={{ color: c.good, fontSize: 40, fontWeight: '900' }} accessibilityRole="summary">{money(total)}</Text>
        <Text style={{ color: c.muted, fontSize: 13, textAlign: 'center' }}>{status}</Text>
      </Card>

      <Card>
        <View style={styles.between}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>Split this month</Text>
          <Pressable onPress={() => setDraft({ ...state.settings.defaultSplit })} accessibilityRole="button" hitSlop={8}>
            <Text style={{ color: c.accent, fontWeight: '600' }}>Use default</Text>
          </Pressable>
        </View>
        {PARTS.map((p, i) => (
          <View key={p} style={[styles.part, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}>
            <View style={styles.between}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name={PART_META[p].icon} size={18} color={partColor[p]} />
                <Text style={{ color: c.text, fontSize: 16 }}>{PART_META[p].label}</Text>
              </View>
              <Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>{money(amounts[p])}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Slider
                style={{ flex: 1, height: 36 }}
                minimumValue={0}
                maximumValue={100}
                step={1}
                value={pct[p]}
                onValueChange={(v) => setDraft(rebalanceSplit(pct, p, v))}
                minimumTrackTintColor={partColor[p]}
                maximumTrackTintColor={c.border}
                thumbTintColor={partColor[p]}
                accessibilityLabel={`${PART_META[p].label} percent`}
              />
              <Input
                value={String(pct[p])}
                onChangeText={(t) => setDraft(rebalanceSplit(pct, p, Number(t.replace(/[^0-9]/g, '')) || 0))}
                keyboardType="number-pad"
                maxLength={3}
                selectTextOnFocus
                accessibilityLabel={`${PART_META[p].label} percent`}
                style={{ width: 58, textAlign: 'right', paddingVertical: 6 }}
              />
              <Text style={{ color: c.muted }}>%</Text>
            </View>
          </View>
        ))}
        {!valid && <Text style={{ color: c.danger, marginBottom: 6 }}>Percentages must add up to 100%.</Text>}
        <Button title={alloc ? 'Update split' : 'Save split'} kind="primary" icon="checkmark" onPress={save} disabled={!valid} />
      </Card>

      <H2>Lifetime</H2>
      <View style={{ gap: 10 }}>
        {PARTS.map((p) => (
          <Stat key={p} label={PART_META[p].label} icon={PART_META[p].icon} value={money(life[p])} color={partColor[p]} />
        ))}
      </View>

      <H2>Earned in {fmtMonth(month)}</H2>
      {comps.length === 0 ? (
        <Empty icon="sparkles-outline" text="No completed tasks this month." />
      ) : (
        comps.map((x) => (
          <Card key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontWeight: '600' }}>{x.title}</Text>
              <Text style={{ color: c.muted, fontSize: 13 }}>{fmtDay(x.date, { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
            </View>
            <Chip text={`+${money(x.reward)}`} />
          </Card>
        ))
      )}

      <H2>History</H2>
      {history.length === 0 ? (
        <Empty icon="time-outline" text="No months split yet." />
      ) : (
        history.map((k) => {
          const a = state.allocations[k];
          return (
            <Pressable key={k} onPress={() => { setMonth(k); setDraft(null); }} accessibilityRole="button">
              <Card style={{ marginTop: 8, gap: 6 }}>
                <View style={styles.between}>
                  <Text style={{ color: c.text, fontWeight: '700' }}>{fmtMonth(k)}</Text>
                  <Text style={{ color: c.text, fontWeight: '700' }}>{money(a.total)}</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 2 }}>
                  {PARTS.map((p) => (
                    <Text key={p} style={{ color: c.muted, fontSize: 13 }}>
                      <Text style={{ color: partColor[p], fontWeight: '700' }}>{money(a.amounts[p])}</Text> {PART_META[p].label.toLowerCase()} ({a.pct[p]}%)
                    </Text>
                  ))}
                </View>
              </Card>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  part: { paddingVertical: 10, gap: 4 },
});

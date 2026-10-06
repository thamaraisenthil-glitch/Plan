import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export { Ionicons };

export function Screen({ title, subtitle, right, children, fab }: { title: string; subtitle?: string; right?: ReactNode; children: ReactNode; fab?: ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.h1, { color: c.text }]} accessibilityRole="header">{title}</Text>
            {subtitle ? <Text style={{ color: c.muted, marginTop: 2 }}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
        {children}
      </ScrollView>
      {fab}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, style]}>{children}</View>;
}

export function H2({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[styles.h2, { color: c.text }]}>{children}</Text>;
}

type ButtonKind = 'primary' | 'ghost' | 'danger';
export function Button({ title, onPress, kind = 'ghost', icon, disabled, style }: { title: string; onPress: () => void; kind?: ButtonKind; icon?: IconName; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const bg = kind === 'primary' ? c.accent : kind === 'danger' ? 'transparent' : c.surface2;
  const fg = kind === 'primary' ? c.accentInk : kind === 'danger' ? c.danger : c.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 }, style]}
    >
      {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={{ color: fg, fontWeight: '600', fontSize: 16 }}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, disabled }: { icon: IconName; onPress: () => void; label: string; disabled?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      style={({ pressed }) => [styles.iconBtn, { backgroundColor: c.surface, borderColor: c.border, opacity: disabled ? 0.35 : pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={icon} size={20} color={c.text} />
    </Pressable>
  );
}

export function Fab({ onPress, label }: { onPress: () => void; label: string }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} accessibilityRole="button" style={({ pressed }) => [styles.fab, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 }]}>
      <Ionicons name="add" size={30} color={c.accentInk} />
    </Pressable>
  );
}

export function Chip({ text, tone = 'good' }: { text: string; tone?: 'good' | 'accent' | 'muted' }) {
  const c = useColors();
  const bg = tone === 'good' ? c.goodSoft : tone === 'accent' ? c.accentSoft : c.surface2;
  const fg = tone === 'good' ? c.good : tone === 'accent' ? c.accent : c.muted;
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontWeight: '700', fontSize: 13 }}>{text}</Text>
    </View>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const c = useColors();
  return (
    <View style={[styles.seg, { backgroundColor: c.surface2 }]} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segBtn, active && { backgroundColor: c.surface }]}
          >
            <Text style={{ color: active ? c.text : c.muted, fontWeight: active ? '700' : '500', fontSize: 14 }} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({ label, children, style }: { label: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <View style={[{ gap: 6 }, style]}>
      <Text style={{ color: c.muted, fontSize: 13, fontWeight: '600' }}>{label}</Text>
      {children}
    </View>
  );
}

export function Input(props: TextInputProps) {
  const c = useColors();
  return (
    <TextInput
      placeholderTextColor={c.muted}
      {...props}
      style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }, props.style]}
    />
  );
}

export function Empty({ icon, text }: { icon: IconName; text: string }) {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={36} color={c.muted} />
      <Text style={{ color: c.muted, textAlign: 'center', marginTop: 8 }}>{text}</Text>
    </View>
  );
}

export function Stat({ label, value, color, icon }: { label: string; value: string; color?: string; icon?: IconName }) {
  const c = useColors();
  return (
    <Card style={{ flex: 1, marginTop: 0, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon ? <Ionicons name={icon} size={14} color={c.muted} /> : null}
        <Text style={{ color: c.muted, fontSize: 13 }}>{label}</Text>
      </View>
      <Text style={{ color: color ?? c.text, fontSize: 20, fontWeight: '800' }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </Card>
  );
}

export const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
  h1: { fontSize: 30, fontWeight: '800' },
  h2: { fontSize: 17, fontWeight: '700', marginTop: 22, marginBottom: 10 },
  card: { borderRadius: 16, padding: 14, marginTop: 10, borderWidth: StyleSheet.hairlineWidth },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  fab: {
    position: 'absolute', right: 20, bottom: 20, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  seg: { flexDirection: 'row', borderRadius: 12, padding: 4, marginTop: 14 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16 },
  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});

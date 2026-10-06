import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, Text } from 'react-native';
import { fmtDay, fmtTime } from '../lib/format';
import { pad, parseDate, toDateStr } from '../lib/logic';
import { useColors } from '../lib/theme';
import { styles } from './ui';

interface Props {
  mode: 'date' | 'time';
  value: string; // YYYY-MM-DD or HH:MM
  onChange: (v: string) => void;
}

function toDate(mode: Props['mode'], value: string): Date {
  if (mode === 'date') return parseDate(value);
  const [h, m] = value.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

const fromDate = (mode: Props['mode'], d: Date) => (mode === 'date' ? toDateStr(d) : `${pad(d.getHours())}:${pad(d.getMinutes())}`);

export function DateTimeField({ mode, value, onChange }: Props) {
  const c = useColors();
  const date = toDate(mode, value);

  if (Platform.OS === 'ios') {
    return (
      <DateTimePicker
        value={date}
        mode={mode}
        display="compact"
        onValueChange={(_, d) => onChange(fromDate(mode, d))}
        style={{ alignSelf: 'flex-start' }}
      />
    );
  }

  // Android: a tappable field that opens the system dialog.
  const open = () =>
    DateTimePickerAndroid.open({
      value: date,
      mode,
      onValueChange: (_, d) => onChange(fromDate(mode, d)),
    });
  return (
    <Pressable onPress={open} accessibilityRole="button" style={[styles.input, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={{ color: c.text, fontSize: 16 }}>
        {mode === 'date' ? fmtDay(value, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : fmtTime(value)}
      </Text>
    </Pressable>
  );
}

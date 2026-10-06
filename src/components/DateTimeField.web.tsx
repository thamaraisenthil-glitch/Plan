import { createElement } from 'react';
import { useColors } from '../lib/theme';

// Browser preview only: use the native HTML date/time input.
export function DateTimeField({ mode, value, onChange }: { mode: 'date' | 'time'; value: string; onChange: (v: string) => void }) {
  const c = useColors();
  return createElement('input', {
    type: mode,
    value,
    onChange: (e: { target: { value: string } }) => e.target.value && onChange(e.target.value),
    style: {
      font: 'inherit', fontSize: 16, padding: '10px 12px', borderRadius: 12,
      border: `1px solid ${c.border}`, background: c.surface, color: c.text,
    },
  });
}

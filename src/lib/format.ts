import { parseDate } from './logic';

export { formatMoney } from './logic';

export function fmtDay(ds: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }): string {
  return parseDate(ds).toLocaleDateString(undefined, opts);
}

export function fmtMonth(key: string): string {
  return parseDate(`${key}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function fmtClock(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

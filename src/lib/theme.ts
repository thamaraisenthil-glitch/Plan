import { useColorScheme } from 'react-native';

const light = {
  bg: '#f6f7fb',
  surface: '#ffffff',
  surface2: '#eef0f6',
  text: '#1b1d29',
  muted: '#6b7083',
  border: '#e1e4ee',
  accent: '#4f46e5',
  accentInk: '#ffffff',
  accentSoft: '#e8e7fd',
  good: '#15803d',
  goodSoft: '#dcfce7',
  danger: '#c2410c',
  dangerSoft: '#ffedd5',
  expenses: '#ea580c',
  savings: '#0284c7',
  investment: '#16a34a',
};

export type Colors = typeof light;

const dark: Colors = {
  bg: '#0f1117',
  surface: '#181b24',
  surface2: '#222634',
  text: '#e8eaf2',
  muted: '#9298ab',
  border: '#2c3142',
  accent: '#8b85ff',
  accentInk: '#0f1117',
  accentSoft: '#2a2850',
  good: '#4ade80',
  goodSoft: '#14321f',
  danger: '#fb923c',
  dangerSoft: '#3a2312',
  expenses: '#fb923c',
  savings: '#38bdf8',
  investment: '#4ade80',
};

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const PART_META = {
  expenses: { label: 'Expenses', icon: 'cart-outline' },
  savings: { label: 'Savings', icon: 'wallet-outline' },
  investment: { label: 'Investment', icon: 'trending-up-outline' },
} as const;

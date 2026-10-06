import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState as RNAppState } from 'react-native';
import {
  isTaskDone, monthCompletions, normalizeState, splitAmount, sumRewards, toDateStr, uid,
  type AppState, type ScheduleEvent, type Settings, type Split, type Task,
} from './logic';
import { syncNotifications } from './notifications';

const STORAGE_KEY = 'plan-app-state-v1';

interface Store {
  state: AppState;
  ready: boolean;
  today: string;
  saveEvent(ev: Omit<ScheduleEvent, 'id'> & { id?: string }): void;
  deleteEvent(id: string): void;
  saveTask(task: Omit<Task, 'id' | 'createdAt'> & { id?: string }): void;
  deleteTask(id: string): void;
  /** Returns the reward gained (positive) or removed (negative). */
  toggleTask(id: string): number;
  saveSplit(month: string, pct: Split): void;
  updateSettings(patch: Partial<Settings>): void;
  replaceAll(raw: unknown): void;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => normalizeState(null));
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState(() => toDateStr(new Date()));
  // Latest state for callbacks that must read it synchronously (toggleTask).
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => setState(normalizeState(raw ? JSON.parse(raw) : null)))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  // Persist and re-plan OS alarms after every change (debounced).
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
      syncNotifications(state).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [state, ready]);

  // Roll the date over at midnight and when the app comes back to the foreground;
  // also re-plan alarms so date-based look-ahead stays topped up.
  useEffect(() => {
    const refresh = () => {
      setToday(toDateStr(new Date()));
      if (ready) syncNotifications(stateRef.current).catch(() => {});
    };
    const timer = setInterval(() => setToday(toDateStr(new Date())), 60000);
    const sub = RNAppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [ready]);

  const saveEvent = useCallback<Store['saveEvent']>((ev) => {
    setState((s) => {
      const exists = ev.id && s.events.some((e) => e.id === ev.id);
      const events = exists
        ? s.events.map((e) => (e.id === ev.id ? ({ ...e, ...ev } as ScheduleEvent) : e))
        : [...s.events, { ...ev, id: uid() } as ScheduleEvent];
      return { ...s, events };
    });
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setState((s) => ({ ...s, events: s.events.filter((e) => e.id !== id) }));
  }, []);

  const saveTask = useCallback<Store['saveTask']>((task) => {
    setState((s) => {
      const exists = task.id && s.tasks.some((t) => t.id === task.id);
      const tasks = exists
        ? s.tasks.map((t) => (t.id === task.id ? ({ ...t, ...task } as Task) : t))
        : [...s.tasks, { ...task, id: uid(), createdAt: Date.now() } as Task];
      return { ...s, tasks };
    });
  }, []);

  const deleteTask = useCallback((id: string) => {
    setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
  }, []);

  const toggleTask = useCallback((id: string) => {
    const s = stateRef.current;
    const task = s.tasks.find((t) => t.id === id);
    if (!task) return 0;
    const day = toDateStr(new Date());
    let completions;
    let delta: number;
    if (isTaskDone(task, s.completions, day)) {
      // Undo: remove today's completion (daily) or the completion (one-time).
      const idx = s.completions.findIndex((c) => c.taskId === id && (task.repeat !== 'daily' || c.date === day));
      delta = -s.completions[idx].reward;
      completions = s.completions.filter((_, i) => i !== idx);
    } else {
      delta = Number(task.reward) || 0;
      completions = [...s.completions, { id: uid(), taskId: id, title: task.title, reward: delta, date: day, at: Date.now() }];
    }
    const next = { ...s, completions };
    stateRef.current = next;
    setState(next);
    return delta;
  }, []);

  const saveSplit = useCallback((month: string, pct: Split) => {
    setState((s) => {
      const total = sumRewards(monthCompletions(s.completions, month));
      return {
        ...s,
        allocations: { ...s.allocations, [month]: { pct: { ...pct }, total, amounts: splitAmount(total, pct), savedAt: Date.now() } },
      };
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);

  const replaceAll = useCallback((raw: unknown) => setState(normalizeState(raw)), []);

  const value = useMemo<Store>(
    () => ({ state, ready, today, saveEvent, deleteEvent, saveTask, deleteTask, toggleTask, saveSplit, updateSettings, replaceAll }),
    [state, ready, today, saveEvent, deleteEvent, saveTask, deleteTask, toggleTask, saveSplit, updateSettings, replaceAll]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Learner profiles and activity history, kept on this device (localStorage).
 *
 * Students write to it (a finished letter, a finished number digit, a quiz answer); parents read
 * it on their dashboard. There is no server: everything stays in the browser it was made in.
 */

export interface ChildProfile {
  id: string;
  name: string;
  avatar: string;
  createdAt: number;
}

export type ActivityKind = 'letter' | 'numeral' | 'quiz';

export interface ActivityRecord {
  childId: string;
  kind: ActivityKind;
  /** Glyph id (e.g. 'ka', 'num-3'). */
  itemId: string;
  /** 1–3 for tracing; 3 = correct, 0 = wrong for quiz answers. */
  stars: number;
  /** 0–100 tracing accuracy (quiz: 100 or 0). */
  accuracy: number;
  mistakes: number;
  at: number;
}

export interface ProgressState {
  children: ChildProfile[];
  activeChildId: string | null;
  activity: ActivityRecord[];
}

const KEY = 'akshara.progress.v1';
/** Keep the history bounded so storage never fills up. */
const MAX_RECORDS = 5000;
export const AVATARS = ['🦁', '🐯', '🐼', '🐸', '🦋', '🐢', '🦊', '🐰', '🐨', '🦄'];

const EMPTY: ProgressState = { children: [], activeChildId: null, activity: [] };
let cache: ProgressState | null = null;
const listeners = new Set<() => void>();

function read(): ProgressState {
  if (cache) return cache;
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? { ...EMPTY, ...(JSON.parse(raw) as ProgressState) } : { ...EMPTY };
  } catch {
    cache = { ...EMPTY };
  }
  return cache;
}

function write(next: ProgressState): void {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: progress lives for this session only */
  }
  listeners.forEach((l) => l());
}

export function subscribeProgress(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      listener();
    }
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

/** Snapshot for useSyncExternalStore (stable identity until something changes). */
export function getProgressSnapshot(): ProgressState {
  return read();
}
export function getServerProgressSnapshot(): ProgressState {
  return EMPTY;
}

/** For tests: forget the in-memory copy (storage is the source of truth). */
export function resetProgressCache(): void {
  cache = null;
}

export function addChild(name: string, avatar = AVATARS[0]!): ChildProfile {
  const state = read();
  const child: ChildProfile = {
    id: `child-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || 'Learner',
    avatar,
    createdAt: Date.now(),
  };
  write({
    ...state,
    children: [...state.children, child],
    activeChildId: state.activeChildId ?? child.id,
  });
  return child;
}

export function renameChild(id: string, name: string, avatar?: string): void {
  const state = read();
  write({
    ...state,
    children: state.children.map((c) =>
      c.id === id ? { ...c, name: name.trim() || c.name, avatar: avatar ?? c.avatar } : c
    ),
  });
}

export function removeChild(id: string): void {
  const state = read();
  const children = state.children.filter((c) => c.id !== id);
  write({
    children,
    activeChildId: state.activeChildId === id ? (children[0]?.id ?? null) : state.activeChildId,
    activity: state.activity.filter((a) => a.childId !== id),
  });
}

/** Pick who is learning; an empty id means "nobody yet" (back to the face picker). */
export function setActiveChild(id: string): void {
  const state = read();
  if (id === '') write({ ...state, activeChildId: null });
  else if (state.children.some((c) => c.id === id)) write({ ...state, activeChildId: id });
}

export function getActiveChild(state: ProgressState = read()): ChildProfile | null {
  return state.children.find((c) => c.id === state.activeChildId) ?? null;
}

/** Record something the active learner finished. No-op when nobody is picked. */
export function recordActivity(
  entry: Omit<ActivityRecord, 'childId' | 'at'> & { at?: number }
): void {
  const state = read();
  const child = getActiveChild(state);
  if (!child) return;
  const record: ActivityRecord = { ...entry, childId: child.id, at: entry.at ?? Date.now() };
  write({ ...state, activity: [...state.activity, record].slice(-MAX_RECORDS) });
}

// ---------------------------------------------------------------------------------------------
// Summaries for the parent dashboard
// ---------------------------------------------------------------------------------------------

export interface ItemSummary {
  itemId: string;
  kind: ActivityKind;
  attempts: number;
  bestStars: number;
  lastAccuracy: number;
  lastAt: number;
}

export interface ChildSummary {
  totalActivities: number;
  /** Letters traced with 2+ stars at least once. */
  lettersMastered: number;
  numeralsMastered: number;
  quizAnswered: number;
  quizCorrect: number;
  /** Consecutive days (ending today or yesterday) with any activity. */
  streakDays: number;
  lastActiveAt: number | null;
  /** Activities per day for the last 7 days, oldest first. */
  last7Days: Array<{ day: string; count: number }>;
  items: ItemSummary[];
  /** Traced items with the lowest best stars (most practice needed), worst first. */
  needsPractice: ItemSummary[];
}

const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function summarize(
  activity: ActivityRecord[],
  childId: string,
  now = Date.now()
): ChildSummary {
  const mine = activity.filter((a) => a.childId === childId);
  const byItem = new Map<string, ItemSummary>();
  for (const a of mine) {
    if (a.kind === 'quiz') continue;
    const key = `${a.kind}:${a.itemId}`;
    const prev = byItem.get(key);
    byItem.set(key, {
      itemId: a.itemId,
      kind: a.kind,
      attempts: (prev?.attempts ?? 0) + 1,
      bestStars: Math.max(prev?.bestStars ?? 0, a.stars),
      lastAccuracy: !prev || a.at >= prev.lastAt ? a.accuracy : prev.lastAccuracy,
      lastAt: Math.max(prev?.lastAt ?? 0, a.at),
    });
  }
  const items = [...byItem.values()].sort((a, b) => b.lastAt - a.lastAt);
  const days = new Set(mine.map((a) => dayKey(a.at)));
  let streakDays = 0;
  const oneDay = 24 * 60 * 60 * 1000;
  let cursor = days.has(dayKey(now)) ? now : now - oneDay;
  while (days.has(dayKey(cursor))) {
    streakDays++;
    cursor -= oneDay;
  }
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const t = now - (6 - i) * oneDay;
    const key = dayKey(t);
    return { day: key, count: mine.filter((a) => dayKey(a.at) === key).length };
  });
  const quiz = mine.filter((a) => a.kind === 'quiz');
  return {
    totalActivities: mine.length,
    lettersMastered: items.filter((i) => i.kind === 'letter' && i.bestStars >= 2).length,
    numeralsMastered: items.filter((i) => i.kind === 'numeral' && i.bestStars >= 2).length,
    quizAnswered: quiz.length,
    quizCorrect: quiz.filter((a) => a.stars > 0).length,
    streakDays,
    lastActiveAt: mine.length ? Math.max(...mine.map((a) => a.at)) : null,
    last7Days,
    items,
    needsPractice: items
      .filter((i) => i.bestStars < 3)
      .sort((a, b) => a.bestStars - b.bestStars || a.lastAccuracy - b.lastAccuracy)
      .slice(0, 6),
  };
}

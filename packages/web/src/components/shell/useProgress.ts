'use client';

import { useSyncExternalStore } from 'react';
import { getProgressSnapshot, getServerProgressSnapshot, subscribeProgress } from '@/lib/progress';

/** Live learner profiles + activity (re-renders whenever anything is recorded). */
export function useProgress() {
  return useSyncExternalStore(subscribeProgress, getProgressSnapshot, getServerProgressSnapshot);
}

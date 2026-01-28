'use client';

import { useCallback, useEffect, useState } from 'react';
import { subscribeToGroups } from '@/lib/firestore';
import type { Group } from '@/types';
import { getUserGroups, saveUserGroups } from '@/lib/localDb';
import { useOfflineSync } from './useOfflineSync';
export function useGroups(uid?: string) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const online = useOfflineSync();

  const loadCache = useCallback(async () => {
    if (!uid) return;
    const cache = await getUserGroups(uid);
    if (cache) {
      setGroups(cache.groups);
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    loadCache();
  }, [loadCache]);

  useEffect(() => {
    if (!uid || !online) return;
    const unsub = subscribeToGroups(uid, async nextGroups => {
      setGroups(nextGroups);
      setLoading(false);
      await saveUserGroups(uid, nextGroups);
    });
    return () => unsub();
  }, [online, uid]);

  return { groups, loading };
}

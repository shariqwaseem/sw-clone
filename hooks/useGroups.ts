'use client';

import { useEffect, useState } from 'react';
import { subscribeToGroups } from '@/lib/firestore';
import type { Group } from '@/types';

export function useGroups(uid?: string) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToGroups(uid, nextGroups => {
      setGroups(nextGroups);
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  return { groups, loading };
}

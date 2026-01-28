'use client';

import { useEffect, useState } from 'react';
import { subscribeToGroup } from '@/lib/firestore';
import type { Expense, Group, GroupMember, Payment } from '@/types';
import { getGroupCache, saveGroupCache } from '@/lib/localDb';
import { useOfflineSync } from './useOfflineSync';

export function useGroupData(groupId?: string) {
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const online = useOfflineSync();

  useEffect(() => {
    if (!groupId) return;
    (async () => {
      const cache = await getGroupCache(groupId);
      if (cache) {
        setGroup(cache.group ?? null);
        setMembers(cache.members ?? []);
        setExpenses(cache.expenses ?? []);
        setPayments(cache.payments ?? []);
        setLoading(false);
      }
    })();
  }, [groupId]);

  useEffect(() => {
    if (!groupId || !online) return;
    const unsub = subscribeToGroup(groupId, async next => {
      setGroup(next.group ?? null);
      setMembers(next.members ?? []);
      setExpenses(next.expenses ?? []);
      setPayments(next.payments ?? []);
      setLoading(false);
      await saveGroupCache({
        groupId,
        group: next.group ?? null,
        members: next.members ?? [],
        expenses: next.expenses ?? [],
        payments: next.payments ?? [],
        updatedAt: Date.now()
      });
    });
    return () => unsub();
  }, [groupId, online]);

  return { group, members, expenses, payments, loading };
}

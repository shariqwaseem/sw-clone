'use client';

import { useEffect, useState } from 'react';
import { subscribeToGroup } from '@/lib/firestore';
import type { Expense, Group, GroupMember, Payment } from '@/types';

export function useGroupData(groupId?: string) {
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) return;
    const unsub = subscribeToGroup(groupId, next => {
      setGroup(next.group ?? null);
      setMembers(next.members ?? []);
      setExpenses(next.expenses ?? []);
      setPayments(next.payments ?? []);
      setLoading(false);
    });
    return () => unsub();
  }, [groupId]);

  return { group, members, expenses, payments, loading };
}

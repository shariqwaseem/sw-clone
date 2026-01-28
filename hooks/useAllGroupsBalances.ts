'use client';

import { useEffect, useState } from 'react';
import { useGroups } from './useGroups';
import { subscribeToGroup } from '@/lib/firestore';
import { computeGroupNetBalances, simplifySettlements } from '@/lib/calculations';
import type { Expense, GroupMember, Payment } from '@/types';

export interface PersonBalance {
  uid: string;
  displayName: string;
  amount: number; // positive = they owe you, negative = you owe them
}

interface GroupData {
  members: GroupMember[];
  expenses: Expense[];
  payments: Payment[];
}

export function useAllGroupsBalances(uid?: string) {
  const { groups, loading: groupsLoading } = useGroups(uid);
  const [groupDataMap, setGroupDataMap] = useState<Record<string, GroupData>>({});
  const [loadedGroupIds, setLoadedGroupIds] = useState<Set<string>>(new Set());

  // Subscribe to each group's data
  useEffect(() => {
    if (!uid || groupsLoading) {
      return;
    }

    if (groups.length === 0) {
      setGroupDataMap({});
      setLoadedGroupIds(new Set());
      return;
    }

    const unsubscribers: (() => void)[] = [];

    for (const group of groups) {
      const unsub = subscribeToGroup(group.id, data => {
        setGroupDataMap(prev => ({
          ...prev,
          [group.id]: {
            members: data.members,
            expenses: data.expenses,
            payments: data.payments
          }
        }));
        setLoadedGroupIds(prev => new Set([...prev, group.id]));
      });
      unsubscribers.push(unsub);
    }

    return () => {
      unsubscribers.forEach(unsub => unsub());
      setLoadedGroupIds(new Set());
    };
  }, [uid, groups, groupsLoading]);

  // Loading until all groups have reported data
  const allGroupsLoaded = !groupsLoading && groups.length > 0 && groups.every(g => loadedGroupIds.has(g.id));
  const loading = groupsLoading || (groups.length > 0 && !allGroupsLoaded);

  // Compute aggregated balances
  const balances: PersonBalance[] = [];

  if (uid && !loading) {
    // Map of uid -> aggregated amount
    const aggregated: Record<string, { displayName: string; amount: number }> = {};

    for (const groupId of Object.keys(groupDataMap)) {
      const data = groupDataMap[groupId];
      if (!data.members.length) continue;

      // Compute net balances for this group
      const netBalances = computeGroupNetBalances(data.expenses, data.payments, data.members);

      // Get settlements for this group
      const settlements = simplifySettlements(netBalances);

      // Find settlements involving the current user
      for (const settlement of settlements) {
        if (settlement.fromUid === uid) {
          // Current user owes someone
          const otherMember = data.members.find(m => m.uid === settlement.toUid);
          const displayName = otherMember?.displayName || settlement.toUid;

          if (!aggregated[settlement.toUid]) {
            aggregated[settlement.toUid] = { displayName, amount: 0 };
          }
          aggregated[settlement.toUid].amount -= settlement.amount; // negative = you owe them
        } else if (settlement.toUid === uid) {
          // Someone owes current user
          const otherMember = data.members.find(m => m.uid === settlement.fromUid);
          const displayName = otherMember?.displayName || settlement.fromUid;

          if (!aggregated[settlement.fromUid]) {
            aggregated[settlement.fromUid] = { displayName, amount: 0 };
          }
          aggregated[settlement.fromUid].amount += settlement.amount; // positive = they owe you
        }
      }
    }

    // Convert to array and filter out zero balances
    for (const [personUid, data] of Object.entries(aggregated)) {
      if (Math.abs(data.amount) > 0.01) {
        balances.push({
          uid: personUid,
          displayName: data.displayName,
          amount: Math.round(data.amount * 100) / 100
        });
      }
    }

    // Sort: people who owe you first (positive amounts), then people you owe (negative)
    balances.sort((a, b) => b.amount - a.amount);
  }

  return { balances, loading };
}

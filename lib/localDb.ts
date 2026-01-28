import type { Expense, Group, GroupMember, Payment } from '@/types';

const GROUP_CACHE_PREFIX = 'sw-group-cache:';
const USER_GROUPS_PREFIX = 'sw-user-groups:';
const MUTATIONS_KEY = 'sw-pending-mutations';

export interface GroupCache {
  groupId: string;
  group: Group | null;
  members: GroupMember[];
  expenses: Expense[];
  payments: Payment[];
  updatedAt: number;
}

export interface UserGroupsCache {
  userId: string;
  groups: Group[];
  updatedAt: number;
}

export type MutationKind =
  | 'createGroup'
  | 'addMember'
  | 'createExpense'
  | 'updateExpense'
  | 'deleteExpense'
  | 'recordPayment'
  | 'deletePayment';

export interface PendingMutation {
  id?: number;
  kind: MutationKind;
  groupId?: string;
  payload: Record<string, unknown>;
  createdAt: number;
}

const safeWindow = typeof window !== 'undefined' ? window : undefined;

function readJSON<T>(key: string): T | undefined {
  if (!safeWindow) return undefined;
  const raw = safeWindow.localStorage.getItem(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn('Failed to parse cache', key, error);
    return undefined;
  }
}

function writeJSON(key: string, value: unknown) {
  if (!safeWindow) return;
  safeWindow.localStorage.setItem(key, JSON.stringify(value));
}

export async function saveGroupCache(cache: GroupCache) {
  writeJSON(GROUP_CACHE_PREFIX + cache.groupId, cache);
}

export async function getGroupCache(groupId: string) {
  return readJSON<GroupCache>(GROUP_CACHE_PREFIX + groupId);
}

export async function saveUserGroups(userId: string, groups: Group[]) {
  writeJSON(USER_GROUPS_PREFIX + userId, { userId, groups, updatedAt: Date.now() } as UserGroupsCache);
}

export async function getUserGroups(userId: string) {
  return readJSON<UserGroupsCache>(USER_GROUPS_PREFIX + userId);
}

export async function mutateCachedGroup(
  groupId: string,
  modifier: (cache: GroupCache) => GroupCache
) {
  const existing =
    (await getGroupCache(groupId)) ?? {
      groupId,
      group: null,
      members: [],
      expenses: [],
      payments: [],
      updatedAt: Date.now()
    };
  const next = modifier(existing);
  next.updatedAt = Date.now();
  await saveGroupCache(next);
}

export async function addPendingMutation(mutation: Omit<PendingMutation, 'id' | 'createdAt'>) {
  const existing = (readJSON<PendingMutation[]>(MUTATIONS_KEY) ?? []).sort((a, b) => a.createdAt - b.createdAt);
  const withId = { ...mutation, createdAt: Date.now(), id: Date.now() + Math.random() } as PendingMutation;
  writeJSON(MUTATIONS_KEY, [...existing, withId]);
}

export async function getPendingMutations() {
  return readJSON<PendingMutation[]>(MUTATIONS_KEY) ?? [];
}

export async function removePendingMutation(id: number) {
  const existing = readJSON<PendingMutation[]>(MUTATIONS_KEY) ?? [];
  writeJSON(MUTATIONS_KEY, existing.filter(mutation => mutation.id !== id));
}

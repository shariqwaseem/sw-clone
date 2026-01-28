import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { firestore } from './firebase';
import type { Expense, Group, GroupMember, Payment, MinimalUser } from '@/types';
import { roundCurrency, validateExpense } from './calculations';
import { mutateCachedGroup } from './localDb';
import { queueMutation } from './offlineQueue';

const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine);

const groupsCol = collection(firestore, 'groups');

export function subscribeToGroups(uid: string, callback: (groups: Group[]) => void) {
  const q = query(groupsCol, where('memberIds', 'array-contains', uid));
  const toMillis = (value: unknown) => {
    if (value && typeof value === 'object' && 'toMillis' in (value as Record<string, unknown>)) {
      return (value as { toMillis: () => number }).toMillis();
    }
    return (value as number) ?? 0;
  };
  return onSnapshot(q, snapshot => {
    const groups: Group[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as Omit<Group, 'id'>;
      groups.push({ ...data, id: docSnap.id });
    });
    groups.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    callback(groups);
  });
}

export async function getGroup(groupId: string): Promise<Group | null> {
  const snap = await getDoc(doc(firestore, 'groups', groupId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Group;
}

export async function createGroup({
  name,
  currency,
  user
}: {
  name: string;
  currency: string;
  user: MinimalUser;
}) {
  if (!isOnline()) {
    throw new Error('Go online to create a new group.');
  }
  const groupDoc = await addDoc(groupsCol, {
    name,
    currency,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    memberIds: [user.uid]
  });

  const member: GroupMember = {
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName ?? 'You',
    joinedAt: Date.now(),
    role: 'admin',
    status: 'active'
  };

  await setDoc(doc(firestore, 'groups', groupDoc.id, 'members', user.uid), member);
  return groupDoc.id;
}

export async function addMemberToGroup(groupId: string, member: GroupMember) {
  await setDoc(doc(firestore, 'groups', groupId, 'members', member.uid), member, { merge: true });
  await updateDoc(doc(firestore, 'groups', groupId), {
    memberIds: arrayUnion(member.uid)
  });
}

export async function removeMemberFromGroup(groupId: string, memberUid: string) {
  if (!isOnline()) {
    throw new Error('Go online to remove a member.');
  }
  // Get current group to update memberIds
  const groupRef = doc(firestore, 'groups', groupId);
  const groupSnap = await getDoc(groupRef);
  if (!groupSnap.exists()) {
    throw new Error('Group not found');
  }
  const groupData = groupSnap.data();
  const updatedMemberIds = (groupData.memberIds || []).filter((uid: string) => uid !== memberUid);

  // Delete member document
  await deleteDoc(doc(firestore, 'groups', groupId, 'members', memberUid));

  // Update memberIds array
  await updateDoc(groupRef, {
    memberIds: updatedMemberIds
  });
}


export function subscribeToGroup(groupId: string, callback: (data: {
  group: Group | null;
  members: GroupMember[];
  expenses: Expense[];
  payments: Payment[];
}) => void) {
  const groupRef = doc(firestore, 'groups', groupId);
  const membersRef = collection(groupRef, 'members');
  const expensesRef = collection(groupRef, 'expenses');
  const paymentsRef = collection(groupRef, 'payments');

  let state: {
    group: Group | null;
    members: GroupMember[];
    expenses: Expense[];
    payments: Payment[];
  } = {
    group: null,
    members: [],
    expenses: [],
    payments: []
  };

  const emit = () => callback(state);

  const unsubscribers = [
    onSnapshot(groupRef, snap => {
      const group = snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<Group, 'id'>) } as Group) : null;
      state = { ...state, group };
      emit();
    })
  ];

  unsubscribers.push(
    onSnapshot(membersRef, snap => {
      state = {
        ...state,
        members: snap.docs.map(docSnap => ({ ...(docSnap.data() as GroupMember), uid: docSnap.id }))
      };
      emit();
    })
  );

  unsubscribers.push(
    onSnapshot(query(expensesRef, orderBy('date', 'desc')), snap => {
      state = {
        ...state,
        expenses: snap.docs.map(docSnap => ({ ...(docSnap.data() as Expense), id: docSnap.id }))
      };
      emit();
    })
  );

  unsubscribers.push(
    onSnapshot(query(paymentsRef, orderBy('date', 'desc')), snap => {
      state = {
        ...state,
        payments: snap.docs.map(docSnap => ({ ...(docSnap.data() as Payment), id: docSnap.id }))
      };
      emit();
    })
  );

  return () => unsubscribers.forEach(unsub => unsub());
}

export async function createExpense(
  groupId: string,
  expense: Omit<Expense, 'createdAt' | 'updatedAt' | 'createdBy'>,
  user: MinimalUser
) {
  const id = expense.id ?? crypto.randomUUID();
  const expenseDoc = doc(firestore, 'groups', groupId, 'expenses', id);
  const prepared: Expense = {
    ...(expense as Expense),
    id,
    createdBy: user.uid,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  validateExpense(prepared);
  if (!isOnline()) {
    await mutateCachedGroup(groupId, cache => ({
      ...cache,
      expenses: [prepared, ...cache.expenses.filter(existing => existing.id !== id)]
    }));
    await queueMutation({ kind: 'createExpense', groupId, payload: { groupId, expense: prepared, user } });
    return;
  }
  await setDoc(expenseDoc, {
    ...expense,
    id,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateExpense(
  groupId: string,
  expenseId: string,
  changes: Partial<Expense>,
  user: MinimalUser
) {
  if (!isOnline()) {
    await mutateCachedGroup(groupId, cache => ({
      ...cache,
      expenses: cache.expenses.map(expense =>
        expense.id === expenseId ? { ...expense, ...changes, updatedAt: Date.now() } : expense
      )
    }));
    await queueMutation({
      kind: 'updateExpense',
      groupId,
      payload: { groupId, expenseId, changes, user }
    });
    return;
  }
  await updateDoc(doc(firestore, 'groups', groupId, 'expenses', expenseId), {
    ...changes,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid
  });
}

export async function softDeleteExpense(groupId: string, expenseId: string) {
  if (!isOnline()) {
    await mutateCachedGroup(groupId, cache => ({
      ...cache,
      expenses: cache.expenses.map(expense =>
        expense.id === expenseId ? { ...expense, isDeleted: true, updatedAt: Date.now() } : expense
      )
    }));
    await queueMutation({ kind: 'deleteExpense', groupId, payload: { groupId, expenseId } });
    return;
  }
  await updateDoc(doc(firestore, 'groups', groupId, 'expenses', expenseId), {
    isDeleted: true,
    updatedAt: serverTimestamp()
  });
}

export async function recordPayment(
  groupId: string,
  payment: Omit<Payment, 'createdAt' | 'createdBy'>,
  user: MinimalUser
) {
  const id = payment.id ?? crypto.randomUUID();
  const prepared: Payment = {
    ...(payment as Payment),
    id,
    createdBy: user.uid,
    createdAt: Date.now()
  };
  if (!isOnline()) {
    await mutateCachedGroup(groupId, cache => ({
      ...cache,
      payments: [prepared, ...cache.payments.filter(existing => existing.id !== id)]
    }));
    await queueMutation({ kind: 'recordPayment', groupId, payload: { groupId, payment: prepared, user } });
    return;
  }
  await setDoc(doc(firestore, 'groups', groupId, 'payments', id), {
    ...payment,
    id,
    createdAt: serverTimestamp(),
    createdBy: user.uid
  });
}

export async function softDeletePayment(groupId: string, paymentId: string) {
  if (!isOnline()) {
    await mutateCachedGroup(groupId, cache => ({
      ...cache,
      payments: cache.payments.map(payment =>
        payment.id === paymentId ? { ...payment, isDeleted: true } : payment
      )
    }));
    await queueMutation({ kind: 'deletePayment', groupId, payload: { groupId, paymentId } });
    return;
  }
  await updateDoc(doc(firestore, 'groups', groupId, 'payments', paymentId), {
    isDeleted: true,
    updatedAt: serverTimestamp()
  });
}

export async function deleteGroupAndData(groupId: string) {
  const groupRef = doc(firestore, 'groups', groupId);
  const collections = ['members', 'expenses', 'payments'];

  for (const path of collections) {
    const snapshot = await getDocs(collection(groupRef, path));
    await Promise.all(snapshot.docs.map(docSnap => deleteDoc(docSnap.ref)));
  }

  await deleteDoc(groupRef);
}

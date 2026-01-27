import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { firestore } from './firebase';
import type { Expense, Group, GroupMember, Payment } from '@/types';
import { roundCurrency, validateExpense } from './calculations';

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

export async function createGroup({
  name,
  currency,
  user
}: {
  name: string;
  currency: string;
  user: User;
}) {
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

export async function removeMemberFromGroup(groupId: string, uid: string) {
  await updateDoc(doc(firestore, 'groups', groupId, 'members', uid), {
    status: 'removed'
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
  expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>,
  user: User
) {
  validateExpense({
    ...expense,
    id: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdBy: user.uid
  } as Expense);
  await addDoc(collection(firestore, 'groups', groupId, 'expenses'), {
    ...expense,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateExpense(
  groupId: string,
  expenseId: string,
  changes: Partial<Expense>,
  user: User
) {
  await updateDoc(doc(firestore, 'groups', groupId, 'expenses', expenseId), {
    ...changes,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid
  });
}

export async function softDeleteExpense(groupId: string, expenseId: string) {
  await updateDoc(doc(firestore, 'groups', groupId, 'expenses', expenseId), {
    isDeleted: true,
    updatedAt: serverTimestamp()
  });
}

export async function recordPayment(
  groupId: string,
  payment: Omit<Payment, 'id' | 'createdAt' | 'createdBy'>,
  user: User
) {
  await addDoc(collection(firestore, 'groups', groupId, 'payments'), {
    ...payment,
    createdAt: serverTimestamp(),
    createdBy: user.uid
  });
}

export async function softDeletePayment(groupId: string, paymentId: string) {
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

export async function createDemoGroup(user: User) {
  const groupId = await createGroup({
    name: 'Friends Trip',
    currency: 'USD',
    user
  });

  const friends: GroupMember[] = [
    {
      uid: user.uid,
      displayName: user.displayName ?? 'You',
      email: user.email ?? '',
      role: 'admin',
      status: 'active',
      joinedAt: Date.now()
    },
    {
      uid: 'demo-alex',
      displayName: 'Alex',
      email: 'alex@example.com',
      role: 'member',
      status: 'active',
      joinedAt: Date.now()
    },
    {
      uid: 'demo-jamie',
      displayName: 'Jamie',
      email: 'jamie@example.com',
      role: 'member',
      status: 'active',
      joinedAt: Date.now()
    }
  ];

  await Promise.all(friends.map(friend => addMemberToGroup(groupId, friend)));

  await createExpense(
    groupId,
    {
      description: 'Hotel villa',
      totalAmount: 900,
      currency: 'USD',
      date: new Date().toISOString(),
      notes: 'Alex booked the stay',
      payers: [
        { uid: 'demo-alex', amount: 300 },
        { uid: user.uid, amount: 600 }
      ],
      splits: [
        { uid: user.uid, amount: 300 },
        { uid: 'demo-alex', amount: 300 },
        { uid: 'demo-jamie', amount: 300 }
      ]
    },
    user
  );

  await createExpense(
    groupId,
    {
      description: 'Surf lessons',
      totalAmount: 200,
      currency: 'USD',
      date: new Date().toISOString(),
      notes: 'Jamie covered tips',
      payers: [
        { uid: 'demo-jamie', amount: 200 }
      ],
      splits: [
        { uid: user.uid, amount: 80 },
        { uid: 'demo-alex', amount: 60 },
        { uid: 'demo-jamie', amount: 60 }
      ]
    },
    user
  );

  return groupId;
}

import type { GroupMember, Expense, Payment, MinimalUser } from '@/types';
import { addPendingMutation, getPendingMutations, removePendingMutation, type PendingMutation } from './localDb';

export async function queueMutation(mutation: Omit<PendingMutation, 'id' | 'createdAt'>) {
  await addPendingMutation(mutation);
}

export async function flushPendingMutations() {
  const mutations = await getPendingMutations();
  if (!mutations.length) return;
  const firestore = await import('./firestore');
  for (const mutation of mutations) {
    try {
      switch (mutation.kind) {
        case 'createGroup':
          await firestore.createGroup(mutation.payload as { name: string; currency: string; user: MinimalUser });
          break;
        case 'addMember': {
          const { groupId, member } = mutation.payload as { groupId: string; member: GroupMember };
          await firestore.addMemberToGroup(groupId, member);
          break;
        }
        case 'createExpense': {
          const { groupId, expense, user } = mutation.payload as {
            groupId: string;
            expense: Expense;
            user: MinimalUser;
          };
          await firestore.createExpense(groupId, expense, user);
          break;
        }
        case 'updateExpense': {
          const { groupId, expenseId, changes, user } = mutation.payload as {
            groupId: string;
            expenseId: string;
            changes: Partial<Expense>;
            user: MinimalUser;
          };
          await firestore.updateExpense(groupId, expenseId, changes, user);
          break;
        }
        case 'deleteExpense': {
          const { groupId, expenseId } = mutation.payload as { groupId: string; expenseId: string };
          await firestore.softDeleteExpense(groupId, expenseId);
          break;
        }
        case 'recordPayment': {
          const { groupId, payment, user } = mutation.payload as {
            groupId: string;
            payment: Payment;
            user: MinimalUser;
          };
          await firestore.recordPayment(groupId, payment, user);
          break;
        }
        case 'deletePayment': {
          const { groupId, paymentId } = mutation.payload as { groupId: string; paymentId: string };
          await firestore.softDeletePayment(groupId, paymentId);
          break;
        }
        default:
          break;
      }
      if (mutation.id != null) {
        await removePendingMutation(mutation.id);
      }
    } catch (error) {
      console.error('Failed to replay mutation', mutation, error);
      break;
    }
  }
}

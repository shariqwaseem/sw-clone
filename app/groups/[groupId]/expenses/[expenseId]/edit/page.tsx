'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/components/TopNav';
import { useGroupData } from '@/hooks/useGroupData';
import { ExpenseForm } from '@/components/ExpenseForm';
import { useAuthContext } from '@/components/AuthProvider';

export default function EditExpensePage() {
  const params = useParams<{ groupId: string; expenseId: string }>();
  const { groupId, expenseId } = params ?? {};
  const router = useRouter();
  const { group, members, expenses, loading } = useGroupData(groupId);
  const activeMembers = members.filter(member => member.status !== 'removed');
  const expense = expenses.find(e => e.id === expenseId);
  const { user, loading: authLoading } = useAuthContext();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/');
    }
  }, [authLoading, router, user]);

  if (!groupId || !expenseId) return null;

  return (
    <div className="min-h-screen bg-slate-100">
      <TopNav />
      <main className="mx-auto max-w-2xl space-y-6 px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold">Edit expense</h1>
          <Link href={`/groups/${groupId}`} className="text-sm text-brand hover:text-brand-dark">
            Back to group
          </Link>
        </div>
        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : !group ? (
          <p className="text-slate-500">Group not found.</p>
        ) : expense ? (
          <ExpenseForm
            groupId={groupId}
            members={activeMembers}
            currency={group.currency}
            expense={expense}
            onSaved={() => router.push(`/groups/${groupId}`)}
          />
        ) : (
          <p className="text-slate-500">Expense not found.</p>
        )}
      </main>
    </div>
  );
}

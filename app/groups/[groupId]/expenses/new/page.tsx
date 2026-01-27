'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/components/TopNav';
import { useGroupData } from '@/hooks/useGroupData';
import { ExpenseForm } from '@/components/ExpenseForm';
import { useAuthContext } from '@/components/AuthProvider';

export default function NewExpensePage() {
  const params = useParams<{ groupId: string }>();
  const groupId = params?.groupId;
  const router = useRouter();
  const { group, members, loading } = useGroupData(groupId);
  const activeMembers = members.filter(member => member.status !== 'removed');
  const { user, loading: authLoading } = useAuthContext();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/');
    }
  }, [authLoading, router, user]);

  if (!groupId) return null;

  return (
    <div className="min-h-screen bg-slate-100">
      <TopNav />
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Add expense</h1>
          <Link href={`/groups/${groupId}`} className="text-sm text-brand">
            ← Back to group
          </Link>
        </div>
        {loading ? (
          <p className="text-slate-500">Loading…</p>
        ) : !group ? (
          <p className="text-slate-500">Group not found.</p>
        ) : (
          <ExpenseForm
            groupId={groupId}
            members={activeMembers}
            currency={group.currency}
            onSaved={() => router.push(`/groups/${groupId}`)}
          />
        )}
      </main>
    </div>
  );
}

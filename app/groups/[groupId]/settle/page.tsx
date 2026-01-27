'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/components/TopNav';
import { useGroupData } from '@/hooks/useGroupData';
import { recordPayment } from '@/lib/firestore';
import { useAuthContext } from '@/components/AuthProvider';

export default function SettlePage() {
  const params = useParams<{ groupId: string }>();
  const groupId = params?.groupId;
  const router = useRouter();
  const { group, members, loading } = useGroupData(groupId);
  const activeMembers = members.filter(member => member.status !== 'removed');
  const { user, loading: authLoading } = useAuthContext();
  const [fromUid, setFromUid] = useState('');
  const [toUid, setToUid] = useState('');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [note, setNote] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/');
    }
  }, [authLoading, router, user]);

  if (!groupId) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (!fromUid || !toUid || fromUid === toUid) {
      setStatus('Choose two different members');
      return;
    }
    if (amount <= 0) {
      setStatus('Amount must be greater than zero');
      return;
    }
    try {
      await recordPayment(
        groupId,
        {
          fromUid,
          toUid,
          amount,
          date,
          note
        },
        user
      );
      setStatus('Payment saved');
      router.push(`/groups/${groupId}`);
    } catch (error) {
      setStatus((error as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <TopNav />
      <main className="mx-auto max-w-xl space-y-6 px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Record a payment</h1>
          <Link href={`/groups/${groupId}`} className="text-sm text-brand">
            ← Back to group
          </Link>
        </div>
        {loading ? (
          <p className="text-slate-500">Loading…</p>
        ) : !group ? (
          <p className="text-slate-500">Group not found.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
            <label className="block text-sm">
              <span>From</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={fromUid}
                onChange={event => setFromUid(event.target.value)}
              >
                <option value="">Select member</option>
                {activeMembers.map(member => (
                  <option key={member.uid} value={member.uid}>
                    {member.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span>To</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={toUid}
                onChange={event => setToUid(event.target.value)}
              >
                <option value="">Select member</option>
                {activeMembers.map(member => (
                  <option key={member.uid} value={member.uid}>
                    {member.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span>Amount</span>
              <input
                inputMode="decimal"
                value={amount ? amount.toString() : ''}
                onChange={event => setAmount(event.target.value === '' ? 0 : parseFloat(event.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span>Date</span>
              <input
                type="date"
                value={date}
                onChange={event => setDate(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span>Note</span>
              <input
                value={note}
                onChange={event => setNote(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            {status && <p className="text-sm text-rose-600">{status}</p>}
            <button type="submit" className="w-full rounded-lg bg-brand px-4 py-2 font-medium text-white">
              Save payment
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

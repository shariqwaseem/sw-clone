'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/components/AuthProvider';
import { TopNav } from '@/components/TopNav';
import { useGroups } from '@/hooks/useGroups';
import { useAllGroupsBalances } from '@/hooks/useAllGroupsBalances';
import { createGroup, addMemberToGroup } from '@/lib/firestore';

export default function GroupsPage() {
  const { user, loading: authLoading } = useAuthContext();
  const router = useRouter();
  const { groups, loading: groupsLoading } = useGroups(user?.uid);
  const { balances, loading: balancesLoading } = useAllGroupsBalances(user?.uid);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('PKR');
  const [joinCode, setJoinCode] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/');
    }
  }, [authLoading, router, user]);

  const handleCreateGroup = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !name.trim()) return;
    try {
      await createGroup({ name: name.trim(), currency, user });
      setName('');
      setStatus('Group created!');
    } catch (error) {
      setStatus((error as Error).message);
    }
  };

  const handleJoinGroup = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !joinCode.trim()) return;
    try {
      await addMemberToGroup(joinCode.trim(), {
        uid: user.uid,
        displayName: user.displayName ?? user.email ?? 'You',
        email: user.email ?? '',
        joinedAt: Date.now(),
        role: 'member',
        status: 'active'
      });
      setJoinCode('');
      setStatus('Joined group!');
    } catch (error) {
      setStatus((error as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <TopNav />
      <main className="mx-auto max-w-5xl space-y-6 sm:space-y-8 px-4 sm:px-6 py-6 sm:py-10">
        {/* Your groups - hidden when empty */}
        {!groupsLoading && groups.length > 0 && (
          <section className="card">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Your groups</h2>
            </div>
            <ul className="mt-4 space-y-3">
              {groups.map(group => (
                <li key={group.id}>
                  <Link
                    href={`/groups/${group.id}`}
                    className="block rounded-xl border border-slate-200 px-4 py-4 transition-colors hover:border-slate-300 hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{group.name}</p>
                        <p className="text-sm text-slate-500 truncate">{group.currency} · Code: {group.id}</p>
                      </div>
                      <span className="shrink-0 rounded-lg px-4 py-2 text-sm font-medium text-brand">
                        Open
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Overall Balance */}
        <section className="card">
          <h2 className="text-xl font-semibold">Overall Balance</h2>
          {balancesLoading ? (
            <p className="mt-4 text-slate-500">Calculating balances...</p>
          ) : balances.length === 0 ? (
            <p className="mt-4 text-slate-500">All settled up!</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {balances.filter(b => b.amount > 0).map(person => (
                <li key={person.uid} className="flex justify-between">
                  <span>{person.displayName}</span>
                  <span className="text-emerald-600 font-medium">owes you {person.amount.toFixed(2)}</span>
                </li>
              ))}
              {balances.filter(b => b.amount < 0).map(person => (
                <li key={person.uid} className="flex justify-between">
                  <span>{person.displayName}</span>
                  <span className="text-rose-600 font-medium">you owe {Math.abs(person.amount).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Create a group */}
        <section className="card">
          <h2 className="text-xl font-semibold">Create a group</h2>
          <form onSubmit={handleCreateGroup} className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
            <label className="flex-1 space-y-1">
              <span className="text-sm text-slate-600">Group name</span>
              <input
                required
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="Trip to Skardu"
                className="input-base"
              />
            </label>
            <label className="w-full sm:w-36 space-y-1">
              <span className="text-sm text-slate-600">Currency</span>
              <select
                value={currency}
                onChange={event => setCurrency(event.target.value)}
                className="select-base"
              >
                <option value="PKR">PKR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="INR">INR</option>
                <option value="GBP">GBP</option>
              </select>
            </label>
            <button type="submit" className="btn-primary w-full sm:w-auto">
              Create group
            </button>
          </form>
        </section>

        {/* Join via share code */}
        <section className="card">
          <h2 className="text-xl font-semibold">Join via share code</h2>
          <form onSubmit={handleJoinGroup} className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
            <label className="flex-1 space-y-1">
              <span className="text-sm text-slate-600">Group ID</span>
              <input
                value={joinCode}
                onChange={event => setJoinCode(event.target.value)}
                placeholder="Enter group ID"
                className="input-base"
              />
            </label>
            <button type="submit" className="btn-secondary w-full sm:w-auto">
              Join group
            </button>
          </form>
          <p className="mt-3 text-sm text-slate-500">
            Share your group ID from the dashboard with friends to add them quickly.
          </p>
        </section>

        {status && <p className="text-sm text-slate-500">{status}</p>}
      </main>
    </div>
  );
}

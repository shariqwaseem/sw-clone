'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/components/AuthProvider';
import { TopNav } from '@/components/TopNav';
import { useGroups } from '@/hooks/useGroups';
import { createDemoGroup, createGroup, addMemberToGroup } from '@/lib/firestore';

export default function GroupsPage() {
  const { user, loading: authLoading } = useAuthContext();
  const router = useRouter();
  const { groups, loading: groupsLoading } = useGroups(user?.uid);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USD');
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

  const handleDemoGroup = async () => {
    if (!user) return;
    setStatus('Creating demo data…');
    try {
      await createDemoGroup(user);
      setStatus('Demo group created.');
    } catch (error) {
      setStatus((error as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <TopNav />
      <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Create a group</h2>
          <form onSubmit={handleCreateGroup} className="mt-4 grid gap-4 md:grid-cols-3">
            <input
              required
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Trip to Iceland"
              className="rounded-lg border border-slate-200 px-3 py-2"
            />
            <select
              value={currency}
              onChange={event => setCurrency(event.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value="PKR">PKR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="INR">INR</option>
              <option value="GBP">GBP</option>
            </select>
            <button
              type="submit"
              className="rounded-lg bg-brand px-4 py-2 font-medium text-white transition hover:bg-brand-dark"
            >
              Create group
            </button>
          </form>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Join via share code</h2>
          <form onSubmit={handleJoinGroup} className="mt-4 flex flex-col gap-4 md:flex-row">
            <input
              value={joinCode}
              onChange={event => setJoinCode(event.target.value)}
              placeholder="Enter group ID"
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2"
            />
            <button
              type="submit"
              className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
            >
              Join group
            </button>
          </form>
          <p className="mt-2 text-sm text-slate-500">
            Share your group ID from the dashboard with friends to add them quickly.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Your groups</h2>
            <button onClick={handleDemoGroup} className="text-sm font-medium text-brand">
              Seed demo group
            </button>
          </div>
          {groupsLoading ? (
            <p className="mt-4 text-slate-500">Loading groups…</p>
          ) : groups.length === 0 ? (
            <p className="mt-4 text-slate-500">No groups yet. Create one above.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {groups.map(group => (
                <li key={group.id} className="rounded-xl border border-slate-200 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{group.name}</p>
                      <p className="text-sm text-slate-500">{group.currency} · Share code: {group.id}</p>
                    </div>
                    <Link href={`/groups/${group.id}`} className="font-medium text-brand">
                      Open →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {status && <p className="mt-4 text-sm text-slate-500">{status}</p>}
        </section>
      </main>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthContext } from '@/components/AuthProvider';
import { addMemberToGroup, getGroup } from '@/lib/firestore';
import type { Group } from '@/types';

export default function InvitePage() {
  const params = useParams<{ groupId: string }>();
  const groupId = params?.groupId;
  const router = useRouter();
  const { user, loading: authLoading, signIn } = useAuthContext();
  const [group, setGroup] = useState<Group | null>(null);
  const [loadingGroup, setLoadingGroup] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  // Fetch group info to show the name
  useEffect(() => {
    if (!groupId) return;

    const fetchGroup = async () => {
      try {
        const groupData = await getGroup(groupId);
        setGroup(groupData);
      } catch {
        setError('Group not found or invalid invite link.');
      } finally {
        setLoadingGroup(false);
      }
    };

    fetchGroup();
  }, [groupId]);

  // Store pending invite before sign-in
  const handleSignIn = () => {
    if (groupId) {
      localStorage.setItem('pendingInvite', groupId);
    }
    signIn();
  };

  // Auto-join when user is authenticated
  useEffect(() => {
    if (authLoading || !user || !groupId || !group || joining) return;

    const joinGroup = async () => {
      setJoining(true);
      try {
        await addMemberToGroup(groupId, {
          uid: user.uid,
          displayName: user.displayName ?? user.email ?? 'User',
          email: user.email ?? '',
          joinedAt: Date.now(),
          role: 'member',
          status: 'active'
        });
        // Clear any pending invite
        localStorage.removeItem('pendingInvite');
        // Redirect to the group
        router.replace(`/groups/${groupId}`);
      } catch (err) {
        const message = (err as Error).message;
        // If already a member, just redirect
        if (message.includes('already a member')) {
          localStorage.removeItem('pendingInvite');
          router.replace(`/groups/${groupId}`);
        } else {
          setError(message);
          setJoining(false);
        }
      }
    };

    joinGroup();
  }, [authLoading, user, groupId, group, joining, router]);

  if (!groupId) return null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 px-4 sm:px-6 text-center">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 sm:p-10 shadow-lg shadow-slate-200/50">
        {loadingGroup ? (
          <p className="text-slate-500">Loading invite...</p>
        ) : error ? (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
              <svg className="h-6 w-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-slate-900">Invalid Invite</h1>
            <p className="mt-2 text-slate-600">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="btn-secondary mt-6 w-full"
            >
              Go to Home
            </button>
          </>
        ) : group ? (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <svg className="h-6 w-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-slate-900">You&apos;re invited!</h1>
            <p className="mt-2 text-slate-600">
              Join <span className="font-medium text-slate-900">{group.name}</span> to start splitting expenses.
            </p>

            {authLoading || joining ? (
              <div className="mt-8">
                <p className="text-slate-500">{joining ? 'Joining group...' : 'Loading...'}</p>
              </div>
            ) : user ? (
              <div className="mt-8">
                <p className="text-slate-500">Joining as {user.displayName ?? user.email}...</p>
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                className="btn-primary mt-8 w-full"
              >
                Sign in to join
              </button>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}

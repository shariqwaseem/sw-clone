'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/components/AuthProvider';

export default function HomePage() {
  const { user, loading, signIn } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/groups');
    }
  }, [loading, router, user]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="max-w-xl rounded-2xl bg-white p-10 shadow">
        <h1 className="text-3xl font-semibold text-slate-900">Splitwise-style expense sharing</h1>
        <p className="mt-4 text-slate-600">
          Track groups, log complex expenses, and settle balances with Firebase-backed precision.
        </p>
        <button
          className="mt-8 w-full rounded-lg bg-blue-600 px-4 py-3 text-white shadow transition hover:bg-blue-700"
          onClick={signIn}
          disabled={loading}
        >
          {loading ? 'Preparing sign-in…' : 'Continue with Google'}
        </button>
      </div>
    </main>
  );
}

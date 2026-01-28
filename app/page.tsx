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
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 px-4 sm:px-6 text-center">
      <div className="w-full max-w-md sm:max-w-xl rounded-3xl bg-white p-8 sm:p-10 shadow-lg shadow-slate-200/50">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Splitwise-style expense sharing</h1>
        <p className="mt-4 text-slate-600">
          Track groups, log complex expenses, and settle balances with Firebase-backed precision.
        </p>
        <button
          className="btn-primary mt-8 w-full"
          onClick={signIn}
          disabled={loading}
        >
          {loading ? 'Preparing sign-in...' : 'Continue with Google'}
        </button>
      </div>
    </main>
  );
}

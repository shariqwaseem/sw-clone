'use client';

import Link from 'next/link';
import { useAuthContext } from './AuthProvider';

export function TopNav() {
  const { user, signOut } = useAuthContext();

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
      <Link href="/groups" className="text-lg font-semibold text-slate-900">
        Splitwise Clone
      </Link>
      <div className="flex items-center gap-4">
        {user && (
          <div className="text-sm text-slate-600">
            {user.photoURL && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.photoURL} alt={user.displayName ?? 'avatar'} className="mr-2 inline-block h-8 w-8 rounded-full" />
            )}
            <span>{user.displayName ?? user.email}</span>
          </div>
        )}
        <button
          onClick={signOut}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

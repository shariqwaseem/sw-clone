'use client';

import Link from 'next/link';
import { useAuthContext } from './AuthProvider';

export function TopNav() {
  const { user, signOut } = useAuthContext();

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur-lg px-4 py-3 sm:px-6 sm:py-4">
      <Link href="/groups" className="text-lg font-semibold text-slate-900">
        Splitwise Clone
      </Link>
      <div className="flex items-center gap-3 sm:gap-4">
        {user && (
          <div className="flex items-center text-sm text-slate-600">
            {user.photoURL && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.photoURL} alt={user.displayName ?? 'avatar'} className="mr-2 h-8 w-8 rounded-full" />
            )}
            <span className="hidden sm:inline max-w-[150px] truncate">{user.displayName ?? user.email}</span>
          </div>
        )}
        <button
          onClick={signOut}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

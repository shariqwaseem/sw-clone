'use client';

import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from './AuthProvider';

interface Props {
  children: ReactNode;
  redirectTo?: string;
}

export function AuthGate({ children, redirectTo = '/groups' }: Props) {
  const { user, loading } = useAuthContext();
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-lg text-slate-600">
        Loading your account...
      </div>
    );
  }

  if (!user) {
    router.push('/');
    return null;
  }

  return <>{children}</>;
}

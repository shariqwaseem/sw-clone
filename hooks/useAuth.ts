'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const signingIn = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, current => {
      setUser(current);
      setLoading(false);
      signingIn.current = false;
    });

    return () => unsub();
  }, []);

  const signIn = useCallback(async () => {
    // Prevent multiple popup requests
    if (signingIn.current) return;
    signingIn.current = true;

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const error = err as { code?: string };
      // Ignore cancelled popup errors (user closed it or clicked button twice)
      if (error.code !== 'auth/cancelled-popup-request' && error.code !== 'auth/popup-closed-by-user') {
        console.error('Sign in error:', error);
      }
      signingIn.current = false;
    }
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
  }, []);

  return { user, loading, signIn, signOut: signOutUser };
}

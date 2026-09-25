'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export function useAuthSession() {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isAuthLoaded, setIsAuthLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    let authEventReceived = false;
    // Obtém sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted || authEventReceived) return;
      setUser(session?.user ?? null);
      setIsAuthLoaded(true);
    }).catch(() => { if (isMounted) setIsAuthLoaded(true); });

    // Inscrição reativa para alterações de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      authEventReceived = true;
      setUser(session?.user ?? null);
      setIsAuthLoaded(true);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
    setUser(null);
  }, [supabase]);

  return {
    supabase,
    user,
    setUser,
    isAuthLoaded,
    signOut,
  };
}

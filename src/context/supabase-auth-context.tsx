"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { SupabaseClient, User } from "@supabase/supabase-js";

interface SupabaseAuthContextType {
  supabase: SupabaseClient;
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const SupabaseAuthContext = createContext<SupabaseAuthContextType | null>(null);

// Global user cache - persists across re-renders
let globalUser: User | null = null;
let globalUserExpiry = 0;
const USER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(globalUser);
  const [loading, setLoading] = useState(!globalUser);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  const refreshUser = useCallback(async () => {
    try {
      // Check global cache first
      if (globalUser && Date.now() < globalUserExpiry) {
        setUser(globalUser);
        setLoading(false);
        return;
      }

      const { data: { user: authUser } } = await client.auth.getUser();
      globalUser = authUser;
      globalUserExpiry = Date.now() + USER_CACHE_TTL;
      setUser(authUser);
    } catch (err) {
      console.error("[SupabaseAuth] Error refreshing user:", err);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    // Initial load
    refreshUser();

    // Listen for auth state changes
    const { data: { subscription } } = client.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          globalUser = session?.user || null;
          globalUserExpiry = Date.now() + USER_CACHE_TTL;
          setUser(globalUser);
        } else if (event === "SIGNED_OUT") {
          globalUser = null;
          globalUserExpiry = 0;
          setUser(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [client, refreshUser]);

  return (
    <SupabaseAuthContext.Provider value={{ supabase: client, user, loading, refreshUser }}>
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const context = useContext(SupabaseAuthContext);
  if (!context) throw new Error("useSupabaseAuth must be used within SupabaseAuthProvider");
  return context;
}

// Convenience hook for just getting the client (reuses cached auth)
export function useSupabase() {
  const { supabase } = useSupabaseAuth();
  return supabase;
}

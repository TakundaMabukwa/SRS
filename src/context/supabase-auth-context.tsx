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
let lastTokenRefresh = 0;
const USER_CACHE_TTL = 55 * 60 * 1000; // 55 minutes (JWT lasts 1 hour)
const TOKEN_REFRESH_THRESHOLD = 50 * 60 * 1000; // Refresh at 50 minutes

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(globalUser);
  const [loading, setLoading] = useState(!globalUser);

  const refreshUser = useCallback(async (force = false) => {
    try {
      // Check if user is still valid (not expired)
      if (!force && globalUser && Date.now() < globalUserExpiry) {
        setUser(globalUser);
        setLoading(false);
        return;
      }

      // Only refresh token if it's been more than 50 minutes since last refresh
      const now = Date.now();
      if (!force && now - lastTokenRefresh < TOKEN_REFRESH_THRESHOLD) {
        setUser(globalUser);
        setLoading(false);
        return;
      }

      // Get session without triggering automatic refresh
      const { data: { session } } = await client.auth.getSession();
      
      if (session?.user) {
        globalUser = session.user;
        globalUserExpiry = now + USER_CACHE_TTL;
        lastTokenRefresh = now;
        setUser(globalUser);
      } else {
        globalUser = null;
        globalUserExpiry = 0;
        setUser(null);
      }
    } catch (err) {
      console.error("[SupabaseAuth] Error refreshing user:", err);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    // Initial load
    refreshUser();

    // Listen for auth state changes - only update on actual events
    const { data: { subscription } } = client.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          globalUser = session?.user || null;
          globalUserExpiry = Date.now() + USER_CACHE_TTL;
          lastTokenRefresh = Date.now();
          setUser(globalUser);
        } else if (event === "SIGNED_OUT") {
          globalUser = null;
          globalUserExpiry = 0;
          lastTokenRefresh = 0;
          setUser(null);
        }
        // Ignore other events to reduce unnecessary calls
      }
    );

    return () => {
      subscription.unsubscribe();
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

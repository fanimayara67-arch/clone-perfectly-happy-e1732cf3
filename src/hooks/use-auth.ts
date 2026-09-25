import { useEffect, useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface AuthState {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  adminCheckError: boolean;
}

const ADMIN_CHECK_RETRIES = 3;

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminCheckError, setAdminCheckError] = useState(false);

  useEffect(() => {
    let active = true;

    const checkAdmin = async (uid: string | undefined) => {
      if (!uid) {
        if (active) { setIsAdmin(false); setAdminCheckError(false); }
        return;
      }
      for (let attempt = 0; attempt < ADMIN_CHECK_RETRIES; attempt++) {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", uid)
          .eq("role", "admin")
          .maybeSingle();
        if (!active) return;
        if (!error) { setIsAdmin(!!data); setAdminCheckError(false); return; }
        if (attempt < ADMIN_CHECK_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
        }
      }
      if (active) setAdminCheckError(true);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!active) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      // defer to avoid deadlock
      setTimeout(() => checkAdmin(newSession?.user?.id), 0);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!active) return;
      setSession(s);
      setUser(s?.user ?? null);
      checkAdmin(s?.user?.id).finally(() => {
        if (active) setLoading(false);
      });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, session, isAdmin, loading, adminCheckError };
}

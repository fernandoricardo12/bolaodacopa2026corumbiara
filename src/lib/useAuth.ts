import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AuthState = {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
};

function isInvalidRefreshToken(error: unknown) {
  const value = error as { message?: string; code?: string; value?: { message?: string; code?: string } } | null;
  const message = value?.message ?? value?.value?.message ?? "";
  const code = value?.code ?? value?.value?.code ?? "";
  return code === "refresh_token_not_found" || message.includes("Invalid Refresh Token");
}

async function clearBrokenSession() {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {}

  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("sb-") && key.endsWith("-auth-token")) window.localStorage.removeItem(key);
    }
  } catch {}
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (cancelled) return;
      setSession(s);
      setSessionLoading(false);
      if (!s?.user) {
        setIsAdmin(false);
        setRoleLoading(false);
      }
    });

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) throw error;
        setSession(data.session);
        setSessionLoading(false);
        if (!data.session?.user) {
          setIsAdmin(false);
          setRoleLoading(false);
        }
      })
      .catch(async (error) => {
        console.error("[Auth] falha ao recuperar sessão:", error);
        if (isInvalidRefreshToken(error)) await clearBrokenSession();
        if (cancelled) return;
        setSession(null);
        setIsAdmin(false);
        setSessionLoading(false);
        setRoleLoading(false);
      });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!session?.user) {
      setIsAdmin(false);
      setRoleLoading(false);
      return;
    }
    const userId = session.user.id;
    async function loadRole() {
      setRoleLoading(true);
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();

        if (cancelled) return;
        if (error) throw error;
        setIsAdmin(!!data);
        setRoleLoading(false);
      } catch (error) {
        console.error("[Auth] falha ao verificar permissões:", error);
        if (cancelled) return;
        setIsAdmin(false);
        setRoleLoading(false);
      }
    }
    loadRole();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  return {
    user: session?.user ?? null,
    session,
    isAdmin,
    loading: sessionLoading || (!!session?.user && roleLoading),
  };
}

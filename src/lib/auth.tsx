import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { applyLangue, detectLangue, isLangue, type Langue } from "@/lib/i18n";

type Profile = {
  id: string;
  company_id: string | null;
  full_name: string | null;
  role: string;
  langue: string;
};

type Company = {
  id: string;
  name: string;
  bce_number?: string | null;
  address?: string | null;
  logo_url?: string | null;
};

type AuthCtx = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  company: Company | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Change la langue de l'interface et l'enregistre (profil si connecté, sinon appareil). */
  setLangue: (l: Langue) => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string) => {
    // select("*") : reste compatible si la colonne langue n'est pas encore migrée.
    const { data: p } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile(p);
    if (p && isLangue(p.langue)) applyLangue(p.langue, true);
    if (p?.company_id) {
      const { data: c } = await supabase
        .from("companies")
        .select("id, name, bce_number, address, logo_url")
        .eq("id", p.company_id)
        .maybeSingle();
      setCompany(c);
    } else {
      setCompany(null);
    }
  };

  useEffect(() => {
    // Premier rendu en français (identique au SSR), puis langue de l'appareil/navigateur.
    applyLangue(detectLangue());

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess?.user) {
        setTimeout(() => loadProfile(sess.user.id), 0);
      } else {
        setProfile(null);
        setCompany(null);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        loadProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  const setLangue = async (l: Langue) => {
    applyLangue(l, true);
    if (!profile) return;
    setProfile({ ...profile, langue: l });
    await supabase.from("profiles").update({ langue: l }).eq("id", profile.id);
  };

  return (
    <Ctx.Provider
      value={{
        user: session?.user ?? null,
        session,
        profile,
        company,
        loading,
        signOut,
        refreshProfile,
        setLangue,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

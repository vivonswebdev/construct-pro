import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HardHat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { errorMessage } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) navigate({ to: "/dashboard", replace: true });
  }, [session, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Connexion réussie");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, company_name: companyName },
          },
        });
        if (error) throw error;
        toast.success("Compte créé. Bienvenue !");
      }
    } catch (err) {
      const msg = errorMessage(err, "Une erreur est survenue");
      setError(msg === "Invalid login credentials" ? "Identifiants invalides" : msg);
    } finally {
      setLoading(false);
    }
  };

  const DEMO_EMAIL = "demo@constructflow.be";
  const DEMO_PASSWORD = "demo1234";

  const loginDemo = async () => {
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });
      if (error) {
        // Create the demo account if it doesn't exist yet
        const { error: signUpError } = await supabase.auth.signUp({
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: "Jean Démo",
              company_name: "Démo Construction SRL",
            },
          },
        });
        if (signUpError) throw signUpError;
        // Auto-confirm is enabled, so we can sign in right away
        const retry = await supabase.auth.signInWithPassword({
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
        });
        if (retry.error) throw retry.error;
      }
      toast.success("Bienvenue sur le compte démo");
    } catch (err) {
      setError(errorMessage(err, "Impossible d'accéder au compte démo"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar-bg px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-white shadow-lg">
            <HardHat className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-white">ConstructFlow</h1>
          <p className="mt-1 text-sm text-sidebar-text">Gérez vos chantiers avec précision</p>
        </div>

        <div className="rounded-2xl bg-card p-6 shadow-xl">
          <div className="mb-5 flex rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                mode === "login" ? "bg-card shadow-sm" : "text-muted-foreground"
              }`}
            >
              Se connecter
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                mode === "signup" ? "bg-card shadow-sm" : "text-muted-foreground"
              }`}
            >
              Créer un compte
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <Field label="Nom de l'entreprise">
                  <input
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ex: Dupont Construction SRL"
                    className="input"
                  />
                </Field>
                <Field label="Votre nom complet">
                  <input
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jean Dupont"
                    className="input"
                  />
                </Field>
              </>
            )}
            <Field label="Email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@entreprise.be"
                className="input"
              />
            </Field>
            <Field label="Mot de passe">
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input"
              />
            </Field>

            {error && (
              <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? "..." : mode === "login" ? "Se connecter" : "Créer mon compte"}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            ou essayez en 1 clic
            <div className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={loginDemo}
            disabled={loading}
            className="w-full rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-60"
          >
            🚀 Accéder au compte démo (pré-rempli)
          </button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            3 chantiers, 5 ouvriers et des présences déjà générés.
          </p>
        </div>
        <p className="mt-6 text-center text-xs text-sidebar-text">© ConstructFlow 2026</p>
      </div>

      <style>{`
        .input {
          width: 100%;
          padding: 0.625rem 0.75rem;
          border: 1px solid var(--color-border);
          border-radius: 0.5rem;
          font-size: 0.875rem;
          background: white;
          color: var(--color-foreground);
          outline: none;
          transition: all 0.15s;
        }
        .input:focus {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-primary) 20%, transparent);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

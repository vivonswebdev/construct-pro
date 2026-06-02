import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HardHat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

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
    } catch (err: any) {
      const msg = err?.message ?? "Une erreur est survenue";
      setError(msg === "Invalid login credentials" ? "Identifiants invalides" : msg);
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
                    placeholder="Ex: Dupont Construction SPRL"
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

import { supabase } from "@/integrations/supabase/client";

/**
 * Signale les erreurs non gérées au back-office (RPC signaler_erreur : société et utilisateur
 * déduits de la session ; 20 erreurs / 10 min par utilisateur ; purge à 90 jours). Page sans
 * paramètres (pas de données dans l'URL). Ne lève jamais d'erreur.
 */
const recentes = new Map<string, number>();

export function signalerErreur(err: unknown) {
  try {
    const e = err instanceof Error ? err : new Error(String(err));
    const cle = `${e.name}:${e.message}`;
    const maintenant = Date.now();
    if ((recentes.get(cle) ?? 0) > maintenant - 30_000) return; // même erreur : 1 fois / 30 s
    recentes.set(cle, maintenant);
    void supabase
      .rpc("signaler_erreur", {
        _code: e.name || "Error",
        _message: e.message.slice(0, 500),
        _page: window.location.pathname.slice(0, 200),
        _navigateur: navigator.userAgent.slice(0, 300),
      })
      .then(
        () => undefined,
        () => undefined,
      );
  } catch {
    // le signalement ne doit jamais gêner l'utilisateur
  }
}

/** Gestionnaires globaux (erreurs et promesses rejetées) ; renvoie la fonction de retrait. */
export function installerSignalementErreurs() {
  const surErreur = (ev: ErrorEvent) => signalerErreur(ev.error ?? ev.message);
  const surRejet = (ev: PromiseRejectionEvent) => signalerErreur(ev.reason);
  window.addEventListener("error", surErreur);
  window.addEventListener("unhandledrejection", surRejet);
  return () => {
    window.removeEventListener("error", surErreur);
    window.removeEventListener("unhandledrejection", surRejet);
  };
}

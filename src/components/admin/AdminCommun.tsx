import { Link } from "@tanstack/react-router";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useAdminPlateforme } from "@/hooks/useAdminPlateforme";
import { formatDateBE } from "@/lib/format";
import { dateHeure } from "@/lib/admin";
import { errorMessage } from "@/lib/utils";
import { useTranslation } from "react-i18next";

/** Garde commune : rien n'est affiché si la base ne reconnaît pas l'administrateur. */
export function GardeAdmin({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation("admin");
  const { data: admin, isLoading } = useAdminPlateforme();
  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  if (!admin)
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-8 text-center">
        <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 font-semibold">{t("denied")}</p>
      </div>
    );
  return <>{children}</>;
}

export function TableUtilisateurs({
  lignes,
  avecSociete,
}: {
  lignes: {
    id: string;
    societe: string | null;
    societe_id: string | null;
    est_demo: boolean;
    role: string;
    cree_le: string;
    derniere_connexion: string | null;
    email: string | null;
    nom: string | null;
  }[];
  avecSociete: boolean;
}) {
  const { t } = useTranslation(["admin", "nav"]);
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-5 py-2 text-left font-semibold">{t("users.user")}</th>
            {avecSociete && (
              <th className="px-3 py-2 text-left font-semibold">{t("users.company")}</th>
            )}
            <th className="px-3 py-2 text-left font-semibold">{t("users.role")}</th>
            <th className="px-3 py-2 text-left font-semibold">{t("users.created")}</th>
            <th className="px-5 py-2 text-left font-semibold">{t("users.lastLogin")}</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((u) => (
            <tr key={u.id} className="border-t border-border">
              <td className="px-5 py-2">
                {u.email ? (
                  <>
                    <span className="font-medium">{u.nom ?? "—"}</span>
                    <span className="block text-xs text-muted-foreground">{u.email}</span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">{t("users.hidden")}</span>
                )}
              </td>
              {avecSociete && (
                <td className="px-3 py-2">
                  {u.societe_id ? (
                    <Link
                      to="/admin/clients/$id"
                      params={{ id: u.societe_id }}
                      className="hover:text-primary hover:underline"
                    >
                      {u.societe}
                    </Link>
                  ) : (
                    "—"
                  )}
                  {u.est_demo && (
                    <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800">
                      {t("demoBadge")}
                    </span>
                  )}
                </td>
              )}
              <td className="px-3 py-2">{t(`nav:roles.${u.role}`, { defaultValue: u.role })}</td>
              <td className="px-3 py-2">{formatDateBE(u.cree_le)}</td>
              <td className="px-5 py-2">
                {u.derniere_connexion ? dateHeure(u.derniere_connexion) : t("users.never")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Erreur de chargement visible (jamais de liste vide silencieuse). */
export function ErreurChargement({ erreur }: { erreur: unknown }) {
  const { t } = useTranslation("admin");
  return (
    <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-semibold">{t("loadError")}</p>
        <p className="text-xs">{errorMessage(erreur)}</p>
      </div>
    </div>
  );
}

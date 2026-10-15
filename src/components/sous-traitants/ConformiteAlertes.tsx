import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useConformite } from "@/hooks/useConformite";
import { ALERTE_JOURS, ajouterJours } from "@/lib/conformite";
import { formatDateBE } from "@/lib/format";
import { aujourdhuiBruxelles } from "@/lib/sous-traitants";
import { useTranslation } from "react-i18next";

/**
 * Alertes de conformité des sous-traitants (tableau de bord) : affectations bloquées,
 * attestations expirées ou invalidées, attestations qui expirent dans les 30 jours.
 */
export function ConformiteAlertes() {
  const { t } = useTranslation(["sousTraitants", "common"]);
  const { data: conformite } = useConformite();
  const jour = aujourdhuiBruxelles();
  const { data } = useQuery({
    queryKey: ["conformite-alertes", jour],
    queryFn: async () => {
      const [st, dc] = await Promise.all([
        supabase.from("sous_traitants").select("id, raison_sociale, statut"),
        supabase
          .from("documents_conformite")
          .select("sous_traitant_id, type_document, date_expiration")
          .is("invalide_le", null)
          .gte("date_expiration", jour)
          .lte("date_expiration", ajouterJours(jour, ALERTE_JOURS))
          .order("date_expiration"),
      ]);
      return { sousTraitants: st.data ?? [], bientot: dc.data ?? [] };
    },
  });
  if (!conformite || !data) return null;

  const nom = new Map(data.sousTraitants.map((s) => [s.id, s.raison_sociale]));
  const actifs = new Set(data.sousTraitants.filter((s) => s.statut === "actif").map((s) => s.id));
  const lignes = [...conformite.values()].filter((l) => actifs.has(l.sous_traitant_id));
  const bloques = lignes.filter((l) => l.bloque);
  const expires = lignes.filter(
    (l) =>
      ["expire", "invalide"].includes(l.attestation_30bis) ||
      ["expire", "invalide"].includes(l.attestation_tva),
  );
  // Une attestation qui expire bientôt n'est signalée que si c'est la meilleure disponible.
  const bientot = data.bientot.filter(
    (d) =>
      actifs.has(d.sous_traitant_id) &&
      conformite.get(d.sous_traitant_id)?.[d.type_document as "attestation_30bis"] ===
        "expire_bientot",
  );
  if (bloques.length + expires.length + bientot.length === 0) return null;

  const Lien = ({ id, children }: { id: string; children: React.ReactNode }) => (
    <Link
      to="/sous-traitants/$id"
      params={{ id }}
      className="block truncate text-xs text-foreground hover:text-primary hover:underline"
    >
      {children}
    </Link>
  );

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-danger" />
        <h3 className="text-base font-semibold">{t("compliance.alerts.title")}</h3>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Bloc
          ton="danger"
          titre={t("compliance.alerts.blocked", { count: bloques.length })}
          vide={t("compliance.alerts.none")}
        >
          {bloques.slice(0, 5).map((l) => (
            <Lien key={l.sous_traitant_id} id={l.sous_traitant_id}>
              {nom.get(l.sous_traitant_id)}
            </Lien>
          ))}
        </Bloc>
        <Bloc
          ton="danger"
          titre={t("compliance.alerts.expired", { count: expires.length })}
          vide={t("compliance.alerts.none")}
        >
          {expires.slice(0, 5).map((l) => (
            <Lien key={l.sous_traitant_id} id={l.sous_traitant_id}>
              {nom.get(l.sous_traitant_id)}
            </Lien>
          ))}
        </Bloc>
        <Bloc
          ton="warning"
          titre={t("compliance.alerts.expiringSoon", { count: bientot.length, days: ALERTE_JOURS })}
          vide={t("compliance.alerts.none")}
        >
          {bientot.slice(0, 5).map((d) => (
            <Lien key={`${d.sous_traitant_id}-${d.type_document}`} id={d.sous_traitant_id}>
              {t("compliance.alerts.expiringItem", {
                name: nom.get(d.sous_traitant_id),
                document: t(`compliance.requirement.${d.type_document as "attestation_30bis"}`),
                date: formatDateBE(d.date_expiration),
              })}
            </Lien>
          ))}
        </Bloc>
      </div>
    </div>
  );
}

function Bloc({
  ton,
  titre,
  vide,
  children,
}: {
  ton: "danger" | "warning";
  titre: string;
  vide: string;
  children: React.ReactNode[];
}) {
  const s =
    ton === "danger"
      ? "border-l-danger bg-red-50/50 text-danger"
      : "border-l-warning bg-amber-50/50 text-warning";
  return (
    <div className={`rounded-lg border border-l-4 border-border p-3 ${s}`}>
      <p className="text-sm font-semibold">{titre}</p>
      <div className="mt-1 space-y-0.5">
        {children.length ? children : <p className="text-xs text-muted-foreground">{vide}</p>}
      </div>
    </div>
  );
}

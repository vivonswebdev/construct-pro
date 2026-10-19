import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileDown, FileSpreadsheet, Handshake, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatEURBE } from "@/lib/belgian";
import { formatDateBE } from "@/lib/format";
import { toutLire } from "@/lib/exports/donnees";
import {
  lignesJournal,
  totalChantier,
  totauxParSousTraitant,
  type PaiementChantier,
  type PrestationChantier,
} from "@/lib/exports/journal";
import { journalCsv, journalPdf, type MetaJournal } from "@/lib/exports/journal-rendu";
import { errorMessage } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { PrestationFormModal } from "./PrestationsSection";

const eur = (n: number | null) => (n == null ? "—" : formatEURBE(n));

/**
 * Fiche chantier : contrats de sous-traitance rattachés, saisie de prestation, totaux par
 * sous-traitant et journal des prestations (exportable en CSV / PDF).
 */
export function ChantierSousTraitants({
  chantierId,
  chantierNom,
  client,
}: {
  chantierId: string;
  chantierNom: string;
  client: string | null;
}) {
  const { t } = useTranslation(["sousTraitants", "common"]);
  const { company } = useAuth();
  const queryClient = useQueryClient();
  const [nouvelle, setNouvelle] = useState(false);
  const cle = ["chantier-sous-traitants", chantierId];
  const { data } = useQuery({
    queryKey: cle,
    queryFn: async () => {
      const ct = await supabase
        .from("sous_traitant_contrats")
        .select("*")
        .eq("chantier_id", chantierId)
        .order("date_debut", { ascending: false });
      if (ct.error) throw ct.error;
      const contrats = ct.data;
      const idsContrats = contrats.map((c) => c.id);
      const [prestations, paiements, st] = await Promise.all([
        toutLire<PrestationChantier>((de, a) =>
          supabase
            .from("sous_traitant_prestations")
            .select(
              "id, contrat_id, date_prestation, description, heures, ouvriers, presence_enregistree, valide_le",
            )
            .eq("chantier_id", chantierId)
            .order("date_prestation", { ascending: false })
            .order("id")
            .range(de, a),
        ),
        idsContrats.length
          ? toutLire<PaiementChantier>((de, a) =>
              supabase
                .from("achat_paiements")
                .select(
                  "contrat_id, montant_ht, retenue_onss, retenue_spf, montant_verse, annule_le",
                )
                .in("contrat_id", idsContrats)
                .order("id")
                .range(de, a),
            )
          : Promise.resolve([]),
        contrats.length
          ? supabase
              .from("sous_traitants")
              .select("id, raison_sociale")
              .in("id", [...new Set(contrats.map((c) => c.sous_traitant_id))])
          : Promise.resolve({ data: [] }),
      ]);
      const noms = new Map((st.data ?? []).map((s) => [s.id, s.raison_sociale]));
      return {
        contrats,
        noms,
        totaux: totauxParSousTraitant(contrats, prestations, paiements, noms),
        journal: lignesJournal(contrats, prestations, noms).reverse(),
      };
    },
  });
  if (!data) return null;
  const tc = totalChantier(data.totaux);
  const meta: MetaJournal = { societe: company?.name ?? "", chantier: chantierNom, client };
  const exporter = (f: () => void) => {
    try {
      f();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const btn =
    "inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50";

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Handshake className="h-5 w-5 text-primary" /> {t("site.title")}
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setNouvelle(true)}
            disabled={data.contrats.length === 0}
            title={data.contrats.length === 0 ? t("site.noContracts") : undefined}
            className={btn}
          >
            <Plus className="h-3.5 w-3.5" /> {t("prestations.new")}
          </button>
          <button
            onClick={() => exporter(() => journalCsv([...data.journal].reverse(), meta))}
            disabled={data.journal.length === 0}
            className={btn}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> {t("site.exportCsv")}
          </button>
          <button
            onClick={() =>
              exporter(() => journalPdf(data.totaux, [...data.journal].reverse(), meta))
            }
            disabled={data.contrats.length === 0}
            className={btn}
          >
            <FileDown className="h-3.5 w-3.5" /> {t("site.exportPdf")}
          </button>
        </div>
      </div>
      {data.contrats.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("site.noContracts")}</p>
      ) : (
        <div className="mb-4 divide-y divide-border rounded-lg border border-border">
          {data.contrats.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm"
            >
              <div>
                <Link
                  to="/sous-traitants/$id"
                  params={{ id: c.sous_traitant_id }}
                  className="font-medium hover:text-primary hover:underline"
                >
                  {data.noms.get(c.sous_traitant_id) ?? "—"}
                </Link>
                <p className="text-xs text-muted-foreground">{c.descriptif_prestations}</p>
              </div>
              <span className="text-sm font-semibold">
                {c.type_prix === "forfait"
                  ? formatEURBE(c.montant_forfait_ht)
                  : `${formatEURBE(c.prix_unitaire_ht)} / ${c.unite ?? ""}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {data.totaux.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("site.totalsTitle")}
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 text-left font-semibold">{t("site.cols.subcontractor")}</th>
                  <th className="py-2 text-right font-semibold">{t("site.cols.entries")}</th>
                  <th className="py-2 text-right font-semibold">{t("site.cols.hours")}</th>
                  <th className="py-2 text-right font-semibold">{t("site.cols.lumpSum")}</th>
                  <th className="py-2 text-right font-semibold">{t("site.cols.hourlyValue")}</th>
                  <th className="py-2 text-right font-semibold">{t("site.cols.paidExclVat")}</th>
                  <th className="py-2 text-right font-semibold">{t("site.cols.withheld")}</th>
                  <th className="py-2 text-right font-semibold">{t("site.cols.paid")}</th>
                  <th className="py-2 text-right font-semibold">{t("site.cols.remaining")}</th>
                </tr>
              </thead>
              <tbody>
                {data.totaux.map((l) => (
                  <tr key={l.sousTraitantId} className="border-t border-border">
                    <td className="py-2">{l.sousTraitant || "—"}</td>
                    <td className="py-2 text-right">
                      {l.prestations}
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        ({t("site.validatedCount", { count: l.prestationsValidees })})
                      </span>
                    </td>
                    <td className="py-2 text-right">{l.heures}</td>
                    <td className="py-2 text-right">{eur(l.forfait)}</td>
                    <td className="py-2 text-right">{eur(l.valeurHoraire)}</td>
                    <td className="py-2 text-right">{eur(l.payeHt)}</td>
                    <td className="py-2 text-right">{eur(l.retenues)}</td>
                    <td className="py-2 text-right">{eur(l.verse)}</td>
                    <td className="py-2 text-right">{eur(l.resteForfait)}</td>
                  </tr>
                ))}
              </tbody>
              {data.totaux.length > 1 && (
                <tfoot className="font-semibold">
                  <tr className="border-t-2 border-border">
                    <td className="py-2">{t("site.total")}</td>
                    <td className="py-2 text-right">{tc.prestations}</td>
                    <td className="py-2 text-right">{tc.heures}</td>
                    <td />
                    <td />
                    <td className="py-2 text-right">{eur(tc.payeHt)}</td>
                    <td className="py-2 text-right">{eur(tc.retenues)}</td>
                    <td className="py-2 text-right">{eur(tc.verse)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{t("site.hourlyHint")}</p>
        </div>
      )}

      {data.journal.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("site.journalTitle")}
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 text-left font-semibold">{t("site.cols.date")}</th>
                  <th className="py-2 text-left font-semibold">{t("site.cols.subcontractor")}</th>
                  <th className="py-2 text-left font-semibold">{t("site.cols.description")}</th>
                  <th className="py-2 text-right font-semibold">{t("site.cols.hours")}</th>
                  <th className="py-2 text-right font-semibold">{t("prestations.workers")}</th>
                  <th className="py-2 text-right font-semibold">{t("site.validated")}</th>
                </tr>
              </thead>
              <tbody>
                {data.journal.map((l, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="py-2">{formatDateBE(l.date)}</td>
                    <td className="py-2">{l.sousTraitant || "—"}</td>
                    <td className="max-w-[260px] truncate py-2 text-muted-foreground">
                      {l.description || "—"}
                    </td>
                    <td className="py-2 text-right">{l.heures ?? "—"}</td>
                    <td className="py-2 text-right">{l.ouvriers.length}</td>
                    <td className="py-2 text-right">
                      {l.valideLe ? (
                        <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {nouvelle && (
        <PrestationFormModal
          contrats={data.contrats}
          noms={data.noms}
          onClose={() => setNouvelle(false)}
          onSaved={() => {
            setNouvelle(false);
            void queryClient.invalidateQueries({ queryKey: cle });
            void queryClient.invalidateQueries({ queryKey: ["sous_traitant"] });
          }}
        />
      )}
    </div>
  );
}

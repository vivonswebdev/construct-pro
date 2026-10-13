import { useState } from "react";
import { Ban, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatEURBE } from "@/lib/belgian";
import { formatDateBE } from "@/lib/format";
import { codeErreurPaiement } from "@/lib/paiements";
import { errorMessage } from "@/lib/utils";
import {
  aujourdhuiBruxelles,
  dateBruxelles,
  type ContratSousTraitance,
  type PaiementSousTraitance,
  type SousTraitant,
  type Verification30bis,
} from "@/lib/sous-traitants";
import { PaiementFormModal } from "./PaiementFormModal";
import { useTranslation } from "react-i18next";

/**
 * Paiements d'un sous-traitant. Suppression possible le jour même uniquement ; ensuite,
 * annulation avec motif (la ligne reste, barrée, comme piste d'audit).
 */
export function PaiementsSection({
  sousTraitant,
  contrats,
  verifications,
  paiements,
  onChange,
}: {
  sousTraitant: SousTraitant;
  contrats: ContratSousTraitance[];
  verifications: Verification30bis[];
  paiements: PaiementSousTraitance[];
  onChange: () => void;
}) {
  const { t } = useTranslation(["sousTraitants", "common"]);
  const [nouveau, setNouveau] = useState(false);
  const contratLabel = new Map(contrats.map((c) => [c.id, c.descriptif_prestations] as const));
  const aujourdhui = aujourdhuiBruxelles();

  const erreur = (error: unknown) => {
    const code = codeErreurPaiement(error);
    toast.error(code ? t(`payments.errors.${code}`) : errorMessage(error));
  };

  const supprimer = async (p: PaiementSousTraitance) => {
    if (!confirm(t("payments.confirmDelete"))) return;
    const { error } = await supabase.from("achat_paiements").delete().eq("id", p.id);
    if (error) return erreur(error);
    toast.success(t("toasts.paymentDeleted"));
    onChange();
  };

  const annuler = async (p: PaiementSousTraitance) => {
    const motif = prompt(t("payments.cancelReason"))?.trim();
    if (!motif) return;
    const { error } = await supabase
      .from("achat_paiements")
      .update({ annule_le: new Date().toISOString(), motif_annulation: motif })
      .eq("id", p.id);
    if (error) return erreur(error);
    toast.success(t("toasts.paymentCancelled"));
    onChange();
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("detail.payments")}
        </h3>
        <button
          onClick={() => setNouveau(true)}
          disabled={contrats.length === 0}
          title={contrats.length === 0 ? t("payments.needContract") : undefined}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> {t("payments.new")}
        </button>
      </div>
      {paiements.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">{t("detail.noPayments")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-2 text-left font-semibold">{t("payments.date")}</th>
                <th className="px-5 py-2 text-left font-semibold">{t("payments.contract")}</th>
                <th className="px-5 py-2 text-right font-semibold">{t("payments.net")}</th>
                <th className="px-5 py-2 text-right font-semibold">{t("payments.withheld")}</th>
                <th className="px-5 py-2 text-right font-semibold">{t("payments.paid")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {paiements.map((p) => {
                const annule = !!p.annule_le;
                const retenu = Number(p.retenue_onss) + Number(p.retenue_spf);
                const jourMeme = dateBruxelles(p.created_at) === aujourdhui;
                return (
                  <tr
                    key={p.id}
                    className={`border-t border-border ${annule ? "text-muted-foreground" : ""}`}
                  >
                    <td className="px-5 py-2">
                      <span className={annule ? "line-through" : ""}>
                        {formatDateBE(p.date_paiement)}
                      </span>
                      {annule && (
                        <span className="block text-[11px]">
                          {t("payments.cancelledOn", {
                            date: formatDateBE(p.annule_le),
                            reason: p.motif_annulation,
                          })}
                        </span>
                      )}
                    </td>
                    <td className="max-w-[220px] truncate px-5 py-2 text-muted-foreground">
                      {contratLabel.get(p.contrat_id) ?? "—"}
                    </td>
                    <td className={`px-5 py-2 text-right ${annule ? "line-through" : ""}`}>
                      {formatEURBE(p.montant_ht)}
                    </td>
                    <td
                      className={`px-5 py-2 text-right ${annule ? "line-through" : retenu > 0 ? "text-red-600" : ""}`}
                    >
                      {formatEURBE(retenu)}
                    </td>
                    <td
                      className={`px-5 py-2 text-right font-semibold ${annule ? "line-through" : ""}`}
                    >
                      {formatEURBE(p.montant_verse)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!annule &&
                        (jourMeme ? (
                          <button
                            onClick={() => supprimer(p)}
                            title={t("payments.delete")}
                            aria-label={t("payments.delete")}
                            className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => annuler(p)}
                            title={t("payments.cancel")}
                            aria-label={t("payments.cancel")}
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </button>
                        ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="border-t border-border px-5 py-2 text-xs text-muted-foreground">
        {t("payments.auditHint")}
      </p>
      {nouveau && (
        <PaiementFormModal
          sousTraitant={sousTraitant}
          contrats={contrats}
          verifications={verifications}
          paiements={paiements}
          onClose={() => setNouveau(false)}
          onSaved={() => {
            setNouveau(false);
            onChange();
          }}
        />
      )}
    </div>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { backdropClose } from "@/lib/modal";
import { codeErreurPaiement } from "@/lib/paiements";
import {
  FREQUENCES_PAIEMENT,
  TYPES_PRIX,
  UNITES,
  type ContratSousTraitance,
} from "@/lib/sous-traitants";
import { useTranslation } from "react-i18next";

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

/**
 * Nouveau contrat (mission) avec un sous-traitant, ou modification tant qu'aucune demande de
 * signature n'est signée (contrôlé aussi en base : contrat_signe_non_modifiable).
 */
export function ContratFormModal({
  sousTraitantId,
  contrat,
  onClose,
  onSaved,
}: {
  sousTraitantId: string;
  contrat?: ContratSousTraitance;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation(["contrats", "common", "statuts", "sousTraitants"]);
  const { profile } = useAuth();
  const { data: chantiers } = useQuery({
    queryKey: ["chantiers-select"],
    queryFn: async () =>
      (await supabase.from("chantiers").select("id, name").order("name")).data ?? [],
  });
  const c = contrat;
  const [f, setF] = useState({
    chantier_id: c?.chantier_id ?? "",
    descriptif_prestations: c?.descriptif_prestations ?? "",
    type_prix: (c?.type_prix ?? "forfait") as (typeof TYPES_PRIX)[number],
    montant_forfait_ht: c?.montant_forfait_ht != null ? String(c.montant_forfait_ht) : "",
    prix_unitaire_ht: c?.prix_unitaire_ht != null ? String(c.prix_unitaire_ht) : "",
    unite: (c?.unite ?? "heure") as (typeof UNITES)[number],
    frequence_paiement: (c?.frequence_paiement ??
      "a_la_facture") as (typeof FREQUENCES_PAIEMENT)[number],
    delai_paiement_jours: String(c?.delai_paiement_jours ?? 30),
    date_debut: c?.date_debut ?? "",
    date_fin: c?.date_fin ?? "",
    bon_commande_ref: c?.bon_commande_ref ?? "",
    devis_ref: c?.devis_ref ?? "",
  });
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  const forfait = f.type_prix === "forfait";

  const montant = z.coerce.number().min(0, t("form.validation.amount"));
  const schema = z
    .object({
      descriptif_prestations: z.string().trim().min(1, t("form.validation.description")),
      montant_forfait_ht: forfait ? montant : z.any(),
      prix_unitaire_ht: forfait ? z.any() : montant,
      delai_paiement_jours: z.coerce.number().int().min(0).max(365, t("form.validation.delay")),
      date_debut: z.string(),
      date_fin: z.string(),
    })
    .refine((v) => !v.date_debut || !v.date_fin || v.date_fin >= v.date_debut, {
      message: t("form.validation.dates"),
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.company_id) return;
    if (forfait ? !f.montant_forfait_ht : !f.prix_unitaire_ht)
      return toast.error(t("form.validation.amount"));
    const parsed = schema.safeParse(f);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSaving(true);
    const payload: TablesInsert<"sous_traitant_contrats"> = {
      company_id: profile.company_id,
      sous_traitant_id: sousTraitantId,
      chantier_id: f.chantier_id || null,
      descriptif_prestations: f.descriptif_prestations.trim(),
      type_prix: f.type_prix,
      montant_forfait_ht: forfait ? Number(f.montant_forfait_ht) : null,
      prix_unitaire_ht: forfait ? null : Number(f.prix_unitaire_ht),
      unite: forfait ? null : f.unite,
      frequence_paiement: f.frequence_paiement,
      delai_paiement_jours: Number(f.delai_paiement_jours),
      date_debut: f.date_debut || null,
      date_fin: f.date_fin || null,
      bon_commande_ref: f.bon_commande_ref.trim() || null,
      devis_ref: f.devis_ref.trim() || null,
    };
    const { error } = c
      ? await supabase.from("sous_traitant_contrats").update(payload).eq("id", c.id)
      : await supabase
          .from("sous_traitant_contrats")
          .insert({ ...payload, created_by: profile.id });
    setSaving(false);
    if (error) {
      const code = codeErreurPaiement(error);
      return toast.error(code ? t(`sousTraitants:payments.errors.${code}`) : error.message);
    }
    toast.success(c ? t("toasts.contractUpdated") : t("toasts.contractCreated"));
    onSaved();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      {...backdropClose(onClose)}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{c ? t("form.editTitle") : t("form.title")}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <L label={t("form.site")} full>
            <select
              className={inputCls}
              value={f.chantier_id}
              onChange={(e) => set({ chantier_id: e.target.value })}
            >
              <option value="">{t("form.noSite")}</option>
              {(chantiers ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </L>
          <L label={t("form.description")} full>
            <textarea
              rows={2}
              className={inputCls}
              value={f.descriptif_prestations}
              onChange={(e) => set({ descriptif_prestations: e.target.value })}
            />
          </L>
          <L label={t("form.priceType")}>
            <select
              className={inputCls}
              value={f.type_prix}
              onChange={(e) => set({ type_prix: e.target.value as typeof f.type_prix })}
            >
              {TYPES_PRIX.map((tp) => (
                <option key={tp} value={tp}>
                  {t(`statuts:typePrix.${tp}`)}
                </option>
              ))}
            </select>
          </L>
          {forfait ? (
            <L label={t("form.lumpSum")}>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputCls}
                value={f.montant_forfait_ht}
                onChange={(e) => set({ montant_forfait_ht: e.target.value })}
              />
            </L>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <L label={t("form.unitPrice")}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputCls}
                  value={f.prix_unitaire_ht}
                  onChange={(e) => set({ prix_unitaire_ht: e.target.value })}
                />
              </L>
              <L label={t("form.unit")}>
                <select
                  className={inputCls}
                  value={f.unite}
                  onChange={(e) => set({ unite: e.target.value as typeof f.unite })}
                >
                  {UNITES.map((u) => (
                    <option key={u} value={u}>
                      {t(`statuts:unite.${u}`)}
                    </option>
                  ))}
                </select>
              </L>
            </div>
          )}
          <L label={t("form.frequency")}>
            <select
              className={inputCls}
              value={f.frequence_paiement}
              onChange={(e) =>
                set({ frequence_paiement: e.target.value as typeof f.frequence_paiement })
              }
            >
              {FREQUENCES_PAIEMENT.map((fq) => (
                <option key={fq} value={fq}>
                  {t(`statuts:frequencePaiement.${fq}`)}
                </option>
              ))}
            </select>
          </L>
          <L label={t("form.paymentDelay")}>
            <input
              type="number"
              min="0"
              max="365"
              className={inputCls}
              value={f.delai_paiement_jours}
              onChange={(e) => set({ delai_paiement_jours: e.target.value })}
            />
          </L>
          <L label={t("form.start")}>
            <input
              type="date"
              className={inputCls}
              value={f.date_debut}
              onChange={(e) => set({ date_debut: e.target.value })}
            />
          </L>
          <L label={t("form.end")}>
            <input
              type="date"
              className={inputCls}
              value={f.date_fin}
              onChange={(e) => set({ date_fin: e.target.value })}
            />
          </L>
          <L label={t("form.orderRef")}>
            <input
              className={inputCls}
              value={f.bon_commande_ref}
              onChange={(e) => set({ bon_commande_ref: e.target.value })}
            />
          </L>
          <L label={t("form.quoteRef")}>
            <input
              className={inputCls}
              value={f.devis_ref}
              onChange={(e) => set({ devis_ref: e.target.value })}
            />
          </L>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            {t("common:actions.cancel")}
          </button>
          <button
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "…" : t("common:actions.save")}
          </button>
        </div>
      </form>
    </div>
  );
}

function L({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? "col-span-2" : ""}`}>
      <span className="mb-1 block text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}

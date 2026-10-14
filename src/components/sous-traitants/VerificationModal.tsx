import { useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { backdropClose } from "@/lib/modal";
import {
  urlVerification30bis,
  type SousTraitant,
  type Verification30bis,
} from "@/lib/sous-traitants";
import { useTranslation } from "react-i18next";

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

/**
 * Enregistrement manuel, daté et immuable, du résultat consulté sur le service officiel,
 * avec les montants de dette ONSS et SPF affichés (plafonds des retenues).
 */
export function VerificationModal({
  sousTraitant,
  onClose,
  onSaved,
}: {
  sousTraitant: SousTraitant;
  onClose: () => void;
  onSaved: (v: Verification30bis) => void;
}) {
  const { t } = useTranslation(["sousTraitants", "common"]);
  const { profile } = useAuth();
  const [detteSociale, setDetteSociale] = useState(false);
  const [detteFiscale, setDetteFiscale] = useState(false);
  const [montantOnss, setMontantOnss] = useState("");
  const [montantSpf, setMontantSpf] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const montant = z.coerce
    .number({ message: t("verification.validation.debtAmount") })
    .min(0, t("verification.validation.debtAmount"));
  const lire = (v: string) => v.replace(/\s/g, "").replace(",", ".");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.company_id) return;
    const parsed = z
      .object({
        onss: detteSociale ? montant : z.any(),
        spf: detteFiscale ? montant : z.any(),
      })
      .safeParse({ onss: lire(montantOnss) || undefined, spf: lire(montantSpf) || undefined });
    if (!parsed.success) return toast.error(t("verification.validation.debtAmount"));
    if (!confirm(t("verification.confirm"))) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("verifications_30bis")
      .insert({
        company_id: profile.company_id,
        sous_traitant_id: sousTraitant.id,
        dette_sociale: detteSociale,
        dette_fiscale: detteFiscale,
        montant_dette_onss: detteSociale ? Number(lire(montantOnss)) : null,
        montant_dette_spf: detteFiscale ? Number(lire(montantSpf)) : null,
        source_url: urlVerification30bis(sousTraitant),
        notes: notes.trim() || null,
        verifie_par: profile.id,
      })
      .select()
      .single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(t("toasts.verificationSaved"));
    onSaved(data);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      {...backdropClose(onClose)}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-4 rounded-2xl bg-card p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t("verification.record")}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("verification.modalHint", { name: sousTraitant.raison_sociale })}
        </p>
        <a
          href={urlVerification30bis(sousTraitant)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <ExternalLink className="h-4 w-4" /> {t("verification.openOfficial")}
        </a>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={detteSociale}
              onChange={(e) => setDetteSociale(e.target.checked)}
            />
            {t("verification.socialDebtFound")}
          </label>
          {detteSociale && (
            <label className="block pl-6">
              <span className="mb-1 block text-xs font-medium">
                {t("verification.socialDebtAmount")}
              </span>
              <input
                inputMode="decimal"
                className={inputCls}
                value={montantOnss}
                onChange={(e) => setMontantOnss(e.target.value)}
              />
            </label>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={detteFiscale}
              onChange={(e) => setDetteFiscale(e.target.checked)}
            />
            {t("verification.taxDebtFound")}
          </label>
          {detteFiscale && (
            <label className="block pl-6">
              <span className="mb-1 block text-xs font-medium">
                {t("verification.taxDebtAmount")}
              </span>
              <input
                inputMode="decimal"
                className={inputCls}
                value={montantSpf}
                onChange={(e) => setMontantSpf(e.target.value)}
              />
            </label>
          )}
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium">{t("verification.notes")}</span>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputCls}
          />
        </label>
        <p className="text-xs text-muted-foreground">{t("verification.proofLater")}</p>
        <div className="flex justify-end gap-2">
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

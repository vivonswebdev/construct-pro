import { useState } from "react";
import { ExternalLink, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { backdropClose } from "@/lib/modal";
import {
  ACCEPT_CAPTURE,
  controlerFichier,
  deposerCapture30bis,
  supprimerOrphelin,
} from "@/lib/stockage";
import { errorMessage } from "@/lib/utils";
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
  const [capture, setCapture] = useState<File | null>(null);
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
    // La vérification est immuable : la capture est déposée AVANT l'enregistrement ; si
    // l'enregistrement échoue, le fichier (encore orphelin) est supprimé.
    let chemin: string | null = null;
    if (capture) {
      try {
        chemin = await deposerCapture30bis(profile.company_id, capture);
      } catch (err) {
        setSaving(false);
        return toast.error(t("verification.capture.uploadFailed", { error: errorMessage(err) }));
      }
    }
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
        preuve_fichier: chemin,
        verifie_par: profile.id,
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      if (chemin) await supprimerOrphelin(chemin);
      return toast.error(error.message);
    }
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
        <div>
          <span className="mb-1 block text-xs font-medium">{t("verification.capture.label")}</span>
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm hover:bg-muted">
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">
              {capture ? capture.name : t("verification.capture.choose")}
            </span>
            <input
              type="file"
              accept={ACCEPT_CAPTURE}
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                e.target.value = "";
                if (!f) return;
                const err = controlerFichier(f);
                if (err) return toast.error(t(`verification.capture.errors.${err}`));
                setCapture(f);
              }}
            />
          </label>
          <p className="mt-1 text-[11px] text-muted-foreground">{t("verification.capture.hint")}</p>
        </div>
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

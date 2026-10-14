import { useMemo, useState } from "react";
import { AlertTriangle, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useParametres30bis } from "@/hooks/useParametres30bis";
import { useAuth } from "@/lib/auth";
import { formatEURBE } from "@/lib/belgian";
import { backdropClose } from "@/lib/modal";
import { calculerRetenuesPlafonnees, produitArrondiCent } from "@/lib/retenue-30bis";
import {
  MODES_PAIEMENT,
  aujourdhuiBruxelles,
  dateBruxelles,
  type ContratSousTraitance,
  type PaiementSousTraitance,
  type SousTraitant,
  type Verification30bis,
} from "@/lib/sous-traitants";
import { codeErreurPaiement } from "@/lib/paiements";
import { VerificationModal } from "./VerificationModal";
import { useTranslation } from "react-i18next";

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";
const lire = (v: string) => Number(v.replace(/\s/g, "").replace(",", ".")) || 0;

/**
 * Nouveau paiement d'un sous-traitant : exige une vérification 30bis du jour du paiement,
 * calcule les retenues (taux en vigueur, plafonnées aux dettes restantes). Le trigger
 * check_paiement_30bis refait le même contrôle en base.
 */
export function PaiementFormModal({
  sousTraitant,
  contrats,
  verifications,
  paiements,
  onClose,
  onSaved,
}: {
  sousTraitant: SousTraitant;
  contrats: ContratSousTraitance[];
  verifications: Verification30bis[];
  paiements: PaiementSousTraitance[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation(["sousTraitants", "common", "statuts"]);
  const { profile } = useAuth();
  const [f, setF] = useState({
    contrat_id: contrats[0]?.id ?? "",
    date_paiement: aujourdhuiBruxelles(),
    montant_ht: "",
    montant_tva: "0",
    mode: "virement" as (typeof MODES_PAIEMENT)[number],
    reference: "",
  });
  const [verifs, setVerifs] = useState(verifications);
  const [verifOuverte, setVerifOuverte] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  const { taux } = useParametres30bis(f.date_paiement);

  // Vérification la plus récente du jour du paiement (heure de Bruxelles).
  const verif = useMemo(
    () =>
      [...verifs]
        .filter((v) => dateBruxelles(v.verifie_le) === f.date_paiement)
        .sort((a, b) => b.verifie_le.localeCompare(a.verifie_le))[0] ?? null,
    [verifs, f.date_paiement],
  );
  const ht = lire(f.montant_ht);
  const tva = lire(f.montant_tva);
  const deja = useMemo(() => {
    const lies = paiements.filter((p) => p.verification_30bis_id === verif?.id && !p.annule_le);
    return {
      onss: lies.reduce((s, p) => s + Number(p.retenue_onss), 0),
      spf: lies.reduce((s, p) => s + Number(p.retenue_spf), 0),
    };
  }, [paiements, verif]);
  const calc =
    verif && taux && ht > 0
      ? calculerRetenuesPlafonnees({ montantHt: ht, verification: verif, dejaRetenu: deja, taux })
      : null;
  const aVerser = calc ? produitArrondiCent(ht + tva - calc.total, 1) : 0;
  const estAujourdhui = f.date_paiement === aujourdhuiBruxelles();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.company_id) return;
    const parsed = z
      .object({
        contrat_id: z.string().min(1, t("payments.validation.contract")),
        date_paiement: z
          .string()
          .refine((d) => d <= aujourdhuiBruxelles(), t("payments.validation.futureDate")),
        ht: z.number().positive(t("payments.validation.amount")),
        tva: z.number().min(0, t("payments.validation.vat")),
      })
      .safeParse({ ...f, ht, tva });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (!verif) return toast.error(t("payments.errors.verification_30bis_pas_du_jour"));
    if (!taux || !calc) return toast.error(t("payments.errors.parametres_30bis_absents"));
    setSaving(true);
    const { error } = await supabase.from("achat_paiements").insert({
      company_id: profile.company_id,
      contrat_id: f.contrat_id,
      date_paiement: f.date_paiement,
      montant_ht: ht,
      montant_tva: tva,
      retenue_onss: calc.onss,
      retenue_spf: calc.spf,
      mode: f.mode,
      reference: f.reference.trim() || null,
      verification_30bis_id: verif.id,
      created_by: profile.id,
    });
    setSaving(false);
    if (error) {
      const code = codeErreurPaiement(error);
      return toast.error(code ? t(`payments.errors.${code}`) : error.message);
    }
    toast.success(t("toasts.paymentSaved"));
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
        className="max-h-[92vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl bg-card p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t("payments.new")}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {sousTraitant.statut === "bloque" && (
          <p className="flex gap-2 rounded-md bg-red-50 p-3 text-sm text-red-800">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {t("payments.blockedWarning")}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 block">
            <span className="mb-1 block text-xs font-medium">{t("payments.contract")}</span>
            <select
              className={inputCls}
              value={f.contrat_id}
              onChange={(e) => set({ contrat_id: e.target.value })}
            >
              {contrats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.descriptif_prestations}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium">{t("payments.date")}</span>
            <input
              type="date"
              max={aujourdhuiBruxelles()}
              className={inputCls}
              value={f.date_paiement}
              onChange={(e) => set({ date_paiement: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium">{t("payments.mode")}</span>
            <select
              className={inputCls}
              value={f.mode}
              onChange={(e) => set({ mode: e.target.value as typeof f.mode })}
            >
              {MODES_PAIEMENT.map((m) => (
                <option key={m} value={m}>
                  {t(`statuts:modePaiement.${m}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium">{t("payments.amountExclVat")}</span>
            <input
              inputMode="decimal"
              className={inputCls}
              value={f.montant_ht}
              onChange={(e) => set({ montant_ht: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium">{t("payments.vat")}</span>
            <input
              inputMode="decimal"
              className={inputCls}
              value={f.montant_tva}
              onChange={(e) => set({ montant_tva: e.target.value })}
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              {t("payments.vatHint")}
            </span>
          </label>
          <label className="col-span-2 block">
            <span className="mb-1 block text-xs font-medium">{t("payments.reference")}</span>
            <input
              className={inputCls}
              value={f.reference}
              onChange={(e) => set({ reference: e.target.value })}
            />
          </label>
        </div>

        {/* Vérification 30bis du jour */}
        {verif ? (
          <p className="flex items-center gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            {verif.dette_sociale || verif.dette_fiscale
              ? t("payments.verifDebt")
              : t("payments.verifOk")}
          </p>
        ) : (
          <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            <p>{estAujourdhui ? t("payments.verifMissing") : t("payments.verifMissingPast")}</p>
            {estAujourdhui && (
              <button
                type="button"
                onClick={() => setVerifOuverte(true)}
                className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary/90"
              >
                <ShieldCheck className="h-4 w-4" /> {t("payments.verifyNow")}
              </button>
            )}
          </div>
        )}

        {/* Calcul */}
        {calc && (
          <div className="space-y-1 rounded-lg border border-border p-4 text-sm">
            <Ligne label={t("payments.amountExclVat")} valeur={formatEURBE(ht)} />
            <Ligne label={t("payments.vat")} valeur={formatEURBE(tva)} />
            <Ligne
              label={t("payments.withheldOnss")}
              valeur={`− ${formatEURBE(calc.onss)}`}
              note={
                calc.plafondOnss
                  ? t("payments.capped", { amount: formatEURBE(calc.resteOnss) })
                  : undefined
              }
              rouge={calc.onss > 0}
            />
            <Ligne
              label={t("payments.withheldSpf")}
              valeur={`− ${formatEURBE(calc.spf)}`}
              note={
                calc.plafondSpf
                  ? t("payments.capped", { amount: formatEURBE(calc.resteSpf) })
                  : undefined
              }
              rouge={calc.spf > 0}
            />
            <div className="border-t border-border pt-1">
              <Ligne label={t("payments.toSubcontractor")} valeur={formatEURBE(aVerser)} gras />
            </div>
            {calc.onss > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("payments.toOnss", { amount: formatEURBE(calc.onss) })}
              </p>
            )}
            {calc.spf > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("payments.toSpf", { amount: formatEURBE(calc.spf) })}
              </p>
            )}
            <p className="pt-1 text-[11px] text-muted-foreground">{t("common:indicatif")}</p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            {t("common:actions.cancel")}
          </button>
          <button
            disabled={saving || !calc}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "…" : t("payments.save")}
          </button>
        </div>
      </form>
      {/* Hors du <form> : pas de formulaires imbriqués. */}
      {verifOuverte && (
        <VerificationModal
          sousTraitant={sousTraitant}
          onClose={() => setVerifOuverte(false)}
          onSaved={(v) => {
            setVerifs((prev) => [v, ...prev]);
            setVerifOuverte(false);
          }}
        />
      )}
    </div>
  );
}

function Ligne({
  label,
  valeur,
  note,
  rouge,
  gras,
}: {
  label: string;
  valeur: string;
  note?: string;
  rouge?: boolean;
  gras?: boolean;
}) {
  return (
    <div>
      <p className={`flex justify-between ${gras ? "font-semibold" : ""}`}>
        <span className="text-muted-foreground">{label}</span>
        <span className={rouge ? "text-red-600" : ""}>{valeur}</span>
      </p>
      {note && <p className="text-right text-[11px] text-amber-700">{note}</p>}
    </div>
  );
}

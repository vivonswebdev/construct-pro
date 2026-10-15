import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Info, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { useConformite } from "@/hooks/useConformite";
import { useAuth } from "@/lib/auth";
import type { StatutConformite } from "@/lib/conformite";
import { formatDateBE } from "@/lib/format";
import { backdropClose } from "@/lib/modal";
import { codeErreurPaiement } from "@/lib/paiements";
import { aujourdhuiBruxelles, type ContratSousTraitance } from "@/lib/sous-traitants";
import { errorMessage } from "@/lib/utils";
import { useTranslation } from "react-i18next";

type Prestation = Tables<"sous_traitant_prestations">;
type Ouvrier = { nom: string; fonction: string; heures: string };

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

const ouvriersDe = (j: Json): { nom: string; fonction?: string; heures?: number }[] =>
  Array.isArray(j) ? (j as { nom: string; fonction?: string; heures?: number }[]) : [];

/** Journal des prestations (preuves de la réalité des travaux) ; validation par admin / gérant. */
export function PrestationsSection({
  contrats,
  prestations,
  onChange,
}: {
  contrats: ContratSousTraitance[];
  prestations: Prestation[];
  onChange: () => void;
}) {
  const { t } = useTranslation(["sousTraitants", "common"]);
  const { profile } = useAuth();
  const [nouvelle, setNouvelle] = useState(false);
  const gestionnaire = profile?.role === "admin" || profile?.role === "gerant";
  const contratLabel = new Map(contrats.map((c) => [c.id, c.descriptif_prestations] as const));

  const erreur = (error: unknown) => {
    const code = codeErreurPaiement(error);
    toast.error(code ? t(`payments.errors.${code}`) : errorMessage(error));
  };

  const valider = async (p: Prestation) => {
    if (!profile) return;
    const { error } = await supabase
      .from("sous_traitant_prestations")
      .update({ valide_par: profile.id, valide_le: new Date().toISOString() })
      .eq("id", p.id);
    if (error) return erreur(error);
    toast.success(t("toasts.prestationValidated"));
    onChange();
  };

  const supprimer = async (p: Prestation) => {
    if (!confirm(t("prestations.confirmDelete"))) return;
    const { error } = await supabase.from("sous_traitant_prestations").delete().eq("id", p.id);
    if (error) return erreur(error);
    onChange();
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("prestations.title")}
        </h3>
        <button
          onClick={() => setNouvelle(true)}
          disabled={contrats.length === 0}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> {t("prestations.new")}
        </button>
      </div>
      {prestations.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">{t("prestations.empty")}</p>
      ) : (
        prestations.map((p) => {
          const ouvriers = ouvriersDe(p.ouvriers);
          return (
            <div key={p.id} className="border-t border-border px-5 py-3 text-sm first:border-t-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {formatDateBE(p.date_prestation)}
                    {p.heures != null &&
                      ` · ${t("prestations.hours", { count: Number(p.heures) })}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[contratLabel.get(p.contrat_id), p.description].filter(Boolean).join(" — ")}
                  </p>
                  {ouvriers.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {ouvriers
                        .map((o) =>
                          [o.nom, o.fonction, o.heures != null && `${o.heures} h`]
                            .filter(Boolean)
                            .join(", "),
                        )
                        .join(" · ")}
                    </p>
                  )}
                  {p.presence_enregistree && (
                    <span className="mt-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      {t("prestations.checkinRecorded")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {p.valide_le ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t("prestations.validatedOn", { date: formatDateBE(p.valide_le) })}
                    </span>
                  ) : (
                    <>
                      {gestionnaire && (
                        <button
                          onClick={() => valider(p)}
                          className="rounded-lg border border-emerald-300 px-2 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                        >
                          {t("prestations.validate")}
                        </button>
                      )}
                      <button
                        onClick={() => supprimer(p)}
                        aria-label={t("common:actions.delete")}
                        className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
      {nouvelle && (
        <PrestationFormModal
          contrats={contrats}
          onClose={() => setNouvelle(false)}
          onSaved={() => {
            setNouvelle(false);
            onChange();
          }}
        />
      )}
    </div>
  );
}

/**
 * Saisie d'une prestation. `noms` (sous-traitant par id) : utilisé depuis la fiche chantier, où les
 * contrats de plusieurs sous-traitants sont proposés. Le blocage de conformité (attestation 30bis)
 * est affiché avant l'enregistrement ; la base le contrôle de toute façon.
 */
export function PrestationFormModal({
  contrats,
  noms,
  onClose,
  onSaved,
}: {
  contrats: ContratSousTraitance[];
  noms?: Map<string, string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation(["sousTraitants", "common"]);
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { data: conformite } = useConformite();
  const [f, setF] = useState({
    contrat_id: contrats[0]?.id ?? "",
    date_prestation: aujourdhuiBruxelles(),
    description: "",
    heures: "",
    presence_enregistree: false,
  });
  const [ouvriers, setOuvriers] = useState<Ouvrier[]>([]);
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  const nombre = (v: string) => (v.trim() ? Number(v.replace(",", ".")) : null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.company_id) return;
    const msgHeures = t("prestations.validation.hours");
    const heures = z.number().min(0, msgHeures).max(744, msgHeures).nullable();
    const parsed = z
      .object({
        contrat_id: z.string().min(1),
        date_prestation: z.string().min(1),
        heures,
        ouvriers: z.array(
          z.object({
            nom: z.string().trim().min(1, t("prestations.validation.workerName")),
            heures,
          }),
        ),
      })
      .safeParse({
        ...f,
        heures: nombre(f.heures),
        ouvriers: ouvriers.map((o) => ({ nom: o.nom, heures: nombre(o.heures) })),
      });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSaving(true);
    const { error } = await supabase.from("sous_traitant_prestations").insert({
      company_id: profile.company_id,
      contrat_id: f.contrat_id,
      chantier_id: contrat?.chantier_id ?? null,
      date_prestation: f.date_prestation,
      description: f.description.trim() || null,
      heures: nombre(f.heures),
      ouvriers: ouvriers.map((o) => ({
        nom: o.nom.trim(),
        fonction: o.fonction.trim() || null,
        heures: nombre(o.heures),
      })),
      presence_enregistree: f.presence_enregistree,
      created_by: profile.id,
    });
    setSaving(false);
    if (error) {
      const code = codeErreurPaiement(error);
      void queryClient.invalidateQueries({ queryKey: ["conformite"] });
      return toast.error(code ? t(`payments.errors.${code}`) : errorMessage(error));
    }
    toast.success(t("toasts.prestationSaved"));
    onSaved();
  };

  const contrat = contrats.find((c) => c.id === f.contrat_id);
  const ligne = contrat ? conformite?.get(contrat.sous_traitant_id) : undefined;
  // Le blocage ne vise que les prestations rattachées à un chantier.
  const bloque = !!contrat?.chantier_id && !!ligne?.bloque;
  const derogation = !!contrat?.chantier_id && !ligne?.bloque && ligne?.derogation_jusqua;

  const majOuvrier = (i: number, p: Partial<Ouvrier>) =>
    setOuvriers(ouvriers.map((o, k) => (k === i ? { ...o, ...p } : o)));

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      {...backdropClose(onClose)}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-xl space-y-3 overflow-y-auto rounded-2xl bg-card p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t("prestations.new")}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium">{t("payments.contract")}</span>
          <select
            className={inputCls}
            value={f.contrat_id}
            onChange={(e) => set({ contrat_id: e.target.value })}
          >
            {contrats.map((c) => (
              <option key={c.id} value={c.id}>
                {[noms?.get(c.sous_traitant_id), c.descriptif_prestations]
                  .filter(Boolean)
                  .join(" — ")}
              </option>
            ))}
          </select>
        </label>
        {bloque && contrat && ligne && (
          <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">{t("compliance.blocked")}</p>
              <p className="text-xs">
                {t("compliance.blockedDetail", {
                  status: t(`compliance.status.${ligne.attestation_30bis as StatutConformite}`),
                })}
              </p>
              <Link
                to="/sous-traitants/$id"
                params={{ id: contrat.sous_traitant_id }}
                className="mt-1 inline-block text-xs font-semibold underline"
              >
                {t("prestations.openCompliance")}
              </Link>
            </div>
          </div>
        )}
        {derogation && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            {t("compliance.derogationActive", { date: formatDateBE(derogation) })}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium">{t("payments.date")}</span>
            <input
              type="date"
              className={inputCls}
              value={f.date_prestation}
              onChange={(e) => set({ date_prestation: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium">{t("prestations.totalHours")}</span>
            <input
              inputMode="decimal"
              className={inputCls}
              value={f.heures}
              onChange={(e) => set({ heures: e.target.value })}
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium">{t("prestations.description")}</span>
          <textarea
            rows={2}
            className={inputCls}
            value={f.description}
            onChange={(e) => set({ description: e.target.value })}
          />
        </label>
        <div>
          <span className="mb-1 block text-xs font-medium">{t("prestations.workers")}</span>
          {ouvriers.map((o, i) => (
            <div key={i} className="mb-2 grid grid-cols-[1fr_1fr_80px_32px] gap-2">
              <input
                className={inputCls}
                placeholder={t("prestations.workerName")}
                value={o.nom}
                onChange={(e) => majOuvrier(i, { nom: e.target.value })}
              />
              <input
                className={inputCls}
                placeholder={t("prestations.workerRole")}
                value={o.fonction}
                onChange={(e) => majOuvrier(i, { fonction: e.target.value })}
              />
              <input
                inputMode="decimal"
                className={inputCls}
                placeholder={t("prestations.workerHours")}
                value={o.heures}
                onChange={(e) => majOuvrier(i, { heures: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setOuvriers(ouvriers.filter((_, k) => k !== i))}
                aria-label={t("common:actions.delete")}
                className="rounded p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setOuvriers([...ouvriers, { nom: "", fonction: "", heures: "" }])}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <Plus className="h-3.5 w-3.5" /> {t("prestations.addWorker")}
          </button>
          <p className="mt-1 text-[11px] text-muted-foreground">{t("prestations.gdprHint")}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={f.presence_enregistree}
            onChange={(e) => set({ presence_enregistree: e.target.checked })}
          />
          {t("prestations.checkin")}
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            {t("common:actions.cancel")}
          </button>
          <button
            disabled={saving || bloque}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "…" : t("common:actions.save")}
          </button>
        </div>
      </form>
    </div>
  );
}

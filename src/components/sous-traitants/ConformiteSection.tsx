import { useState } from "react";
import { AlertTriangle, BadgeCheck, FileUp, Paperclip, ShieldOff, Unlock, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  DEROGATION_JOURS_MAX,
  STYLES_CONFORMITE,
  TYPES_DOCUMENTS,
  statutDocument,
  type Derogation,
  type DocumentConformite,
  type Exigence,
  type LigneConformite,
  type StatutConformite,
  type TypeDocument,
} from "@/lib/conformite";
import { formatDateBE } from "@/lib/format";
import { backdropClose } from "@/lib/modal";
import { codeErreurPaiement } from "@/lib/paiements";
import { aujourdhuiBruxelles, type SousTraitant } from "@/lib/sous-traitants";
import {
  ACCEPT_CAPTURE,
  controlerFichier,
  deposerDocumentConformite,
  ouvrirDocument,
  supprimerOrphelin,
} from "@/lib/stockage";
import { errorMessage } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

/**
 * Conformité d'un sous-traitant : attestations 30bis et TVA, IBAN validé, contrat ; blocage
 * d'affectation sur chantier et dérogations (admin / gérant). Statuts calculés en base.
 */
export function ConformiteSection({
  sousTraitant,
  ligne,
  documents,
  derogations,
  onChange,
}: {
  sousTraitant: SousTraitant;
  ligne: LigneConformite | undefined;
  documents: DocumentConformite[];
  derogations: Derogation[];
  onChange: () => void;
}) {
  const { t } = useTranslation(["sousTraitants", "common"]);
  const { profile } = useAuth();
  const gestionnaire = profile?.role === "admin" || profile?.role === "gerant";
  const [depot, setDepot] = useState<TypeDocument | null>(null);
  const [derogation, setDerogation] = useState(false);
  const jour = aujourdhuiBruxelles();
  const now = new Date().toISOString();
  const active = derogations.find((d) => !d.revoquee_le && d.expire_le > now);

  const erreur = (err: unknown) => {
    const code = codeErreurPaiement(err);
    toast.error(code ? t(`payments.errors.${code}`) : errorMessage(err));
  };
  const ouvrir = (chemin: string) => ouvrirDocument(chemin).catch(erreur);

  const invalider = async (d: DocumentConformite) => {
    const motif = prompt(t("compliance.invalidateReason"))?.trim();
    if (!motif) return;
    const { error } = await supabase
      .from("documents_conformite")
      .update({ invalide_le: new Date().toISOString(), motif_invalidation: motif })
      .eq("id", d.id);
    if (error) return erreur(error);
    toast.success(t("compliance.toasts.invalidated"));
    onChange();
  };

  const validerIban = async () => {
    if (!confirm(t("compliance.ibanConfirm", { iban: sousTraitant.iban }))) return;
    const { error } = await supabase
      .from("sous_traitants")
      .update({ iban_valide_le: new Date().toISOString() })
      .eq("id", sousTraitant.id);
    if (error) return erreur(error);
    toast.success(t("compliance.toasts.ibanValidated"));
    onChange();
  };

  const revoquer = async (d: Derogation) => {
    if (!confirm(t("compliance.revokeConfirm"))) return;
    const { error } = await supabase
      .from("derogations_conformite")
      .update({ revoquee_le: new Date().toISOString() })
      .eq("id", d.id);
    if (error) return erreur(error);
    toast.success(t("compliance.toasts.revoked"));
    onChange();
  };

  const statut = (e: Exigence): StatutConformite =>
    ((ligne?.[e] as StatutConformite | undefined) ?? "manquant") as StatutConformite;

  const docsDe = (type: TypeDocument) =>
    documents
      .filter((d) => d.type_document === type)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="rounded-xl border border-border bg-card">
      <h3 className="border-b border-border px-5 py-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t("compliance.title")}
      </h3>

      {ligne?.bloque && (
        <div className="m-5 mb-0 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="flex items-center gap-2 font-semibold">
            <ShieldOff className="h-4 w-4" /> {t("compliance.blocked")}
          </p>
          <p className="mt-1">
            {t("compliance.blockedDetail", {
              status: t(`compliance.status.${statut("attestation_30bis")}`),
            })}
          </p>
          {gestionnaire ? (
            <button
              onClick={() => setDerogation(true)}
              className="mt-2 inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-red-100"
            >
              <Unlock className="h-3.5 w-3.5" /> {t("compliance.liftBlock")}
            </button>
          ) : (
            <p className="mt-1 text-xs">{t("compliance.managersOnly")}</p>
          )}
        </div>
      )}
      {active && (
        <div className="m-5 mb-0 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            {t("compliance.derogationActive", { date: formatDateBE(active.expire_le) })}
          </p>
          <p className="mt-1 text-xs">{active.motif}</p>
          {gestionnaire && (
            <button
              onClick={() => revoquer(active)}
              className="mt-2 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-amber-100"
            >
              {t("compliance.revoke")}
            </button>
          )}
        </div>
      )}

      <div className="divide-y divide-border">
        {TYPES_DOCUMENTS.map((type) => (
          <div key={type} className="px-5 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge statut={statut(type)} />
                <span className="font-medium">{t(`compliance.requirement.${type}`)}</span>
              </div>
              <button
                onClick={() => setDepot(type)}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
              >
                <FileUp className="h-3.5 w-3.5" /> {t("compliance.upload")}
              </button>
            </div>
            {docsDe(type).map((d) => {
              const s = statutDocument(d.date_expiration, d.invalide_le, jour);
              return (
                <div
                  key={d.id}
                  className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-muted/50 px-3 py-1.5 text-xs"
                >
                  <Badge statut={s} petit />
                  <span className="text-muted-foreground">
                    {d.date_expiration
                      ? t("compliance.expiresOn", { date: formatDateBE(d.date_expiration) })
                      : t("compliance.noExpiry")}
                    {d.date_emission &&
                      ` · ${t("compliance.issuedOn", { date: formatDateBE(d.date_emission) })}`}
                  </span>
                  {d.invalide_le && (
                    <span className="w-full text-red-700">
                      {t("compliance.invalidatedOn", {
                        date: formatDateBE(d.invalide_le),
                        reason: d.motif_invalidation,
                      })}
                    </span>
                  )}
                  <span className="ml-auto flex gap-2">
                    {d.fichier && (
                      <button
                        onClick={() => ouvrir(d.fichier!)}
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        <Paperclip className="h-3 w-3" /> {t("compliance.view")}
                      </button>
                    )}
                    {gestionnaire && !d.invalide_le && (
                      <button
                        onClick={() => invalider(d)}
                        className="font-medium text-red-600 hover:underline"
                      >
                        {t("compliance.invalidate")}
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
          <div className="flex items-center gap-2">
            <Badge statut={statut("iban")} />
            <span className="font-medium">{t("compliance.requirement.iban")}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {sousTraitant.iban ?? t("compliance.noIban")}
            </span>
          </div>
          {sousTraitant.iban_valide_le ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
              <BadgeCheck className="h-3.5 w-3.5" />
              {t("compliance.ibanValidatedOn", { date: formatDateBE(sousTraitant.iban_valide_le) })}
            </span>
          ) : (
            gestionnaire &&
            sousTraitant.iban && (
              <button
                onClick={validerIban}
                className="rounded-lg border border-emerald-300 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
              >
                {t("compliance.validateIban")}
              </button>
            )
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5 py-3 text-sm">
          <Badge statut={statut("contrat")} />
          <span className="font-medium">{t("compliance.requirement.contrat")}</span>
          <span className="text-xs text-muted-foreground">{t("compliance.contractHint")}</span>
        </div>
      </div>

      {derogations.length > 0 && (
        <div className="border-t border-border px-5 py-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("compliance.derogationHistory")}
          </p>
          {derogations.map((d) => (
            <p key={d.id} className="text-xs text-muted-foreground">
              {t("compliance.derogationLine", {
                from: formatDateBE(d.accordee_le),
                to: formatDateBE(d.expire_le),
                reason: d.motif,
              })}
              {d.revoquee_le &&
                ` — ${t("compliance.revokedOn", { date: formatDateBE(d.revoquee_le) })}`}
            </p>
          ))}
        </div>
      )}
      <p className="border-t border-border px-5 py-2 text-xs text-muted-foreground">
        {t("compliance.footer")}
      </p>

      {depot && (
        <DocumentModal
          sousTraitantId={sousTraitant.id}
          type={depot}
          onClose={() => setDepot(null)}
          onSaved={() => {
            setDepot(null);
            onChange();
          }}
        />
      )}
      {derogation && (
        <DerogationModal
          sousTraitantId={sousTraitant.id}
          onClose={() => setDerogation(false)}
          onSaved={() => {
            setDerogation(false);
            onChange();
          }}
        />
      )}
    </div>
  );
}

function Badge({ statut, petit }: { statut: StatutConformite; petit?: boolean }) {
  const { t } = useTranslation("sousTraitants");
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ${petit ? "text-[10px]" : "text-xs"} ${STYLES_CONFORMITE[statut]}`}
    >
      {t(`compliance.status.${statut}`)}
    </span>
  );
}

function DocumentModal({
  sousTraitantId,
  type,
  onClose,
  onSaved,
}: {
  sousTraitantId: string;
  type: TypeDocument;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation(["sousTraitants", "common"]);
  const { profile } = useAuth();
  const [fichier, setFichier] = useState<File | null>(null);
  const [emission, setEmission] = useState("");
  const [expiration, setExpiration] = useState("");
  const [saving, setSaving] = useState(false);
  const expObligatoire = type === "attestation_30bis";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.company_id) return;
    const parsed = z
      .object({
        fichier: z.instanceof(File, { message: t("compliance.validation.file") }),
        expiration: expObligatoire
          ? z.string().min(1, t("compliance.validation.expiry"))
          : z.string(),
      })
      .refine((v) => !emission || !v.expiration || v.expiration >= emission, {
        message: t("compliance.validation.dates"),
      })
      .safeParse({ fichier, expiration });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSaving(true);
    let chemin: string | null = null;
    try {
      chemin = await deposerDocumentConformite(profile.company_id, fichier!);
      const { error } = await supabase.from("documents_conformite").insert({
        company_id: profile.company_id,
        sous_traitant_id: sousTraitantId,
        type_document: type,
        fichier: chemin,
        date_emission: emission || null,
        date_expiration: expiration || null,
      });
      if (error) throw error;
      toast.success(t("compliance.toasts.uploaded"));
      onSaved();
    } catch (err) {
      if (chemin) await supprimerOrphelin(chemin);
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      {...backdropClose(onClose)}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-4 rounded-2xl bg-card p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t(`compliance.requirement.${type}`)}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm hover:bg-muted">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">
            {fichier ? fichier.name : t("verification.capture.choose")}
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
              setFichier(f);
            }}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium">{t("compliance.issueDate")}</span>
            <input
              type="date"
              className={inputCls}
              value={emission}
              onChange={(e) => setEmission(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium">
              {expObligatoire ? t("compliance.expiryDateRequired") : t("compliance.expiryDate")}
            </span>
            <input
              type="date"
              className={inputCls}
              value={expiration}
              onChange={(e) => setExpiration(e.target.value)}
            />
          </label>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {expObligatoire ? t("compliance.hint30bis") : t("compliance.hintTva")}
        </p>
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

function DerogationModal({
  sousTraitantId,
  onClose,
  onSaved,
}: {
  sousTraitantId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation(["sousTraitants", "common"]);
  const { profile } = useAuth();
  const [motif, setMotif] = useState("");
  const [jours, setJours] = useState("7");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.company_id) return;
    const parsed = z
      .object({
        motif: z.string().trim().min(10, t("compliance.validation.reason")),
        jours: z.coerce
          .number()
          .int()
          .min(1, t("compliance.validation.duration"))
          .max(DEROGATION_JOURS_MAX, t("compliance.validation.duration")),
      })
      .safeParse({ motif, jours });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSaving(true);
    const { error } = await supabase.from("derogations_conformite").insert({
      company_id: profile.company_id,
      sous_traitant_id: sousTraitantId,
      motif: parsed.data.motif,
      expire_le: new Date(Date.now() + parsed.data.jours * 86_400_000).toISOString(),
    });
    setSaving(false);
    if (error) {
      const code = codeErreurPaiement(error);
      return toast.error(code ? t(`payments.errors.${code}`) : error.message);
    }
    toast.success(t("compliance.toasts.derogationGranted"));
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
        className="w-full max-w-md space-y-4 rounded-2xl bg-card p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t("compliance.liftBlock")}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">{t("compliance.derogationHint")}</p>
        <label className="block">
          <span className="mb-1 block text-xs font-medium">{t("compliance.reason")}</span>
          <textarea
            rows={3}
            className={inputCls}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium">{t("compliance.durationDays")}</span>
          <input
            type="number"
            min={1}
            max={DEROGATION_JOURS_MAX}
            className={inputCls}
            value={jours}
            onChange={(e) => setJours(e.target.value)}
          />
        </label>
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
            {saving ? "…" : t("compliance.grant")}
          </button>
        </div>
      </form>
    </div>
  );
}

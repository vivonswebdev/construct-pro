import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { cleanVAT, isValidVAT } from "@/lib/belgian";
import { backdropClose } from "@/lib/modal";
import {
  FORMES_JURIDIQUES,
  METIERS,
  SOUS_TRAITANT_STATUTS,
  formatBCE,
  isValidBCE,
  type SousTraitant,
} from "@/lib/sous-traitants";
import { useTranslation } from "react-i18next";

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

const vide = (v: string) => v.trim() || null;

export function SousTraitantFormModal({
  sousTraitant,
  onClose,
  onSaved,
}: {
  sousTraitant?: SousTraitant;
  onClose: () => void;
  onSaved: (st: SousTraitant) => void;
}) {
  const { t } = useTranslation(["sousTraitants", "common", "statuts"]);
  const { profile } = useAuth();
  const st = sousTraitant;
  const [f, setF] = useState({
    raison_sociale: st?.raison_sociale ?? "",
    forme_juridique: st?.forme_juridique ?? "srl",
    numero_bce: st?.numero_bce ? formatBCE(st.numero_bce) : "",
    numero_tva: st?.numero_tva ?? "",
    adresse: st?.adresse ?? "",
    code_postal: st?.code_postal ?? "",
    ville: st?.ville ?? "",
    email: st?.email ?? "",
    telephone: st?.telephone ?? "",
    contact_nom: st?.contact_nom ?? "",
    contact_email: st?.contact_email ?? "",
    contact_telephone: st?.contact_telephone ?? "",
    iban: st?.iban ?? "",
    metiers: st?.metiers ?? [],
    conditions: st?.conditions ?? "",
    note_interne: st?.note_interne ?? "",
    statut: st?.statut ?? "actif",
  });
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });

  const bceInvalid = !!f.numero_bce && !isValidBCE(f.numero_bce);
  const vatInvalid = !!f.numero_tva && !isValidVAT(f.numero_tva);

  const schema = z.object({
    raison_sociale: z.string().trim().min(1, t("validation.nameRequired")),
    forme_juridique: z.enum(FORMES_JURIDIQUES),
    numero_bce: z.string().refine((v) => !v || isValidBCE(v), t("validation.bceInvalid")),
    numero_tva: z.string().refine((v) => !v || isValidVAT(v), t("validation.vatInvalid")),
    email: z.string().trim().email(t("validation.emailInvalid")).or(z.literal("")),
    contact_email: z.string().trim().email(t("validation.emailInvalid")).or(z.literal("")),
    statut: z.enum(SOUS_TRAITANT_STATUTS),
  });

  const toggleMetier = (m: string) =>
    set({ metiers: f.metiers.includes(m) ? f.metiers.filter((x) => x !== m) : [...f.metiers, m] });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.company_id) return;
    const parsed = schema.safeParse(f);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSaving(true);
    const payload: TablesInsert<"sous_traitants"> = {
      company_id: profile.company_id,
      raison_sociale: f.raison_sociale.trim(),
      forme_juridique: f.forme_juridique,
      numero_bce: f.numero_bce ? f.numero_bce.replace(/[^0-9]/g, "") : null,
      numero_tva: f.numero_tva ? cleanVAT(f.numero_tva) : null,
      adresse: vide(f.adresse),
      code_postal: vide(f.code_postal),
      ville: vide(f.ville),
      email: vide(f.email),
      telephone: vide(f.telephone),
      contact_nom: vide(f.contact_nom),
      contact_email: vide(f.contact_email),
      contact_telephone: vide(f.contact_telephone),
      iban: f.iban ? f.iban.replace(/\s/g, "").toUpperCase() : null,
      metiers: f.metiers,
      conditions: vide(f.conditions),
      note_interne: vide(f.note_interne),
      statut: f.statut,
    };
    const q = st
      ? supabase.from("sous_traitants").update(payload).eq("id", st.id).select().single()
      : supabase
          .from("sous_traitants")
          .insert({ ...payload, created_by: profile.id })
          .select()
          .single();
    const { data, error } = await q;
    setSaving(false);
    if (error) {
      // 23505 : index unique (company_id, numero_bce)
      return toast.error(error.code === "23505" ? t("validation.bceDuplicate") : error.message);
    }
    toast.success(st ? t("toasts.updated") : t("toasts.created"));
    onSaved(data);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      {...backdropClose(onClose)}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{st ? t("edit") : t("new")}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <L label={t("form.name")} full>
            <input
              className={inputCls}
              value={f.raison_sociale}
              onChange={(e) => set({ raison_sociale: e.target.value })}
              placeholder={t("form.namePlaceholder")}
            />
          </L>
          <L label={t("form.legalForm")}>
            <select
              className={inputCls}
              value={f.forme_juridique}
              onChange={(e) => set({ forme_juridique: e.target.value })}
            >
              {FORMES_JURIDIQUES.map((fj) => (
                <option key={fj} value={fj}>
                  {t(`statuts:formeJuridique.${fj}`)}
                </option>
              ))}
            </select>
          </L>
          <L label={t("form.status")}>
            <select
              className={inputCls}
              value={f.statut}
              onChange={(e) => set({ statut: e.target.value })}
            >
              {SOUS_TRAITANT_STATUTS.map((s) => (
                <option key={s} value={s}>
                  {t(`statuts:sousTraitant.${s}`)}
                </option>
              ))}
            </select>
          </L>
          <L label={t("form.bce")}>
            <input
              className={`${inputCls} ${bceInvalid ? "border-red-500" : ""}`}
              value={f.numero_bce}
              onChange={(e) => set({ numero_bce: e.target.value })}
              placeholder="0123.456.789"
            />
            {bceInvalid && (
              <span className="mt-1 block text-xs text-red-600">{t("validation.bceInvalid")}</span>
            )}
          </L>
          <L label={t("form.vat")}>
            <input
              className={`${inputCls} ${vatInvalid ? "border-red-500" : ""}`}
              value={f.numero_tva}
              onChange={(e) => set({ numero_tva: e.target.value })}
              placeholder="BE0123456789"
            />
            {vatInvalid && (
              <span className="mt-1 block text-xs text-red-600">{t("validation.vatInvalid")}</span>
            )}
          </L>
          <L label={t("form.address")} full>
            <input
              className={inputCls}
              value={f.adresse}
              onChange={(e) => set({ adresse: e.target.value })}
            />
          </L>
          <L label={t("form.postalCode")}>
            <input
              className={inputCls}
              value={f.code_postal}
              onChange={(e) => set({ code_postal: e.target.value })}
            />
          </L>
          <L label={t("form.city")}>
            <input
              className={inputCls}
              value={f.ville}
              onChange={(e) => set({ ville: e.target.value })}
            />
          </L>
          <L label={t("form.email")}>
            <input
              type="email"
              className={inputCls}
              value={f.email}
              onChange={(e) => set({ email: e.target.value })}
            />
          </L>
          <L label={t("form.phone")}>
            <input
              className={inputCls}
              value={f.telephone}
              onChange={(e) => set({ telephone: e.target.value })}
            />
          </L>

          <p className="col-span-2 mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("form.contactSection")}
          </p>
          <L label={t("form.contactName")} full>
            <input
              className={inputCls}
              value={f.contact_nom}
              onChange={(e) => set({ contact_nom: e.target.value })}
            />
          </L>
          <L label={t("form.email")}>
            <input
              type="email"
              className={inputCls}
              value={f.contact_email}
              onChange={(e) => set({ contact_email: e.target.value })}
            />
          </L>
          <L label={t("form.phone")}>
            <input
              className={inputCls}
              value={f.contact_telephone}
              onChange={(e) => set({ contact_telephone: e.target.value })}
            />
          </L>

          <div className="col-span-2 mt-2">
            <span className="mb-1 block text-xs font-medium">{t("form.trades")}</span>
            <div className="flex flex-wrap gap-1.5">
              {METIERS.map((m) => {
                const on = f.metiers.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleMetier(m)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      on
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {t(`statuts:metier.${m}`)}
                  </button>
                );
              })}
            </div>
          </div>

          <L label={t("form.iban")} full>
            <input
              className={inputCls}
              value={f.iban}
              onChange={(e) => set({ iban: e.target.value })}
              placeholder="BE68 5390 0754 7034"
            />
            {st?.iban_valide_le && f.iban.replace(/\s/g, "").toUpperCase() !== (st.iban ?? "") && (
              <span className="mt-1 block text-xs text-amber-700">
                {t("compliance.ibanChangeWarning")}
              </span>
            )}
          </L>
          <L label={t("form.conditions")} full>
            <textarea
              rows={2}
              className={inputCls}
              value={f.conditions}
              onChange={(e) => set({ conditions: e.target.value })}
              placeholder={t("form.conditionsPlaceholder")}
            />
          </L>
          <L label={t("form.internalNote")} full>
            <textarea
              rows={2}
              className={inputCls}
              value={f.note_interne}
              onChange={(e) => set({ note_interne: e.target.value })}
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

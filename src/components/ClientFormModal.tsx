import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cleanVAT, isValidVAT } from "@/lib/belgian";
import type { Client } from "@/lib/clients";
import { backdropClose } from "@/lib/modal";
import { useTranslation } from "react-i18next";
import { LANGUES_DOCUMENTS, type LangueDocument } from "@/lib/i18n";

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

export function ClientFormModal({
  client,
  onClose,
  onSaved,
}: {
  client?: Client;
  onClose: () => void;
  onSaved: (c: Client) => void;
}) {
  const { t } = useTranslation(["clients", "common", "statuts"]);
  const { profile } = useAuth();
  const [f, setF] = useState({
    type: client?.type ?? "particulier",
    nom: client?.nom ?? "",
    prenom: client?.prenom ?? "",
    raison_sociale: client?.raison_sociale ?? "",
    numero_bce: client?.numero_bce ?? "",
    numero_tva: client?.numero_tva ?? "",
    assujetti_tva: client?.assujetti_tva ?? false,
    adresse: client?.adresse ?? "",
    code_postal: client?.code_postal ?? "",
    ville: client?.ville ?? "",
    email: client?.email ?? "",
    telephone: client?.telephone ?? "",
    langue: ((client?.langue ?? "fr").toLowerCase() as LangueDocument) || "fr",
    notes: client?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  const isEnt = f.type === "entreprise";
  const vatInvalid = !!f.numero_tva && !isValidVAT(f.numero_tva);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.company_id) return;
    if (isEnt && !f.raison_sociale.trim()) return toast.error(t("validation.companyNameRequired"));
    if (!isEnt && !f.nom.trim()) return toast.error(t("validation.lastNameRequired"));
    if (vatInvalid) return toast.error(t("validation.vatInvalid"));
    if (f.assujetti_tva && !f.numero_tva) return toast.error(t("validation.vatRequiredIfLiable"));
    setSaving(true);
    const payload = {
      ...f,
      numero_tva: f.numero_tva ? cleanVAT(f.numero_tva) : null,
      company_id: profile.company_id,
    };
    const q = client
      ? supabase.from("clients").update(payload).eq("id", client.id).select().single()
      : supabase.from("clients").insert(payload).select().single();
    const { data, error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(client ? t("toasts.updated") : t("toasts.created"));
    onSaved(data as Client);
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
          <h3 className="text-lg font-semibold">{client ? t("edit") : t("new")}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-4 flex w-fit gap-1 rounded-lg bg-muted p-1">
          {(["particulier", "entreprise"] as const).map((ty) => (
            <button
              key={ty}
              type="button"
              onClick={() => set({ type: ty })}
              className={`rounded-md px-4 py-1.5 text-sm font-medium ${f.type === ty ? "bg-card shadow-sm" : "text-muted-foreground"}`}
            >
              {t(`statuts:clientType.${ty}`)}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {isEnt ? (
            <>
              <L label={t("form.companyName")} full>
                <input
                  className={inputCls}
                  value={f.raison_sociale}
                  onChange={(e) => set({ raison_sociale: e.target.value })}
                  placeholder={t("form.companyNamePlaceholder")}
                />
              </L>
              <L label={t("form.bce")}>
                <input
                  className={inputCls}
                  value={f.numero_bce}
                  onChange={(e) => set({ numero_bce: e.target.value })}
                  placeholder="0123.456.789"
                />
              </L>
              <L label={t("form.contactName")}>
                <input
                  className={inputCls}
                  value={f.nom}
                  onChange={(e) => set({ nom: e.target.value })}
                />
              </L>
            </>
          ) : (
            <>
              <L label={t("form.firstName")}>
                <input
                  className={inputCls}
                  value={f.prenom}
                  onChange={(e) => set({ prenom: e.target.value })}
                />
              </L>
              <L label={t("form.lastName")}>
                <input
                  className={inputCls}
                  value={f.nom}
                  onChange={(e) => set({ nom: e.target.value })}
                />
              </L>
            </>
          )}
          <L label={t("form.vat")}>
            <input
              className={`${inputCls} ${vatInvalid ? "border-red-500" : ""}`}
              value={f.numero_tva}
              onChange={(e) => set({ numero_tva: e.target.value })}
              placeholder="BE0123456789"
            />
            {vatInvalid && (
              <span className="mt-1 block text-xs text-red-600">{t("form.vatInvalid")}</span>
            )}
          </L>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={f.assujetti_tva}
              onChange={(e) => set({ assujetti_tva: e.target.checked })}
            />
            {t("form.vatLiable")}
          </label>
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
          <L label={t("form.language")}>
            <select
              className={inputCls}
              value={f.langue}
              onChange={(e) => set({ langue: e.target.value as LangueDocument })}
            >
              {LANGUES_DOCUMENTS.map((l) => (
                <option key={l} value={l}>
                  {t(`statuts:langue.${l}`)}
                </option>
              ))}
            </select>
          </L>
          <L label={t("form.notes")} full>
            <textarea
              rows={2}
              className={inputCls}
              value={f.notes}
              onChange={(e) => set({ notes: e.target.value })}
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

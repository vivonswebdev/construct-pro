import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { backdropClose } from "@/lib/modal";
import { PERSONNEL_STATUTS, toCode } from "@/lib/statuts";
import { codeErreurPointage } from "@/lib/timesheet";
import { errorMessage } from "@/lib/utils";

const champ =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

/** Fiche d'un travailleur de l'équipe interne : identité, fonction, statut, dates, compte lié. */
export function FicheTravailleurModal({
  personne,
  gestionnaire,
  onClose,
  onSaved,
}: {
  personne: Tables<"personnel">;
  gestionnaire: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation(["personnel", "timesheet", "common", "statuts", "nav"]);
  const [f, setF] = useState({
    full_name: personne.full_name,
    fonction: personne.fonction ?? "",
    phone: personne.phone ?? "",
    email: personne.email ?? "",
    status: toCode(personne.status) === "inactif" ? "inactif" : "actif",
    date_entree: personne.date_entree ?? "",
    date_sortie: personne.date_sortie ?? "",
    profile_id: personne.profile_id ?? "",
  });
  const [saving, setSaving] = useState(false);

  const comptes = useQuery({
    queryKey: ["comptes-societe"],
    enabled: gestionnaire,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("comptes_societe");
      if (error) throw error;
      return data;
    },
  });

  const date = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]);
  const schema = z
    .object({
      full_name: z.string().trim().min(1, t("fiche.validation.name")).max(200),
      fonction: z.string().trim().max(120),
      phone: z.string().trim().max(40),
      email: z.union([z.literal(""), z.string().trim().email(t("fiche.validation.email"))]),
      status: z.enum(PERSONNEL_STATUTS),
      date_entree: date,
      date_sortie: date,
      profile_id: z.string(),
    })
    .refine((v) => !v.date_entree || !v.date_sortie || v.date_sortie >= v.date_entree, {
      message: t("fiche.validation.dates"),
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = schema.safeParse(f);
    if (!v.success) return toast.error(v.error.issues[0]?.message);
    const d = v.data;
    setSaving(true);
    const { error } = await supabase
      .from("personnel")
      .update({
        full_name: d.full_name,
        fonction: d.fonction || null,
        phone: d.phone || null,
        email: d.email || null,
        status: d.status,
        date_entree: d.date_entree || null,
        date_sortie: d.date_sortie || null,
        ...(gestionnaire ? { profile_id: d.profile_id || null } : {}),
      })
      .eq("id", personne.id);
    setSaving(false);
    if (error) {
      const code = codeErreurPointage(error);
      return toast.error(code ? t(`timesheet:errors.${code}`) : errorMessage(error));
    }
    toast.success(t("fiche.saved"));
    onSaved();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      {...backdropClose(onClose)}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t("fiche.title")}</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-3">
          <L label={t("form.fullName")}>
            <input
              required
              className={champ}
              value={f.full_name}
              onChange={(e) => setF({ ...f, full_name: e.target.value })}
            />
          </L>
          <div className="grid gap-3 sm:grid-cols-2">
            <L label={t("fiche.function")}>
              <input
                className={champ}
                placeholder={t("fiche.functionPlaceholder")}
                value={f.fonction}
                onChange={(e) => setF({ ...f, fonction: e.target.value })}
              />
            </L>
            <L label={t("fiche.status")}>
              <select
                className={champ}
                value={f.status}
                onChange={(e) => setF({ ...f, status: e.target.value })}
              >
                {PERSONNEL_STATUTS.map((s) => (
                  <option key={s} value={s}>
                    {t(`statuts:personnel.${s}`)}
                  </option>
                ))}
              </select>
            </L>
            <L label={t("form.phone")}>
              <input
                className={champ}
                value={f.phone}
                onChange={(e) => setF({ ...f, phone: e.target.value })}
              />
            </L>
            <L label={t("form.email")}>
              <input
                type="email"
                className={champ}
                value={f.email}
                onChange={(e) => setF({ ...f, email: e.target.value })}
              />
            </L>
            <L label={t("fiche.startDate")}>
              <input
                type="date"
                className={champ}
                value={f.date_entree}
                onChange={(e) => setF({ ...f, date_entree: e.target.value })}
              />
            </L>
            <L label={t("fiche.endDate")} aide={t("fiche.endDateHelp")}>
              <input
                type="date"
                className={champ}
                value={f.date_sortie}
                onChange={(e) => setF({ ...f, date_sortie: e.target.value })}
              />
            </L>
          </div>
          {gestionnaire && (
            <L label={t("fiche.account")} aide={t("fiche.accountHelp")}>
              <select
                className={champ}
                value={f.profile_id}
                onChange={(e) => setF({ ...f, profile_id: e.target.value })}
              >
                <option value="">{t("fiche.noAccount")}</option>
                {(comptes.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {[c.nom, c.email].filter(Boolean).join(" · ")} (
                    {t(`nav:roles.${c.role}`, { defaultValue: c.role })})
                  </option>
                ))}
              </select>
            </L>
          )}
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
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? "…" : t("common:actions.save")}
          </button>
        </div>
      </form>
    </div>
  );
}

function L({ label, aide, children }: { label: string; aide?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium">{label}</span>
      {children}
      {aide && <span className="mt-1 block text-[11px] text-muted-foreground">{aide}</span>}
    </label>
  );
}

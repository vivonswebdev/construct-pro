import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { formatDateBE } from "@/lib/format";
import { backdropClose } from "@/lib/modal";
import { intlLocale } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { codeErreurPointage, dureeSaisie, formatDuree, heureCourte } from "@/lib/timesheet";

type Pointage = Tables<"pointages">;
type Option = { id: string; nom: string };

function useErreur() {
  const { t } = useTranslation("timesheet");
  return (err: unknown) => {
    const code = codeErreurPointage(err);
    toast.error(code ? t(`errors.${code}`) : errorMessage(err));
  };
}

function Cadre({
  titre,
  onClose,
  children,
}: {
  titre: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      {...backdropClose(onClose)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{titre}</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const champ =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function Champ({
  label,
  aide,
  children,
}: {
  label: string;
  aide?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium">{label}</span>
      {children}
      {aide && <span className="mt-1 block text-[11px] text-muted-foreground">{aide}</span>}
    </label>
  );
}

/** Création (pointage = null) ou correction avec motif obligatoire. */
export function PointageModal({
  pointage,
  travailleurs,
  chantiers,
  companyId,
  dateParDefaut,
  onClose,
  onSaved,
}: {
  pointage: Pointage | null;
  travailleurs: Option[];
  chantiers: Option[];
  companyId: string;
  dateParDefaut: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation(["timesheet", "common"]);
  const erreur = useErreur();
  const correction = !!pointage;
  const [f, setF] = useState({
    personnel_id: pointage?.personnel_id ?? "",
    chantier_id: pointage?.chantier_id ?? "",
    date: pointage?.date ?? dateParDefaut,
    arrivee: heureCourte(pointage?.arrivee) || "07:30",
    depart: heureCourte(pointage?.depart),
    pause: String(pointage?.pause_minutes ?? 30),
    note: pointage?.note ?? "",
    motif: "",
  });
  const [saving, setSaving] = useState(false);
  const pause = Number(f.pause || 0);
  const duree = f.depart ? dureeSaisie(f.arrivee, f.depart, pause) : null;

  const schema = z
    .object({
      personnel_id: z.string().min(1, t("validation.worker")),
      chantier_id: z.string().min(1, t("validation.site")),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t("validation.date")),
      arrivee: z.string().regex(/^\d{2}:\d{2}$/, t("validation.arrival")),
      depart: z.string().regex(/^(\d{2}:\d{2})?$/),
      pause: z.number().int().min(0, t("validation.break")).max(720, t("validation.break")),
      note: z.string().max(500),
      motif: correction ? z.string().trim().min(1, t("validation.reason")) : z.string(),
    })
    .refine((v) => !v.depart || dureeSaisie(v.arrivee, v.depart, v.pause) != null, {
      message: t("validation.times"),
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = schema.safeParse({ ...f, pause });
    if (!v.success) return toast.error(v.error.issues[0]?.message);
    const d = v.data;
    setSaving(true);
    const { error } = correction
      ? await supabase.rpc("corriger_pointage", {
          _id: pointage.id,
          _chantier_id: d.chantier_id,
          _date: d.date,
          _arrivee: d.arrivee,
          _depart: d.depart || null,
          _pause_minutes: d.pause,
          _note: d.note.trim() || null,
          _motif: d.motif.trim(),
        })
      : await supabase.from("pointages").insert({
          company_id: companyId,
          personnel_id: d.personnel_id,
          chantier_id: d.chantier_id,
          date: d.date,
          arrivee: d.arrivee,
          depart: d.depart || null,
          pause_minutes: d.pause,
          note: d.note.trim() || null,
        });
    setSaving(false);
    if (error) return erreur(error);
    toast.success(t(correction ? "toasts.corrected" : "toasts.created"));
    onSaved();
  };

  return (
    <Cadre titre={t(correction ? "form.correctTitle" : "form.newTitle")} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3">
        <Champ label={t("form.worker")}>
          <select
            className={champ}
            value={f.personnel_id}
            disabled={correction}
            onChange={(e) => setF({ ...f, personnel_id: e.target.value })}
          >
            <option value="">{t("form.choose")}</option>
            {travailleurs.map((w) => (
              <option key={w.id} value={w.id}>
                {w.nom}
              </option>
            ))}
          </select>
        </Champ>
        {!correction && travailleurs.length === 0 && (
          <p className="text-xs text-warning">{t("form.noActiveWorker")}</p>
        )}
        <Champ label={t("form.site")}>
          <select
            className={champ}
            value={f.chantier_id}
            onChange={(e) => setF({ ...f, chantier_id: e.target.value })}
          >
            <option value="">{t("form.choose")}</option>
            {chantiers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        </Champ>
        {chantiers.length === 0 && <p className="text-xs text-warning">{t("form.noSite")}</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="col-span-2 sm:col-span-1">
            <Champ label={t("form.date")}>
              <input
                type="date"
                className={champ}
                value={f.date}
                onChange={(e) => setF({ ...f, date: e.target.value })}
              />
            </Champ>
          </div>
          <Champ label={t("form.arrival")}>
            <input
              type="time"
              className={champ}
              value={f.arrivee}
              onChange={(e) => setF({ ...f, arrivee: e.target.value })}
            />
          </Champ>
          <Champ label={t("columns.departure")}>
            <input
              type="time"
              className={champ}
              value={f.depart}
              onChange={(e) => setF({ ...f, depart: e.target.value })}
            />
          </Champ>
          <Champ label={t("form.break")}>
            <input
              type="number"
              min={0}
              max={720}
              step={5}
              className={champ}
              value={f.pause}
              onChange={(e) => setF({ ...f, pause: e.target.value })}
            />
          </Champ>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("form.departure")} ·{" "}
          {t("form.duration", { duree: f.depart ? formatDuree(duree) : t("inProgress") })}
        </p>
        <Champ label={t("form.note")}>
          <input
            className={champ}
            maxLength={500}
            value={f.note}
            onChange={(e) => setF({ ...f, note: e.target.value })}
          />
        </Champ>
        {correction && (
          <Champ label={t("form.reason")} aide={t("form.reasonHelp")}>
            <textarea
              required
              rows={2}
              className={champ}
              value={f.motif}
              onChange={(e) => setF({ ...f, motif: e.target.value })}
            />
          </Champ>
        )}
        <div className="mt-2 flex justify-end gap-2">
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
    </Cadre>
  );
}

export function SuppressionPointageModal({
  pointage,
  travailleur,
  chantier,
  onClose,
  onDeleted,
}: {
  pointage: Pointage;
  travailleur: string;
  chantier: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation(["timesheet", "common"]);
  const erreur = useErreur();
  const [motif, setMotif] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = z.string().trim().min(1, t("validation.reason")).safeParse(motif);
    if (!v.success) return toast.error(v.error.issues[0]?.message);
    setSaving(true);
    const { error } = await supabase.rpc("supprimer_pointage", {
      _id: pointage.id,
      _motif: v.data,
    });
    setSaving(false);
    if (error) return erreur(error);
    toast.success(t("toasts.deleted"));
    onDeleted();
  };

  return (
    <Cadre titre={t("delete.title")} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3">
        <p className="text-sm">
          {t("delete.text", {
            date: formatDateBE(pointage.date),
            worker: travailleur,
            site: chantier,
          })}
        </p>
        <Champ label={t("form.reason")} aide={t("form.reasonHelp")}>
          <textarea
            required
            rows={2}
            className={champ}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
          />
        </Champ>
        <div className="mt-2 flex justify-end gap-2">
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
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {saving ? "…" : t("delete.confirm")}
          </button>
        </div>
      </form>
    </Cadre>
  );
}

/** Lecture d'un état « avant / après » enregistré par le trigger (to_jsonb du pointage). */
function resume(
  j: Json | null,
  chantiers: Map<string, string>,
  pause: (n: number) => string,
): string {
  if (!j || typeof j !== "object" || Array.isArray(j)) return "—";
  const v = j as Record<string, Json>;
  const s = (k: string) => (typeof v[k] === "string" ? (v[k] as string) : "");
  return [
    formatDateBE(s("date")),
    `${heureCourte(s("arrivee"))}–${heureCourte(s("depart")) || "…"}`,
    pause(Number(v.pause_minutes ?? 0)),
    chantiers.get(s("chantier_id")) ?? "",
    s("note"),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function HistoriquePointageModal({
  pointageId,
  chantiers,
  onClose,
}: {
  pointageId: string;
  chantiers: Map<string, string>;
  onClose: () => void;
}) {
  const { t } = useTranslation(["timesheet", "common"]);
  const pauseTexte = (n: number) => t("breakMinutes", { count: n });
  const { data, isLoading } = useQuery({
    queryKey: ["pointage-historique", pointageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pointage_corrections")
        .select("*")
        .eq("pointage_id", pointageId)
        .order("le", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  return (
    <Cadre titre={t("history.title")} onClose={onClose}>
      {isLoading ? (
        <div className="h-20 animate-pulse rounded-lg bg-muted" />
      ) : !data?.length ? (
        <p className="text-sm text-muted-foreground">{t("history.empty")}</p>
      ) : (
        <ol className="space-y-3">
          {data.map((c) => (
            <li key={c.id} className="rounded-lg border border-border p-3 text-sm">
              <p className="font-semibold">
                {t(`history.${c.action === "suppression" ? "suppression" : "modification"}`)} —{" "}
                {new Date(c.le).toLocaleString(intlLocale())}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("history.by", { nom: c.par_nom || t("history.unknown") })}
              </p>
              <p className="mt-2 italic">{t("history.reason", { motif: c.motif })}</p>
              <p className="mt-2 text-xs">
                {t("history.before", { valeur: resume(c.avant, chantiers, pauseTexte) })}
              </p>
              {c.apres && (
                <p className="text-xs">
                  {t("history.after", { valeur: resume(c.apres, chantiers, pauseTexte) })}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </Cadre>
  );
}

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FileLock2, History, Plus, RefreshCw, ShieldCheck, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { formatDateBE } from "@/lib/format";
import { intlLocale } from "@/lib/i18n";
import { backdropClose } from "@/lib/modal";
import { errorMessage } from "@/lib/utils";
import {
  ACCEPT_RH,
  codeErreurRh,
  controlerFichierRh,
  deposerDocumentRh,
  ouvrirDocumentRh,
  supprimerDocumentRh,
  type CibleRh,
  type TypeRh,
} from "@/lib/documents-rh";

type DocRh = Tables<"documents_rh">;

const champ =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function useErreurRh() {
  const { t } = useTranslation("rh");
  return (err: unknown) => {
    const code = codeErreurRh(err);
    toast.error(code ? t(`errors.${code}`) : errorMessage(err));
  };
}

/**
 * Documents scannés (bucket privé `rh`) rattachés à un travailleur, un sous-traitant, un
 * chantier ou un client. Réservé aux administrateurs et gérants : rien ne s'affiche pour les
 * autres rôles (la base ne leur renvoie rien non plus).
 */
export function DocumentsRhSection({ cible, types }: { cible: CibleRh; types: TypeRh[] }) {
  const { t } = useTranslation(["rh", "common"]);
  const { profile } = useAuth();
  const qc = useQueryClient();
  const erreur = useErreurRh();
  const gestionnaire = profile?.role === "admin" || profile?.role === "gerant";
  const [historique, setHistorique] = useState(false);
  const [modal, setModal] = useState<
    | { type: "depot"; remplace: DocRh | null }
    | { type: "suppression"; doc: DocRh }
    | { type: "journal"; doc: DocRh }
    | null
  >(null);
  const [cle, valeur] = Object.entries(cible)[0] as [keyof CibleRh & string, string];

  const { data, isLoading } = useQuery({
    queryKey: ["documents-rh", cle, valeur],
    enabled: gestionnaire,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents_rh")
        .select("*")
        .eq(cle as "personnel_id", valeur)
        .in("type", types)
        .neq("statut", "en_attente")
        .order("depose_le", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  if (!gestionnaire) return null;

  const rafraichir = () => {
    setModal(null);
    void qc.invalidateQueries({ queryKey: ["documents-rh"] });
    void qc.invalidateQueries({ queryKey: ["documents-rh-a-traiter"] });
  };
  const visibles = (data ?? []).filter((d) => historique || d.statut === "actif");
  const masques = (data ?? []).length - visibles.length;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <FileLock2 className="h-5 w-5 text-primary" /> {t("title")}
          </h2>
          <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
        </div>
        <button
          onClick={() => setModal({ type: "depot", remplace: null })}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> {t("actions.add")}
        </button>
      </div>

      {isLoading ? (
        <div className="h-16 animate-pulse rounded-lg bg-muted" />
      ) : visibles.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {visibles.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {t(`types.${d.type as TypeRh}`)}
                  {d.titre ? ` · ${d.titre}` : ""}
                  {d.statut !== "actif" && (
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {t(`statuts.${d.statut as "remplace" | "supprime"}`)}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("deposited", { date: formatDateBE(d.depose_le) })}
                  {d.type === "carte_identite" &&
                    d.statut !== "supprime" &&
                    ` · ${
                      d.conserver_jusqu_au
                        ? t("keepUntil", { date: formatDateBE(d.conserver_jusqu_au) })
                        : t("keepUntilExit")
                    }`}
                  {d.statut === "supprime" && d.supprime_le
                    ? ` · ${t("deletedOn", { date: formatDateBE(d.supprime_le), motif: d.motif_suppression ?? "" })}`
                    : ""}
                </p>
              </div>
              <div className="flex gap-1">
                {d.statut !== "supprime" && (
                  <Bouton
                    label={t("actions.view")}
                    icon={Eye}
                    onClick={() => void ouvrirDocumentRh(d.id).catch(erreur)}
                  />
                )}
                {d.statut === "actif" && (
                  <Bouton
                    label={t("actions.replace")}
                    icon={RefreshCw}
                    onClick={() => setModal({ type: "depot", remplace: d })}
                  />
                )}
                <Bouton
                  label={t("actions.log")}
                  icon={History}
                  onClick={() => setModal({ type: "journal", doc: d })}
                />
                {d.statut !== "supprime" ? (
                  <Bouton
                    label={t("actions.delete")}
                    icon={Trash2}
                    danger
                    onClick={() => setModal({ type: "suppression", doc: d })}
                  />
                ) : (
                  <Bouton
                    label={t("actions.eraseAgain")}
                    icon={Trash2}
                    danger
                    onClick={() =>
                      void supprimerDocumentRh(d.id, d.motif_suppression ?? "")
                        .then(() => {
                          toast.success(t("toasts.deleted"));
                          rafraichir();
                        })
                        .catch(erreur)
                    }
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {(masques > 0 || historique) && (
        <button
          onClick={() => setHistorique((h) => !h)}
          className="mt-2 text-xs font-medium text-primary hover:underline"
        >
          {historique ? t("hideHistory") : t("showHistory", { count: masques })}
        </button>
      )}

      {modal?.type === "depot" && (
        <DepotModal
          cible={cible}
          types={modal.remplace ? [modal.remplace.type as TypeRh] : types}
          remplace={modal.remplace}
          onClose={() => setModal(null)}
          onDone={rafraichir}
        />
      )}
      {modal?.type === "suppression" && (
        <SuppressionModal doc={modal.doc} onClose={() => setModal(null)} onDone={rafraichir} />
      )}
      {modal?.type === "journal" && <JournalModal doc={modal.doc} onClose={() => setModal(null)} />}
    </div>
  );
}

function Bouton({
  label,
  icon: Icon,
  onClick,
  danger,
}: {
  label: string;
  icon: typeof Eye;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded-md p-1.5 hover:bg-muted ${danger ? "text-red-600" : "text-muted-foreground"}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
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

function Actions({
  onClose,
  saving,
  label,
  danger,
}: {
  onClose: () => void;
  saving: boolean;
  label: string;
  danger?: boolean;
}) {
  const { t } = useTranslation("common");
  return (
    <div className="mt-2 flex justify-end gap-2">
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
      >
        {t("actions.cancel")}
      </button>
      <button
        type="submit"
        disabled={saving}
        className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${danger ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary/90"}`}
      >
        {saving ? "…" : label}
      </button>
    </div>
  );
}

function DepotModal({
  cible,
  types,
  remplace,
  onClose,
  onDone,
}: {
  cible: CibleRh;
  types: TypeRh[];
  remplace: DocRh | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation(["rh", "common"]);
  const erreur = useErreurRh();
  const [type, setType] = useState<TypeRh>(types[0]);
  const [titre, setTitre] = useState(remplace?.titre ?? "");
  const [fichier, setFichier] = useState<File | null>(null);
  const [consentement, setConsentement] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const carte = type === "carte_identite";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = z
      .object({
        titre: z.string().trim().max(200),
        note: z.string().trim().max(500),
        fichier: z.instanceof(File, { message: t("validation.file") }),
        consentement: z.boolean(),
      })
      .refine((x) => !carte || x.consentement, { message: t("validation.consent") })
      .safeParse({ titre, note, fichier: fichier ?? undefined, consentement });
    if (!v.success) return toast.error(v.error.issues[0]?.message);
    const probleme = controlerFichierRh(v.data.fichier);
    if (probleme) return toast.error(t(`errors.${probleme}`));
    setSaving(true);
    try {
      await deposerDocumentRh({
        type,
        titre: v.data.titre,
        fichier: v.data.fichier,
        cible,
        consentement: carte && v.data.consentement,
        noteConsentement: v.data.note,
        remplaceId: remplace?.id ?? null,
      });
      toast.success(t("toasts.deposited"));
      onDone();
    } catch (err) {
      erreur(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Cadre titre={t(remplace ? "deposit.replaceTitle" : "deposit.title")} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3">
        <Champ label={t("deposit.type")}>
          <select
            className={champ}
            value={type}
            disabled={!!remplace}
            onChange={(e) => setType(e.target.value as TypeRh)}
          >
            {types.map((ty) => (
              <option key={ty} value={ty}>
                {t(`types.${ty}`)}
              </option>
            ))}
          </select>
        </Champ>
        <Champ label={t("deposit.label")}>
          <input
            className={champ}
            maxLength={200}
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
          />
        </Champ>
        <Champ label={t("deposit.file")} aide={t("deposit.fileHelp")}>
          <input
            type="file"
            accept={ACCEPT_RH}
            capture="environment"
            className={champ}
            onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
          />
        </Champ>
        {carte && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <p className="flex items-center gap-1.5 font-semibold">
              <ShieldCheck className="h-4 w-4" /> {t("gdpr.title")}
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>{t("gdpr.purpose")}</li>
              <li>{t("gdpr.retention")}</li>
              <li>{t("gdpr.access")}</li>
              <li>{t("gdpr.noProcessing")}</li>
            </ul>
            <label className="mt-2 flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={consentement}
                onChange={(e) => setConsentement(e.target.checked)}
              />
              <span>{t("gdpr.consent")}</span>
            </label>
            <div className="mt-2">
              <Champ label={t("gdpr.note")}>
                <input
                  className={champ}
                  maxLength={500}
                  placeholder={t("gdpr.notePlaceholder")}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Champ>
            </div>
          </div>
        )}
        {remplace && (
          <p className="text-xs text-muted-foreground">
            {t(carte ? "deposit.replaceCard" : "deposit.replaceContract")}
          </p>
        )}
        <Actions onClose={onClose} saving={saving} label={t("deposit.submit")} />
      </form>
    </Cadre>
  );
}

function SuppressionModal({
  doc,
  onClose,
  onDone,
}: {
  doc: DocRh;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation(["rh", "common"]);
  const erreur = useErreurRh();
  const [motif, setMotif] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = z.string().trim().min(1, t("validation.reason")).max(500).safeParse(motif);
    if (!v.success) return toast.error(v.error.issues[0]?.message);
    setSaving(true);
    try {
      await supprimerDocumentRh(doc.id, v.data);
      toast.success(t("toasts.deleted"));
      onDone();
    } catch (err) {
      erreur(err);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Cadre titre={t("delete.title")} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3">
        <p className="text-sm">{t("delete.text", { type: t(`types.${doc.type as TypeRh}`) })}</p>
        <Champ label={t("delete.reason")}>
          <textarea
            required
            rows={2}
            className={champ}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
          />
        </Champ>
        <Actions onClose={onClose} saving={saving} label={t("delete.confirm")} danger />
      </form>
    </Cadre>
  );
}

function JournalModal({ doc, onClose }: { doc: DocRh; onClose: () => void }) {
  const { t } = useTranslation(["rh", "common"]);
  const { data, isLoading } = useQuery({
    queryKey: ["journal-acces-rh", doc.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_acces_rh")
        .select("*")
        .eq("document_id", doc.id)
        .order("le", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  return (
    <Cadre titre={t("log.title")} onClose={onClose}>
      {isLoading ? (
        <div className="h-16 animate-pulse rounded-lg bg-muted" />
      ) : !data?.length ? (
        <p className="text-sm text-muted-foreground">{t("log.empty")}</p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {data.map((j) => (
            <li key={j.id} className="flex justify-between gap-3 py-2">
              <span className="font-medium">
                {t(
                  `log.actions.${j.action as "depot" | "consultation" | "remplacement" | "suppression"}`,
                )}
              </span>
              <span className="text-right text-xs text-muted-foreground">
                {new Date(j.le).toLocaleString(intlLocale())}
                <br />
                {j.par_nom || t("log.unknown")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Cadre>
  );
}

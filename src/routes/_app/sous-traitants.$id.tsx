import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  ShieldCheck,
  Lock,
  Unlock,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SousTraitantFormModal } from "@/components/SousTraitantFormModal";
import { TranslatableText } from "@/components/TranslatableText";
import { useAuth } from "@/lib/auth";
import { formatEURBE, formatVATDisplay } from "@/lib/belgian";
import { formatDateBE } from "@/lib/format";
import { pageHead } from "@/lib/head";
import { intlLocale } from "@/lib/i18n";
import { backdropClose } from "@/lib/modal";
import {
  ETAT_CONFORMITE_STYLES,
  etatConformite,
  formatBCE,
  urlVerification30bis,
  type SousTraitant,
} from "@/lib/sous-traitants";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_app/sous-traitants/$id")({
  head: () => pageHead("sousTraitant"),
  component: SousTraitantDetail,
});

function SousTraitantDetail() {
  const { t } = useTranslation(["sousTraitants", "common", "statuts"]);
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [edit, setEdit] = useState(false);
  const [verif, setVerif] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["sous_traitant", id],
    queryFn: async () => {
      const [st, vf, ct] = await Promise.all([
        supabase.from("sous_traitants").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("verifications_30bis")
          .select("*")
          .eq("sous_traitant_id", id)
          .order("verifie_le", { ascending: false }),
        supabase
          .from("sous_traitant_contrats")
          .select("*")
          .eq("sous_traitant_id", id)
          .order("date_debut", { ascending: false }),
      ]);
      const contrats = ct.data ?? [];
      const contratIds = contrats.map((c) => c.id);
      const chantierIds = [...new Set(contrats.map((c) => c.chantier_id).filter(Boolean))];
      const [pm, ch] = await Promise.all([
        contratIds.length
          ? supabase
              .from("achat_paiements")
              .select("*")
              .in("contrat_id", contratIds)
              .order("date_paiement", { ascending: false })
          : Promise.resolve({ data: [] }),
        chantierIds.length
          ? supabase
              .from("chantiers")
              .select("id, name")
              .in("id", chantierIds as string[])
          : Promise.resolve({ data: [] }),
      ]);
      return {
        st: st.data,
        verifications: vf.data ?? [],
        contrats,
        paiements: pm.data ?? [],
        chantiers: new Map((ch.data ?? []).map((c) => [c.id, c.name])),
      };
    },
  });

  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  const st = data?.st;
  if (!data || !st) return <p className="text-sm text-muted-foreground">{t("notFound")}</p>;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["sous_traitant", id] });
    qc.invalidateQueries({ queryKey: ["sous_traitants"] });
  };

  const derniere = data.verifications[0] ?? null;
  const etat = etatConformite(derniere);
  const totalVerse = data.paiements.reduce((s, p) => s + Number(p.montant_verse ?? 0), 0);
  const totalRetenues = data.paiements.reduce(
    (s, p) => s + Number(p.retenue_onss) + Number(p.retenue_spf),
    0,
  );
  const contratLabel = new Map(data.contrats.map((c) => [c.id, c.descriptif_prestations] as const));

  const toggleStatut = async () => {
    const statut = st.statut === "bloque" ? "actif" : "bloque";
    const { error } = await supabase.from("sous_traitants").update({ statut }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("toasts.updated"));
    refresh();
  };

  const remove = async () => {
    if (!confirm(t("detail.confirmDelete"))) return;
    const { error } = await supabase.from("sous_traitants").delete().eq("id", id);
    // 23503 : des vérifications 30bis ou des paiements (preuves) empêchent la suppression.
    if (error)
      return toast.error(error.code === "23503" ? t("detail.deleteBlocked") : error.message);
    qc.invalidateQueries({ queryKey: ["sous_traitants"] });
    navigate({ to: "/sous-traitants" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/sous-traitants" className="rounded-lg p-2 hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{st.raison_sociale}</h1>
            <p className="text-sm text-muted-foreground">
              {[
                st.forme_juridique &&
                  t(`statuts:formeJuridique.${st.forme_juridique}`, {
                    defaultValue: st.forme_juridique,
                  }),
                t(`statuts:sousTraitant.${st.statut}`, { defaultValue: st.statut }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEdit(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <Edit2 className="h-4 w-4" /> {t("common:actions.edit")}
          </button>
          <button
            onClick={toggleStatut}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            {st.statut === "bloque" ? (
              <>
                <Unlock className="h-4 w-4" /> {t("detail.unblock")}
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" /> {t("detail.block")}
              </>
            )}
          </button>
          <button
            onClick={remove}
            aria-label={t("common:actions.delete")}
            className="rounded-lg border border-red-200 px-3 py-2 text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label={t("detail.contracts")} value={String(data.contrats.length)} />
        <Kpi label={t("detail.totalPaid")} value={formatEURBE(totalVerse)} />
        <Kpi
          label={t("detail.totalWithheld")}
          value={formatEURBE(totalRetenues)}
          tone={totalRetenues > 0 ? "text-red-600" : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 rounded-xl border border-border bg-card p-5 text-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("detail.info")}
          </h3>
          {st.numero_bce && <Row label={t("form.bce")} value={formatBCE(st.numero_bce)} />}
          {st.numero_tva && <Row label={t("form.vat")} value={formatVATDisplay(st.numero_tva)} />}
          {st.iban && <Row label={t("form.iban")} value={st.iban} />}
          {(st.adresse || st.ville) && (
            <p className="flex gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {[st.adresse, [st.code_postal, st.ville].filter(Boolean).join(" ")]
                .filter(Boolean)
                .join(", ")}
            </p>
          )}
          {st.email && (
            <p className="flex gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              {st.email}
            </p>
          )}
          {st.telephone && (
            <p className="flex gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              {st.telephone}
            </p>
          )}
          {st.contact_nom && (
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs font-medium text-muted-foreground">
                {t("form.contactSection")}
              </p>
              <p className="font-medium">{st.contact_nom}</p>
              {st.contact_email && <p className="text-muted-foreground">{st.contact_email}</p>}
              {st.contact_telephone && (
                <p className="text-muted-foreground">{st.contact_telephone}</p>
              )}
            </div>
          )}
          {st.metiers.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {st.metiers.map((m) => (
                <span
                  key={m}
                  className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                >
                  {t(`statuts:metier.${m}`, { defaultValue: m })}
                </span>
              ))}
            </div>
          )}
          {st.conditions && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">{t("form.conditions")}</p>
              <TranslatableText text={st.conditions} />
            </div>
          )}
          {st.note_interne && (
            <TranslatableText
              text={st.note_interne}
              className="rounded-md bg-amber-50 p-3 text-amber-900"
            />
          )}
        </div>

        <div className="space-y-4 lg:col-span-2">
          {/* Vérification 30bis */}
          <div className="rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t("verification.title")}
              </h3>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ETAT_CONFORMITE_STYLES[etat]}`}
              >
                {t(`conformity.${etat}`)}
              </span>
            </div>
            <div className="space-y-3 p-5 text-sm">
              <p className="text-muted-foreground">{t(`verification.hint.${etat}`)}</p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={urlVerification30bis(st)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  <ExternalLink className="h-4 w-4" /> {t("verification.openOfficial")}
                </a>
                <button
                  onClick={() => setVerif(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                >
                  <ShieldCheck className="h-4 w-4" /> {t("verification.record")}
                </button>
              </div>
            </div>
            {data.verifications.length === 0 ? (
              <p className="border-t border-border p-5 text-sm text-muted-foreground">
                {t("verification.empty")}
              </p>
            ) : (
              data.verifications.map((v) => {
                const dette = v.dette_sociale || v.dette_fiscale;
                return (
                  <div
                    key={v.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3 text-sm"
                  >
                    <span className="font-medium">
                      {new Date(v.verifie_le).toLocaleString(intlLocale(), {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        dette ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {dette
                        ? [
                            v.dette_sociale && t("verification.socialDebt"),
                            v.dette_fiscale && t("verification.taxDebt"),
                          ]
                            .filter(Boolean)
                            .join(" + ")
                        : t("verification.noDebt")}
                    </span>
                    {v.notes && (
                      <span className="w-full text-xs text-muted-foreground">{v.notes}</span>
                    )}
                  </div>
                );
              })
            )}
            <p className="border-t border-border px-5 py-2 text-xs text-muted-foreground">
              {t("verification.immutable")}
            </p>
          </div>

          {/* Contrats */}
          <div className="rounded-xl border border-border bg-card">
            <h3 className="border-b border-border px-5 py-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("detail.contracts")}
            </h3>
            {data.contrats.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">{t("detail.noContracts")}</p>
            ) : (
              data.contrats.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3 text-sm first:border-t-0"
                >
                  <div>
                    <p className="font-medium">{c.descriptif_prestations}</p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        c.chantier_id && data.chantiers.get(c.chantier_id),
                        c.date_debut &&
                          `${formatDateBE(c.date_debut)}${c.date_fin ? ` → ${formatDateBE(c.date_fin)}` : ""}`,
                        t(`statuts:frequencePaiement.${c.frequence_paiement}`, {
                          defaultValue: c.frequence_paiement,
                        }),
                        t("detail.paymentDelay", { count: c.delai_paiement_jours }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <span className="font-semibold">
                    {c.type_prix === "forfait"
                      ? `${formatEURBE(c.montant_forfait_ht)} ${t("detail.exclVat")}`
                      : `${formatEURBE(c.prix_unitaire_ht)} / ${t(`statuts:unite.${c.unite ?? "piece"}`, { defaultValue: c.unite ?? "" })}`}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Paiements */}
          <div className="rounded-xl border border-border bg-card">
            <h3 className="border-b border-border px-5 py-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("detail.payments")}
            </h3>
            {data.paiements.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">{t("detail.noPayments")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-5 py-2 text-left font-semibold">{t("payments.date")}</th>
                      <th className="px-5 py-2 text-left font-semibold">
                        {t("payments.contract")}
                      </th>
                      <th className="px-5 py-2 text-right font-semibold">{t("payments.net")}</th>
                      <th className="px-5 py-2 text-right font-semibold">
                        {t("payments.withheld")}
                      </th>
                      <th className="px-5 py-2 text-right font-semibold">{t("payments.paid")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.paiements.map((p) => (
                      <tr key={p.id} className="border-t border-border">
                        <td className="px-5 py-2">{formatDateBE(p.date_paiement)}</td>
                        <td className="max-w-[220px] truncate px-5 py-2 text-muted-foreground">
                          {contratLabel.get(p.contrat_id) ?? "—"}
                        </td>
                        <td className="px-5 py-2 text-right">{formatEURBE(p.montant_ht)}</td>
                        <td
                          className={`px-5 py-2 text-right ${
                            Number(p.retenue_onss) + Number(p.retenue_spf) > 0 ? "text-red-600" : ""
                          }`}
                        >
                          {formatEURBE(Number(p.retenue_onss) + Number(p.retenue_spf))}
                        </td>
                        <td className="px-5 py-2 text-right font-semibold">
                          {formatEURBE(p.montant_verse)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {edit && (
        <SousTraitantFormModal
          sousTraitant={st}
          onClose={() => setEdit(false)}
          onSaved={() => {
            setEdit(false);
            refresh();
          }}
        />
      )}
      {verif && (
        <VerificationModal
          sousTraitant={st}
          onClose={() => setVerif(false)}
          onSaved={() => {
            setVerif(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

/** Enregistrement manuel, daté et immuable, du résultat consulté sur le service officiel. */
function VerificationModal({
  sousTraitant,
  onClose,
  onSaved,
}: {
  sousTraitant: SousTraitant;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation(["sousTraitants", "common"]);
  const { profile } = useAuth();
  const [detteSociale, setDetteSociale] = useState(false);
  const [detteFiscale, setDetteFiscale] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.company_id) return;
    if (!confirm(t("verification.confirm"))) return;
    setSaving(true);
    const { error } = await supabase.from("verifications_30bis").insert({
      company_id: profile.company_id,
      sous_traitant_id: sousTraitant.id,
      dette_sociale: detteSociale,
      dette_fiscale: detteFiscale,
      source_url: urlVerification30bis(sousTraitant),
      notes: notes.trim() || null,
      verifie_par: profile.id,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(t("toasts.verificationSaved"));
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
          <h3 className="text-lg font-semibold">{t("verification.record")}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("verification.modalHint", { name: sousTraitant.raison_sociale })}
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={detteSociale}
            onChange={(e) => setDetteSociale(e.target.checked)}
          />
          {t("verification.socialDebtFound")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={detteFiscale}
            onChange={(e) => setDetteFiscale(e.target.checked)}
          />
          {t("verification.taxDebtFound")}
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium">{t("verification.notes")}</span>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
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

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone ?? ""}`}>{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </p>
  );
}

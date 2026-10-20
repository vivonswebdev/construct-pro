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
  Plus,
  PenLine,
  Pencil,
  Paperclip,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SousTraitantFormModal } from "@/components/SousTraitantFormModal";
import { TranslatableText } from "@/components/TranslatableText";
import { ContratFormModal } from "@/components/sous-traitants/ContratFormModal";
import { ContratSignatureModal } from "@/components/sous-traitants/ContratSignatureModal";
import { SignaturesContrat } from "@/components/sous-traitants/SignaturesContrat";
import { PaiementsSection } from "@/components/sous-traitants/PaiementsSection";
import { PrestationsSection } from "@/components/sous-traitants/PrestationsSection";
import { VerificationModal } from "@/components/sous-traitants/VerificationModal";
import { ConformiteSection } from "@/components/sous-traitants/ConformiteSection";
import { useConformite } from "@/hooks/useConformite";
import { formatEURBE, formatVATDisplay } from "@/lib/belgian";
import { formatDateBE } from "@/lib/format";
import { pageHead } from "@/lib/head";
import { useAuth } from "@/lib/auth";
import { ouvrirDocument } from "@/lib/stockage";
import { errorMessage } from "@/lib/utils";
import { intlLocale } from "@/lib/i18n";
import {
  ETAT_CONFORMITE_STYLES,
  etatConformite,
  formatBCE,
  urlVerification30bis,
  type ContratSousTraitance,
} from "@/lib/sous-traitants";
import { useTranslation } from "react-i18next";
import { DocumentsRhSection } from "@/components/rh/DocumentsRhSection";

export const Route = createFileRoute("/_app/sous-traitants/$id")({
  head: () => pageHead("sousTraitant"),
  component: SousTraitantDetail,
});

function SousTraitantDetail() {
  const { t } = useTranslation(["sousTraitants", "common", "statuts", "contrats"]);
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [edit, setEdit] = useState(false);
  const [verif, setVerif] = useState(false);
  const [nouveauContrat, setNouveauContrat] = useState(false);
  const [aSigner, setASigner] = useState<ContratSousTraitance | null>(null);
  const [aModifier, setAModifier] = useState<ContratSousTraitance | null>(null);
  const [dossierEnCours, setDossierEnCours] = useState(false);
  const { company } = useAuth();

  const { data: conformite } = useConformite();
  const { data, isLoading } = useQuery({
    queryKey: ["sous_traitant", id],
    queryFn: async () => {
      const [st, vf, ct, dc, dg] = await Promise.all([
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
        supabase
          .from("documents_conformite")
          .select("*")
          .eq("sous_traitant_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("derogations_conformite")
          .select("*")
          .eq("sous_traitant_id", id)
          .order("accordee_le", { ascending: false }),
      ]);
      const contrats = ct.data ?? [];
      const contratIds = contrats.map((c) => c.id);
      const chantierIds = [...new Set(contrats.map((c) => c.chantier_id).filter(Boolean))];
      const [pm, ch, sg, ps] = await Promise.all([
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
              .select("id, name, address, client_name")
              .in("id", chantierIds as string[])
          : Promise.resolve({ data: [] }),
        contratIds.length
          ? supabase
              .from("contrat_signatures")
              .select("*")
              .in("contrat_id", contratIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] }),
        contratIds.length
          ? supabase
              .from("sous_traitant_prestations")
              .select("*")
              .in("contrat_id", contratIds)
              .order("date_prestation", { ascending: false })
          : Promise.resolve({ data: [] }),
      ]);
      return {
        st: st.data,
        verifications: vf.data ?? [],
        contrats,
        paiements: pm.data ?? [],
        chantiers: new Map((ch.data ?? []).map((c) => [c.id, c])),
        signatures: sg.data ?? [],
        prestations: ps.data ?? [],
        documents: dc.data ?? [],
        derogations: dg.data ?? [],
      };
    },
  });

  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  const st = data?.st;
  if (!data || !st) return <p className="text-sm text-muted-foreground">{t("notFound")}</p>;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["sous_traitant", id] });
    qc.invalidateQueries({ queryKey: ["sous_traitants"] });
    qc.invalidateQueries({ queryKey: ["conformite"] });
  };

  const derniere = data.verifications[0] ?? null;
  const etat = etatConformite(derniere);
  // Les paiements annulés restent affichés (piste d'audit) mais ne comptent plus.
  const valides = data.paiements.filter((p) => !p.annule_le);
  const totalVerse = valides.reduce((s, p) => s + Number(p.montant_verse ?? 0), 0);
  const totalRetenues = valides.reduce(
    (s, p) => s + Number(p.retenue_onss) + Number(p.retenue_spf),
    0,
  );
  const payeHt = (contratId: string) =>
    valides.filter((p) => p.contrat_id === contratId).reduce((s, p) => s + Number(p.montant_ht), 0);
  const estSigne = (contratId: string) =>
    data.signatures.some((sg) => sg.contrat_id === contratId && sg.statut === "signe");

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
            onClick={async () => {
              setDossierEnCours(true);
              try {
                const { dossierConformitePdf } = await import("@/lib/exports/dossier");
                await dossierConformitePdf(st.id, company?.name ?? "");
              } catch (err) {
                toast.error(errorMessage(err));
              } finally {
                setDossierEnCours(false);
              }
            }}
            disabled={dossierEnCours}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <FileText className="h-4 w-4" /> {dossierEnCours ? "…" : t("dossierButton")}
          </button>
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
          <ConformiteSection
            sousTraitant={st}
            ligne={conformite?.get(st.id)}
            documents={data.documents}
            derogations={data.derogations}
            onChange={refresh}
          />

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
                    {(v.montant_dette_onss != null || v.montant_dette_spf != null) && (
                      <span className="w-full text-xs text-muted-foreground">
                        {[
                          v.montant_dette_onss != null &&
                            t("verification.socialDebtShown", {
                              amount: formatEURBE(v.montant_dette_onss),
                            }),
                          v.montant_dette_spf != null &&
                            t("verification.taxDebtShown", {
                              amount: formatEURBE(v.montant_dette_spf),
                            }),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                    {v.notes && (
                      <span className="w-full text-xs text-muted-foreground">{v.notes}</span>
                    )}
                    {v.preuve_fichier && (
                      <button
                        onClick={() =>
                          ouvrirDocument(v.preuve_fichier!).catch((err) =>
                            toast.error(errorMessage(err)),
                          )
                        }
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <Paperclip className="h-3.5 w-3.5" /> {t("verification.capture.view")}
                      </button>
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
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t("detail.contracts")}
              </h3>
              <button
                onClick={() => setNouveauContrat(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
              >
                <Plus className="h-3.5 w-3.5" /> {t("contrats:new")}
              </button>
            </div>
            {data.contrats.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">{t("detail.noContracts")}</p>
            ) : (
              data.contrats.map((c) => (
                <div
                  key={c.id}
                  className="border-t border-border px-5 py-3 text-sm first:border-t-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{c.descriptif_prestations}</p>
                      <p className="text-xs text-muted-foreground">
                        {[
                          c.chantier_id && data.chantiers.get(c.chantier_id)?.name,
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
                  {c.type_prix === "forfait" && c.montant_forfait_ht != null && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("detail.paidOnContract", {
                        paid: formatEURBE(payeHt(c.id)),
                        remaining: formatEURBE(Number(c.montant_forfait_ht) - payeHt(c.id)),
                      })}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => setASigner(c)}
                      className="inline-flex items-center gap-1 rounded-lg border border-primary/40 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/5"
                    >
                      <PenLine className="h-3.5 w-3.5" /> {t("contrats:sendForSignature")}
                    </button>
                    {!estSigne(c.id) && (
                      <button
                        onClick={() => setAModifier(c)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
                      >
                        <Pencil className="h-3.5 w-3.5" /> {t("common:actions.edit")}
                      </button>
                    )}
                  </div>
                  <SignaturesContrat
                    signatures={data.signatures.filter((sg) => sg.contrat_id === c.id)}
                    onChange={refresh}
                  />
                </div>
              ))
            )}
          </div>

          <PrestationsSection
            contrats={data.contrats}
            prestations={data.prestations}
            onChange={refresh}
          />

          <PaiementsSection
            sousTraitant={st}
            contrats={data.contrats}
            verifications={data.verifications}
            paiements={data.paiements}
            onChange={refresh}
          />
          <DocumentsRhSection
            cible={{ sous_traitant_id: st.id }}
            types={["contrat_sous_traitance", "autre_contractuel"]}
          />
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
      {nouveauContrat && (
        <ContratFormModal
          sousTraitantId={st.id}
          onClose={() => setNouveauContrat(false)}
          onSaved={() => {
            setNouveauContrat(false);
            refresh();
          }}
        />
      )}
      {aModifier && (
        <ContratFormModal
          sousTraitantId={st.id}
          contrat={aModifier}
          onClose={() => setAModifier(null)}
          onSaved={() => {
            setAModifier(null);
            refresh();
          }}
        />
      )}
      {aSigner && (
        <ContratSignatureModal
          sousTraitant={st}
          contrat={aSigner}
          chantier={(aSigner.chantier_id && data.chantiers.get(aSigner.chantier_id)) || null}
          onClose={() => setASigner(null)}
          onCreated={refresh}
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

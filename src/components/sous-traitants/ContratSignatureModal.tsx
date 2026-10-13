import { useMemo, useState } from "react";
import { Check, Copy, Mail, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ContratApercu } from "@/components/contrats/ContratApercu";
import { SignaturePad } from "@/components/SignaturePad";
import { useAuth } from "@/lib/auth";
import { preremplirContrat } from "@/lib/contrats/donnees";
import { lienSignature } from "@/lib/contrats/signature";
import {
  MODELE_SOUS_TRAITANCE_V1,
  empreinteEnvoi,
  rendreContrat,
  type DonneesContrat,
} from "@/lib/contrats/sous-traitance";
import { backdropClose } from "@/lib/modal";
import type { ContratSousTraitance, SousTraitant } from "@/lib/sous-traitants";
import { useTranslation } from "react-i18next";

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

type Section = keyof Pick<DonneesContrat, "entreprise" | "sousTraitant" | "fiche">;

// Champs éditables, dans l'ordre du document. Les libellés viennent du namespace "contrats".
const CHAMPS: { section: Section; cles: string[]; longs?: string[] }[] = [
  {
    section: "entreprise",
    cles: ["denomination", "formeJuridique", "bceTva", "adresse", "pays"],
  },
  {
    section: "sousTraitant",
    cles: [
      "denomination",
      "formeJuridique",
      "bceTva",
      "siege",
      "representant",
      "qualite",
      "contact",
      "iban",
    ],
  },
  {
    section: "fiche",
    cles: [
      "reference",
      "maitreOuvrage",
      "adresseChantier",
      "natureTravaux",
      "documentsPlans",
      "dates",
      "prix",
      "tva",
      "etatsAvancement",
      "delaiPaiementJours",
      "penaliteJour",
      "penalitePlafond",
      "assurances",
      "securite",
      "dechets",
      "reception",
      "contacts",
    ],
    longs: ["natureTravaux", "assurances", "securite", "dechets", "reception"],
  },
];

/** Prépare le contrat, le fait signer par l'entrepreneur et crée le lien de signature. */
export function ContratSignatureModal({
  sousTraitant,
  contrat,
  chantier,
  onClose,
  onCreated,
}: {
  sousTraitant: SousTraitant;
  contrat: ContratSousTraitance;
  chantier: { name: string; address: string | null; client_name: string | null } | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation(["contrats", "common"]);
  const { profile, company } = useAuth();
  const [etape, setEtape] = useState<"donnees" | "signature" | "lien">("donnees");
  const [d, setD] = useState<DonneesContrat>(() =>
    preremplirContrat({
      societe: company ?? { name: "" },
      representant: profile?.full_name ?? "",
      st: sousTraitant,
      contrat,
      chantier,
    }),
  );
  const [jours, setJours] = useState("30");
  const [signature, setSignature] = useState<string | null>(null);
  const [relu, setRelu] = useState(false);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const blocs = useMemo(() => rendreContrat(d), [d]);

  const setChamp = (section: Section, cle: string, val: string) =>
    setD((prev) => ({ ...prev, [section]: { ...prev[section], [cle]: val } }));

  const creer = async () => {
    if (!profile?.company_id) return;
    const e = d.entreprise;
    if (!e.denomination.trim() || !e.representant.trim() || !e.qualite.trim())
      return toast.error(t("send.validation.signer"));
    if (!signature) return toast.error(t("send.validation.signature"));
    if (!relu) return toast.error(t("send.validation.reviewed"));
    const n = Number(jours);
    if (!Number.isInteger(n) || n < 1 || n > 90) return toast.error(t("send.validation.days"));
    setSaving(true);
    const { data, error } = await supabase
      .from("contrat_signatures")
      .insert({
        company_id: profile.company_id,
        contrat_id: contrat.id,
        modele: MODELE_SOUS_TRAITANCE_V1,
        langue: "fr",
        donnees: d,
        document_hash: await empreinteEnvoi(d),
        expire_le: new Date(Date.now() + n * 86_400_000).toISOString(),
        entreprise_signataire_nom: e.representant.trim(),
        entreprise_signataire_qualite: e.qualite.trim(),
        entreprise_signature: signature,
      })
      .select("token")
      .single();
    setSaving(false);
    if (error) return toast.error(error.message);
    setToken(data.token);
    setEtape("lien");
    onCreated();
  };

  const lien = token ? lienSignature(token) : "";
  const email = sousTraitant.contact_email || sousTraitant.email || "";
  const message = t("send.message", {
    company: d.entreprise.denomination,
    name: d.sousTraitant.representant || d.sousTraitant.denomination,
    link: lien,
    days: jours,
  });

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      {...backdropClose(onClose)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl bg-card shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold">{t("send.title")}</h3>
            <p className="text-xs text-muted-foreground">
              {t(`send.step.${etape}`)} · {contrat.descriptif_prestations}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {etape === "donnees" && (
            <div className="space-y-5">
              <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-900">
                {t("send.templateNotice")}
              </p>
              {CHAMPS.map(({ section, cles, longs }) => (
                <fieldset key={section} className="space-y-2">
                  <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t(`fields.${section}.title`)}
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {cles.map((cle) => {
                      const val = (d[section] as Record<string, string>)[cle] ?? "";
                      const long = longs?.includes(cle);
                      return (
                        <label key={cle} className={`block ${long ? "sm:col-span-2" : ""}`}>
                          <span className="mb-1 block text-xs font-medium">
                            {t(`fields.${section}.${cle}` as "fields.fiche.prix")}
                          </span>
                          {long ? (
                            <textarea
                              rows={2}
                              className={inputCls}
                              value={val}
                              onChange={(e) => setChamp(section, cle, e.target.value)}
                            />
                          ) : (
                            <input
                              className={inputCls}
                              value={val}
                              onChange={(e) => setChamp(section, cle, e.target.value)}
                            />
                          )}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
              <label className="block">
                <span className="mb-1 block text-xs font-medium">{t("fields.garanties")}</span>
                <textarea
                  rows={2}
                  className={inputCls}
                  value={d.garantiesContractuelles}
                  onChange={(e) => setD({ ...d, garantiesContractuelles: e.target.value })}
                />
              </label>
              <p className="text-xs text-muted-foreground">{t("send.emptyHint")}</p>
            </div>
          )}

          {etape === "signature" && (
            <div className="space-y-4">
              <div className="max-h-[38vh] overflow-y-auto rounded-lg border border-border bg-background p-4">
                <ContratApercu blocs={blocs} />
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium">
                    {t("fields.entreprise.representant")}
                  </span>
                  <input
                    className={inputCls}
                    value={d.entreprise.representant}
                    onChange={(e) => setChamp("entreprise", "representant", e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium">
                    {t("fields.entreprise.qualite")}
                  </span>
                  <input
                    className={inputCls}
                    value={d.entreprise.qualite}
                    placeholder={t("send.rolePlaceholder")}
                    onChange={(e) => setChamp("entreprise", "qualite", e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium">{t("send.validity")}</span>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    className={inputCls}
                    value={jours}
                    onChange={(e) => setJours(e.target.value)}
                  />
                </label>
              </div>
              <div>
                <span className="mb-1 block text-xs font-medium">{t("send.yourSignature")}</span>
                <SignaturePad onChange={setSignature} />
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={relu}
                  onChange={(e) => setRelu(e.target.checked)}
                />
                {t("send.reviewed")}
              </label>
            </div>
          )}

          {etape === "lien" && token && (
            <div className="space-y-4">
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                <Check className="h-4 w-4" /> {t("send.created")}
              </p>
              <div className="flex gap-2">
                <input readOnly value={lien} className={`${inputCls} font-mono text-xs`} />
                <button
                  type="button"
                  onClick={() =>
                    navigator.clipboard.writeText(lien).then(() => toast.success(t("send.copied")))
                  }
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 text-sm hover:bg-muted"
                >
                  <Copy className="h-4 w-4" /> {t("send.copy")}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(
                    t("send.subject", { company: d.entreprise.denomination }),
                  )}&body=${encodeURIComponent(message)}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                >
                  <Mail className="h-4 w-4" /> {t("send.byEmail")}
                </a>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  <MessageCircle className="h-4 w-4" /> {t("send.byWhatsapp")}
                </a>
              </div>
              <p className="text-xs text-muted-foreground">{t("send.linkHint")}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          {etape === "donnees" && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                {t("common:actions.cancel")}
              </button>
              <button
                type="button"
                onClick={() => setEtape("signature")}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
              >
                {t("send.next")}
              </button>
            </>
          )}
          {etape === "signature" && (
            <>
              <button
                type="button"
                onClick={() => setEtape("donnees")}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                {t("common:actions.back")}
              </button>
              <button
                type="button"
                onClick={creer}
                disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? "…" : t("send.signAndCreate")}
              </button>
            </>
          )}
          {etape === "lien" && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
            >
              {t("common:actions.close")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

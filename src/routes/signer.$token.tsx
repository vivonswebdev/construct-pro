import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CheckCircle2, FileDown, HardHat, PenLine } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ContratApercu } from "@/components/contrats/ContratApercu";
import { LanguageSelector } from "@/components/LanguageSelector";
import { SignaturePad } from "@/components/SignaturePad";
import {
  ModeleInconnuError,
  documentDemande,
  empreinteEnvoi,
  empreinteSignee,
  modeleConnu,
  modeleContrat,
} from "@/lib/contrats/modeles";
import { appliquerChamps, type ChampsSousTraitant } from "@/lib/contrats/sous-traitance";
import { donneesDe, telechargerContratPDF, type SignatureContrat } from "@/lib/contrats/signature";
import { pageHead } from "@/lib/head";
import { intlLocale } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/signer/$token")({
  head: () => {
    const h = pageHead("signer");
    return { meta: [...h.meta, { name: "robots", content: "noindex, nofollow" }] };
  },
  component: SignerPage,
});

const ERREURS = [
  "lien_invalide",
  "lien_annule",
  "lien_expire",
  "deja_signe",
  "document_modifie",
  "champs_requis",
  "signature_invalide",
  "modele_inconnu",
] as const;
const codeErreur = (err: unknown) => {
  const m = errorMessage(err, "");
  return ERREURS.find((c) => m.includes(c)) ?? null;
};

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function SignerPage() {
  const { t } = useTranslation(["contrats", "common"]);
  const { token } = Route.useParams();
  const [signe, setSigne] = useState<SignatureContrat | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["contrat_a_signer", token],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("contrat_a_signer", { _token: token });
      if (error) throw error;
      const sig = data as unknown as SignatureContrat;
      // Le contrat est rendu dans le modèle de l'envoi ; inconnu de cette version : on refuse.
      if (!modeleConnu(sig.modele)) throw new ModeleInconnuError(sig.modele);
      return sig;
    },
  });
  const sig = signe ?? data ?? null;

  return (
    <div className="min-h-screen bg-page-bg">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-white">
              <HardHat className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                {sig ? donneesDe(sig).entreprise.denomination : t("sign.title")}
              </p>
              <p className="text-xs text-muted-foreground">{t("sign.title")}</p>
            </div>
          </div>
          <LanguageSelector />
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        {isLoading ? (
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        ) : error || !sig ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="font-semibold">
              {t(`sign.errors.${codeErreur(error) ?? "lien_invalide"}`)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{t("sign.contactSender")}</p>
          </div>
        ) : sig.statut === "signe" ? (
          <Signe sig={sig} />
        ) : (
          <FormulaireSignature token={token} sig={sig} onSigne={setSigne} />
        )}
      </main>
    </div>
  );
}

function Signe({ sig }: { sig: SignatureContrat }) {
  const { t } = useTranslation("contrats");
  const { blocs, faitA } = documentDemande(sig);
  return (
    <>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="flex items-center gap-2 font-semibold text-emerald-800">
          <CheckCircle2 className="h-5 w-5" /> {t("sign.done")}
        </p>
        <p className="mt-1 text-sm text-emerald-900">
          {t("sign.doneDetail", {
            name: sig.signataire_nom,
            date: sig.signe_le ? new Date(sig.signe_le).toLocaleString(intlLocale()) : "",
          })}
        </p>
        <button
          onClick={() => telechargerContratPDF(sig)}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          <FileDown className="h-4 w-4" /> {t("sign.downloadPdf")}
        </button>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <ContratApercu blocs={blocs} />
        <p className="mt-4 text-sm">{faitA}</p>
      </div>
    </>
  );
}

function FormulaireSignature({
  token,
  sig,
  onSigne,
}: {
  token: string;
  sig: SignatureContrat;
  onSigne: (s: SignatureContrat) => void;
}) {
  const { t } = useTranslation(["contrats", "common"]);
  const d = donneesDe(sig);
  const [champs, setChamps] = useState<ChampsSousTraitant>({
    representant: d.sousTraitant.representant,
    qualite: d.sousTraitant.qualite,
    contact: d.sousTraitant.contact,
    iban: d.sousTraitant.iban,
  });
  const [lieu, setLieu] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [accepte, setAccepte] = useState(false);
  const [saving, setSaving] = useState(false);
  const modele = modeleContrat(sig.modele);
  const blocs = useMemo(() => modele.rendre(appliquerChamps(d, champs)), [modele, d, champs]);

  const signer = async () => {
    if (!champs.representant.trim() || !champs.qualite.trim() || !lieu.trim())
      return toast.error(t("sign.errors.champs_requis"));
    if (!signature) return toast.error(t("send.validation.signature"));
    if (!accepte) return toast.error(t("sign.mustAccept"));
    setSaving(true);
    try {
      const hashEnvoi = await empreinteEnvoi(sig.modele, d);
      if (hashEnvoi !== sig.document_hash) throw new Error("document_modifie");
      const { data, error } = await supabase.rpc("signer_contrat", {
        _token: token,
        _nom: champs.representant.trim(),
        _qualite: champs.qualite.trim(),
        _lieu: lieu.trim(),
        _champs: champs,
        _signature: signature,
        _document_hash: hashEnvoi,
        _signe_hash: await empreinteSignee(
          sig.modele,
          d,
          champs,
          lieu.trim(),
          new Date().toISOString(),
        ),
      });
      if (error) throw error;
      onSigne(data as unknown as SignatureContrat);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const code = codeErreur(err);
      toast.error(code ? t(`sign.errors.${code}`) : errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof ChampsSousTraitant, v: string) => setChamps({ ...champs, [k]: v });

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm">
          {t("sign.intro", {
            company: d.entreprise.denomination,
            date: new Date(sig.expire_le).toLocaleDateString(intlLocale()),
          })}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{t("sign.languageNotice")}</p>
      </div>

      <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-border bg-card p-5">
        <ContratApercu blocs={blocs} />
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <PenLine className="h-4 w-4" /> {t("sign.yourDetails")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Champ label={t("fields.sousTraitant.representant")}>
            <input
              className={inputCls}
              value={champs.representant}
              autoComplete="name"
              onChange={(e) => set("representant", e.target.value)}
            />
          </Champ>
          <Champ label={t("fields.sousTraitant.qualite")}>
            <input
              className={inputCls}
              value={champs.qualite}
              placeholder={t("send.rolePlaceholder")}
              onChange={(e) => set("qualite", e.target.value)}
            />
          </Champ>
          <Champ label={t("fields.sousTraitant.contact")}>
            <input
              className={inputCls}
              value={champs.contact}
              onChange={(e) => set("contact", e.target.value)}
            />
          </Champ>
          <Champ label={t("fields.sousTraitant.iban")}>
            <input
              className={inputCls}
              value={champs.iban}
              onChange={(e) => set("iban", e.target.value)}
            />
          </Champ>
          <Champ label={t("sign.place")}>
            <input
              className={inputCls}
              value={lieu}
              autoComplete="address-level2"
              onChange={(e) => setLieu(e.target.value)}
            />
          </Champ>
        </div>
        <div>
          <span className="mb-1 block text-xs font-medium">{t("sign.yourSignature")}</span>
          <SignaturePad onChange={setSignature} />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={accepte}
            onChange={(e) => setAccepte(e.target.checked)}
          />
          {t("sign.accept", { company: d.entreprise.denomination })}
        </label>
        <p className="text-xs text-muted-foreground">{t("sign.legal")}</p>
        <button
          onClick={signer}
          disabled={saving}
          className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "…" : t("sign.submit")}
        </button>
      </div>
    </>
  );
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}

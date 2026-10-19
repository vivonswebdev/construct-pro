import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { formatEURBE } from "@/lib/belgian";
import { formatDateBE } from "@/lib/format";
import { pageHead } from "@/lib/head";
import { aujourdhuiBruxelles } from "@/lib/sous-traitants";
import { chargerSourcesSousTraitance } from "@/lib/exports/donnees";
import {
  construireComptable,
  construireRegistre,
  totauxRegistre,
  type FiltresRegistre,
} from "@/lib/exports/registre";
import {
  comptableCsv,
  dateHeureBruxelles,
  registreCsv,
  registrePdf,
  type MetaExport,
} from "@/lib/exports/rendus";
import { errorMessage } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_app/sous-traitants/exports")({
  head: () => pageHead("exportsSousTraitants"),
  component: ExportsPage,
});

const inputCls =
  "rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary";

/** Premier et dernier jour du mois en cours (Bruxelles). */
function moisEnCours() {
  const j = aujourdhuiBruxelles();
  const [a, m] = j.split("-").map(Number);
  const fin = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  return { du: `${j.slice(0, 7)}-01`, au: fin };
}

function ExportsPage() {
  const { t } = useTranslation(["exports", "common"]);
  const [onglet, setOnglet] = useState<"registre" | "comptable">("registre");
  const [periode, setPeriode] = useState(moisEnCours);
  const periodeValide = !!periode.du && !!periode.au && periode.du <= periode.au;

  const { data, isLoading, error } = useQuery({
    queryKey: ["exports-sous-traitance", periode.du, periode.au],
    enabled: periodeValide,
    queryFn: () => chargerSourcesSousTraitance(periode),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/sous-traitants" className="rounded-lg p-2 hover:bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      <div className="flex w-fit gap-1 rounded-lg bg-muted p-1">
        {(["registre", "comptable"] as const).map((o) => (
          <button
            key={o}
            onClick={() => setOnglet(o)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium ${onglet === o ? "bg-card shadow-sm" : "text-muted-foreground"}`}
          >
            {t(`tabs.${o}`)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium">{t("from")}</span>
          <input
            type="date"
            className={inputCls}
            value={periode.du}
            onChange={(e) => setPeriode({ ...periode, du: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium">{t("to")}</span>
          <input
            type="date"
            className={inputCls}
            value={periode.au}
            onChange={(e) => setPeriode({ ...periode, au: e.target.value })}
          />
        </label>
        {!periodeValide && <p className="pb-2 text-sm text-red-600">{t("invalidPeriod")}</p>}
      </div>

      {error ? (
        <p className="text-sm text-red-600">{errorMessage(error)}</p>
      ) : isLoading || !data ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : onglet === "registre" ? (
        <Registre data={data} periode={periode} />
      ) : (
        <Comptable data={data} periode={periode} />
      )}
    </div>
  );
}

type Donnees = Awaited<ReturnType<typeof chargerSourcesSousTraitance>>;

function Registre({ data, periode }: { data: Donnees; periode: { du: string; au: string } }) {
  const { t } = useTranslation(["exports", "common"]);
  const { company } = useAuth();
  const [f, setF] = useState<Omit<FiltresRegistre, "du" | "au">>({
    sousTraitantId: "",
    chantierId: "",
    statut30bis: "tous",
    inclureAnnules: false,
  });
  const lignes = useMemo(() => construireRegistre(data, { ...periode, ...f }), [data, periode, f]);
  const tot = totauxRegistre(lignes);

  const meta = (): MetaExport => ({
    societe: company?.name ?? "",
    ...periode,
    filtres: [
      f.sousTraitantId &&
        `${t("subcontractor")} : ${data.sousTraitants.find((s) => s.id === f.sousTraitantId)?.raison_sociale}`,
      f.chantierId && `${t("site")} : ${data.chantiers.find((c) => c.id === f.chantierId)?.name}`,
      f.statut30bis &&
        f.statut30bis !== "tous" &&
        `${t("status30bis")} : ${t(`statusFilter.${f.statut30bis}`)}`,
      f.inclureAnnules && t("includeCancelled"),
    ].filter((x): x is string => !!x),
  });
  const lancer = (fn: () => void) => {
    try {
      fn();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Select
          label={t("subcontractor")}
          value={f.sousTraitantId ?? ""}
          onChange={(v) => setF({ ...f, sousTraitantId: v })}
          options={data.sousTraitants.map((s) => [s.id, s.raison_sociale])}
          tous={t("all")}
        />
        <Select
          label={t("site")}
          value={f.chantierId ?? ""}
          onChange={(v) => setF({ ...f, chantierId: v })}
          options={data.chantiers.map((c) => [c.id, c.name])}
          tous={t("all")}
        />
        <label className="block">
          <span className="mb-1 block text-xs font-medium">{t("status30bis")}</span>
          <select
            className={inputCls}
            value={f.statut30bis}
            onChange={(e) =>
              setF({ ...f, statut30bis: e.target.value as FiltresRegistre["statut30bis"] })
            }
          >
            {(["tous", "dette", "sans_dette"] as const).map((s) => (
              <option key={s} value={s}>
                {t(`statusFilter.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={!!f.inclureAnnules}
            onChange={(e) => setF({ ...f, inclureAnnules: e.target.checked })}
          />
          {t("includeCancelled")}
        </label>
        <div className="ml-auto flex gap-2">
          <button
            disabled={lignes.length === 0}
            onClick={() => lancer(() => registreCsv(lignes, meta()))}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" /> {t("exportCsv")}
          </button>
          <button
            disabled={lignes.length === 0}
            onClick={() => lancer(() => registrePdf(lignes, meta()))}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            <FileText className="h-4 w-4" /> {t("exportPdf")}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        <Total label={t("cols.exclVat")} value={formatEURBE(tot.ht)} />
        <Total label={t("cols.onss")} value={formatEURBE(tot.onss)} />
        <Total label={t("cols.spf")} value={formatEURBE(tot.spf)} />
        <Total label={t("cols.totalWithheld")} value={formatEURBE(tot.totalRetenu)} />
        <Total label={t("cols.paid")} value={formatEURBE(tot.verse)} />
      </div>

      {lignes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted uppercase text-muted-foreground">
              <tr>
                {(
                  [
                    "paymentDate",
                    "subcontractor",
                    "bce",
                    "invoice",
                    "exclVat",
                    "onss",
                    "spf",
                    "totalWithheld",
                    "paid",
                    "checkedAt",
                    "checkStatus",
                    "site",
                    "client",
                  ] as const
                ).map((c) => (
                  <th key={c} className="whitespace-nowrap px-3 py-2 text-left font-semibold">
                    {t(`cols.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr
                  key={l.paiementId}
                  className={`border-t border-border ${l.annule ? "italic text-muted-foreground line-through" : ""}`}
                >
                  <td className="whitespace-nowrap px-3 py-2">{formatDateBE(l.datePaiement)}</td>
                  <td className="px-3 py-2">{l.sousTraitant}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono">{l.bce ?? "—"}</td>
                  <td className="px-3 py-2">{l.facture ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">{formatEURBE(l.ht)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">{formatEURBE(l.onss)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">{formatEURBE(l.spf)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {formatEURBE(l.totalRetenu)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                    {formatEURBE(l.verse)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{dateHeureBruxelles(l.verifieLe)}</td>
                  <td className="px-3 py-2">{t(`checkStatus.${l.statutVerification}`)}</td>
                  <td className="px-3 py-2">{l.chantier ?? "—"}</td>
                  <td className="px-3 py-2">{l.client ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>
    </div>
  );
}

function Comptable({ data, periode }: { data: Donnees; periode: { du: string; au: string } }) {
  const { t } = useTranslation(["exports", "sousTraitants", "common"]);
  const { company } = useAuth();
  const [tous, setTous] = useState(false);
  const lignes = useMemo(() => construireComptable(data, periode, tous), [data, periode, tous]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={tous} onChange={(e) => setTous(e.target.checked)} />
          {t("includeAll")}
        </label>
        <button
          disabled={lignes.length === 0}
          onClick={() => {
            try {
              comptableCsv(lignes, { societe: company?.name ?? "", ...periode, filtres: [] });
            } catch (err) {
              toast.error(errorMessage(err));
            }
          }}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          <FileSpreadsheet className="h-4 w-4" /> {t("exportCsv")}
        </button>
      </div>
      {lignes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {t("emptyAccountant")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted uppercase text-muted-foreground">
              <tr>
                {(
                  [
                    "subcontractor",
                    "serviceEntries",
                    "hours",
                    "exclVat",
                    "totalWithheld",
                    "paid",
                    "payments",
                    "compliance",
                    "missingDocuments",
                  ] as const
                ).map((c) => (
                  <th key={c} className="whitespace-nowrap px-3 py-2 text-left font-semibold">
                    {t(`cols.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.sousTraitantId} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{l.sousTraitant}</td>
                  <td className="px-3 py-2 text-right">{l.prestations}</td>
                  <td className="px-3 py-2 text-right">{l.heures}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">{formatEURBE(l.ht)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {formatEURBE(l.totalRetenu)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">{formatEURBE(l.verse)}</td>
                  <td className="px-3 py-2 text-right">{l.paiements}</td>
                  <td className="px-3 py-2">{l.synthese ? t(`summary.${l.synthese}`) : "—"}</td>
                  <td className="px-3 py-2">
                    {l.manquants
                      .map((e) => t(`sousTraitants:compliance.requirement.${e}`))
                      .join(", ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  tous,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  tous: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium">{label}</span>
      <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{tous}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-bold">{value}</p>
    </div>
  );
}

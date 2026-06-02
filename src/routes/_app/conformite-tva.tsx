import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ShieldCheck, CheckCircle2, AlertTriangle, Search, RefreshCw, Loader2, ExternalLink, FileDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cleanVAT, formatVATDisplay, isValidVAT, formatEURBE } from "@/lib/belgian";
import { formatDateBE } from "@/lib/format";
import { checkTva } from "@/lib/tva.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/conformite-tva")({
  component: ConformiteTvaPage,
});

type LastCheckResult = {
  client_name: string;
  vat: string;
  eligible: boolean | null;
  message: string;
  source_url?: string;
  date: string;
};

function ConformiteTvaPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const runCheckTva = useServerFn(checkTva);

  const [clientName, setClientName] = useState("");
  const [vatInput, setVatInput] = useState("BE");
  const [checking, setChecking] = useState(false);
  const [lastResult, setLastResult] = useState<LastCheckResult | null>(null);
  const [invoiceAmount, setInvoiceAmount] = useState<string>("");
  const [filter, setFilter] = useState("");

  const { data: history = [] } = useQuery({
    queryKey: ["tva-checks", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("tva_checks")
        .select("*")
        .order("check_date", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  // Latest check per VAT
  const latestByVat = useMemo(() => {
    const map = new Map<string, any>();
    for (const row of history) {
      if (!map.has(row.client_vat_number)) map.set(row.client_vat_number, row);
    }
    return Array.from(map.values());
  }, [history]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return latestByVat;
    return latestByVat.filter(
      (r) =>
        r.client_name.toLowerCase().includes(q) ||
        r.client_vat_number.toLowerCase().includes(q),
    );
  }, [latestByVat, filter]);

  const handleVatChange = (val: string) => {
    let v = val.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!v.startsWith("BE")) v = "BE" + v.replace(/^BE/, "");
    if (v.length > 12) v = v.slice(0, 12);
    setVatInput(v);
  };

  const runCheck = async (overrideName?: string, overrideVat?: string) => {
    const name = (overrideName ?? clientName).trim();
    const vatRaw = overrideVat ?? vatInput;
    if (!name) { toast.error("Indiquez le nom du client"); return; }
    if (!isValidVAT(vatRaw)) { toast.error("Numéro de TVA invalide (BE + 10 chiffres)"); return; }

    const vat = cleanVAT(vatRaw);
    setChecking(true);
    try {
      const res = await runCheckTva({ data: { vat_number: vat } });
      if (!res.ok) {
        toast.error(res.error);
        setLastResult({
          client_name: name, vat, eligible: null,
          message: res.error + " — vous pouvez consulter le site officiel et logger manuellement.",
          source_url: `https://www.checkobligationderetenue.be/result/?vat=${vat}`,
          date: new Date().toISOString(),
        });
      } else {
        setLastResult({
          client_name: name, vat,
          eligible: res.eligible,
          message: res.message,
          source_url: res.source_url,
          date: new Date().toISOString(),
        });
        // Save automatically if we have a definitive result
        if (res.eligible !== null) {
          await saveResult(name, vat, res.eligible, res.message);
        }
      }
    } finally {
      setChecking(false);
    }
  };

  const saveResult = async (name: string, vat: string, eligible: boolean, message: string) => {
    if (!profile?.company_id) return;
    const { error } = await supabase.from("tva_checks").insert({
      company_id: profile.company_id,
      client_name: name,
      client_vat_number: vat,
      is_eligible: eligible,
      raw_response: { message },
      checked_by: profile.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Vérification enregistrée");
      qc.invalidateQueries({ queryKey: ["tva-checks"] });
    }
  };

  const logManual = async (eligible: boolean) => {
    if (!lastResult) return;
    await saveResult(lastResult.client_name, lastResult.vat, eligible,
      eligible ? "Saisie manuelle — Conforme" : "Saisie manuelle — Retenue obligatoire");
    setLastResult({ ...lastResult, eligible, message: eligible ? "Saisie manuelle — Conforme" : "Saisie manuelle — Retenue obligatoire" });
  };

  const exportCSV = () => {
    const rows = [
      ["Statut", "Client", "N° TVA", "Vérifié le"],
      ...latestByVat.map((r) => [
        r.is_eligible ? "Conforme" : r.is_eligible === false ? "Retenue" : "Inconnu",
        r.client_name,
        r.client_vat_number,
        formatDateBE(r.check_date),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `verifications-tva-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const amount = parseFloat(invoiceAmount.replace(",", ".")) || 0;
  const retenue = amount * 0.15;
  const net = amount - retenue;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conformité TVA & Retenue</h1>
          <p className="text-sm text-muted-foreground">
            Vérifiez l'éligibilité de vos clients et sous-traitants (Art. 402 CIR)
          </p>
        </div>
      </div>

      {/* Check form */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold">Vérifier un numéro de TVA</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Nom du client</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Ex: Immobilière Dumont SA"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">N° TVA</label>
            <input
              type="text"
              value={vatInput}
              onChange={(e) => handleVatChange(e.target.value)}
              placeholder="BE0123456789"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">Format: BE + 10 chiffres</p>
          </div>
        </div>
        <button
          onClick={() => runCheck()}
          disabled={checking}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
        >
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {checking ? "Vérification en cours..." : "Vérifier maintenant"}
        </button>
        <p className="mt-3 text-[11px] text-muted-foreground">
          ⓘ Données issues de checkobligationderetenue.be — Résultat SPF Finances (Art. 402 CIR92)
        </p>
      </div>

      {/* Result */}
      {lastResult && (
        <div
          className={`rounded-xl border border-border bg-card p-6 shadow-sm border-l-4 ${
            lastResult.eligible === true
              ? "border-l-emerald-500 bg-emerald-50/40"
              : lastResult.eligible === false
              ? "border-l-red-500 bg-red-50/40"
              : "border-l-amber-500 bg-amber-50/40"
          }`}
        >
          <div className="flex items-start gap-3">
            {lastResult.eligible === true ? (
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
            ) : lastResult.eligible === false ? (
              <AlertTriangle className="h-6 w-6 shrink-0 text-red-600" />
            ) : (
              <AlertTriangle className="h-6 w-6 shrink-0 text-amber-600" />
            )}
            <div className="min-w-0 flex-1">
              <h3 className={`text-base font-bold ${
                lastResult.eligible === true ? "text-emerald-700" :
                lastResult.eligible === false ? "text-red-700" : "text-amber-700"
              }`}>
                {lastResult.eligible === true
                  ? "✓ Aucune retenue obligatoire"
                  : lastResult.eligible === false
                  ? "⚠ Retenue obligatoire !"
                  : "Résultat à confirmer manuellement"}
              </h3>
              <p className="mt-1 text-sm font-medium">
                {lastResult.client_name} · <span className="font-mono">{formatVATDisplay(lastResult.vat)}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Vérifié le {formatDateBE(lastResult.date)} à {new Date(lastResult.date).toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="mt-2 text-sm">{lastResult.message}</p>

              {lastResult.eligible === null && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {lastResult.source_url && (
                    <a
                      href={lastResult.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                    >
                      <ExternalLink className="h-3 w-3" /> Voir sur le site officiel
                    </a>
                  )}
                  <span className="text-xs text-muted-foreground">Saisie manuelle :</span>
                  <button
                    onClick={() => logManual(true)}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                  >✓ Conforme</button>
                  <button
                    onClick={() => logManual(false)}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                  >⚠ Retenue</button>
                </div>
              )}
            </div>
          </div>

          {/* Withholding calculator when ROUGE */}
          {lastResult.eligible === false && (
            <div className="mt-5 rounded-lg border border-red-200 bg-white p-4">
              <h4 className="mb-3 text-sm font-semibold">Calcul de la retenue</h4>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Montant de la facture</label>
                  <input
                    type="text"
                    value={invoiceAmount}
                    onChange={(e) => setInvoiceAmount(e.target.value)}
                    placeholder="10000,00"
                    className="w-40 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="ml-1 text-sm">€</span>
                </div>
              </div>
              {amount > 0 && (
                <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                  <div className="rounded-md bg-red-50 p-3">
                    <p className="text-[11px] font-semibold uppercase text-red-700">Retenue 15%</p>
                    <p className="mt-0.5 text-base font-bold text-red-700">{formatEURBE(retenue)}</p>
                    <p className="text-[11px] text-muted-foreground">À verser au SPF</p>
                  </div>
                  <div className="rounded-md bg-amber-50 p-3">
                    <p className="text-[11px] font-semibold uppercase text-amber-700">Net au client</p>
                    <p className="mt-0.5 text-base font-bold text-amber-700">{formatEURBE(net)}</p>
                    <p className="text-[11px] text-muted-foreground">Solde à verser</p>
                  </div>
                  <div className="rounded-md bg-emerald-50 p-3">
                    <p className="text-[11px] font-semibold uppercase text-emerald-700">Montant brut</p>
                    <p className="mt-0.5 text-base font-bold text-emerald-700">{formatEURBE(amount)}</p>
                    <p className="text-[11px] text-muted-foreground">Total facturé</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* History */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Historique des vérifications</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Rechercher client ou N° TVA"
                className="w-64 rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted"
            >
              <FileDown className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            {filter
              ? <>Aucun résultat — <button onClick={() => { setClientName(filter); setVatInput(isValidVAT(filter) ? cleanVAT(filter) : "BE"); }} className="font-semibold text-primary hover:underline">Lancer une vérification ?</button></>
              : "Aucune vérification enregistrée. Utilisez le formulaire ci-dessus."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-3">Statut</th>
                  <th className="py-2 pr-3">Client</th>
                  <th className="py-2 pr-3">N° TVA</th>
                  <th className="py-2 pr-3">Vérifié le</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className={`border-b border-border/50 ${
                      r.is_eligible === true ? "bg-emerald-50/40"
                      : r.is_eligible === false ? "bg-red-50/40" : ""
                    }`}
                  >
                    <td className="py-3 pr-3">
                      {r.is_eligible === true ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          ✓ Conforme
                        </span>
                      ) : r.is_eligible === false ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                          ⚠ Retenue
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                          Inconnu
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-3 font-medium">{r.client_name}</td>
                    <td className="py-3 pr-3 font-mono text-xs">{formatVATDisplay(r.client_vat_number)}</td>
                    <td className="py-3 pr-3 text-xs text-muted-foreground">{formatDateBE(r.check_date)}</td>
                    <td className="py-3 pr-3">
                      <button
                        onClick={() => runCheck(r.client_name, r.client_vat_number)}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold hover:bg-muted"
                      >
                        <RefreshCw className="h-3 w-3" /> Re-vérifier
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

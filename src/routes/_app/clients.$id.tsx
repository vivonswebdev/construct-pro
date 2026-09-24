import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Edit2, Trash2, Mail, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ClientFormModal } from "@/components/ClientFormModal";
import { clientLabel, clientAddress, type Client } from "@/lib/clients";
import { formatVATDisplay } from "@/lib/belgian";
import { formatEUR, formatDateBE } from "@/lib/format";
import { StatusBadge } from "./facturation.index";

export const Route = createFileRoute("/_app/clients/$id")({
  head: () => ({
    meta: [
      { title: "Fiche client — ConstructFlow" },
      { name: "description", content: "Informations client, chantiers et devis liés." },
      { property: "og:title", content: "Fiche client — ConstructFlow" },
      { property: "og:description", content: "Informations client, chantiers et devis liés." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClientDetail,
});

function ClientDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [edit, setEdit] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const [c, ch, dv] = await Promise.all([
        supabase.from("clients").select("*").eq("id", id).single(),
        supabase.from("chantiers").select("id, name, status, progress, budget").eq("client_id", id),
        supabase
          .from("factures")
          .select("id, number, status, issue_date, total_ttc, subtotal_ht")
          .eq("client_id", id)
          .eq("type", "devis")
          .order("issue_date", { ascending: false }),
      ]);
      return { client: c.data as Client | null, chantiers: ch.data ?? [], devis: dv.data ?? [] };
    },
  });

  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  const c = data?.client;
  if (!c) return <p className="text-sm text-muted-foreground">Client introuvable.</p>;

  const totalDevise = data.devis.reduce((s, d) => s + Number(d.subtotal_ht), 0);
  const totalAccepte = data.devis
    .filter((d) => d.status === "Accepté")
    .reduce((s, d) => s + Number(d.subtotal_ht), 0);

  const remove = async () => {
    if (!confirm("Supprimer ce client ? Les chantiers et devis liés seront conservés.")) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["clients"] });
    navigate({ to: "/clients" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/clients" className="rounded-lg p-2 hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{clientLabel(c)}</h1>
            <p className="text-sm text-muted-foreground">
              {c.type === "entreprise" ? "Entreprise" : "Particulier"} · {c.langue}
              {c.assujetti_tva && " · Assujetti TVA"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEdit(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <Edit2 className="h-4 w-4" /> Modifier
          </button>
          <button
            onClick={remove}
            className="rounded-lg border border-red-200 px-3 py-2 text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Total devisé (HT)" value={formatEUR(totalDevise)} />
        <Kpi label="Total accepté (HT)" value={formatEUR(totalAccepte)} tone="text-emerald-600" />
        <Kpi label="Chantiers" value={String(data.chantiers.length)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 rounded-xl border border-border bg-card p-5 text-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Informations
          </h3>
          {c.numero_tva && <Row label="N° TVA" value={formatVATDisplay(c.numero_tva)} />}
          {c.numero_bce && <Row label="N° BCE" value={c.numero_bce} />}
          {clientAddress(c) && (
            <p className="flex gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {clientAddress(c)}
            </p>
          )}
          {c.email && (
            <p className="flex gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              {c.email}
            </p>
          )}
          {c.telephone && (
            <p className="flex gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              {c.telephone}
            </p>
          )}
          {c.notes && <p className="rounded-md bg-muted p-3 text-muted-foreground">{c.notes}</p>}
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-border bg-card">
            <h3 className="border-b border-border px-5 py-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Chantiers liés
            </h3>
            {data.chantiers.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">Aucun chantier.</p>
            ) : (
              data.chantiers.map((ch) => (
                <Link
                  key={ch.id}
                  to="/chantiers/$id"
                  params={{ id: ch.id }}
                  className="flex items-center justify-between border-t border-border px-5 py-3 text-sm first:border-t-0 hover:bg-muted/50"
                >
                  <span className="font-medium">{ch.name}</span>
                  <span className="text-muted-foreground">
                    {ch.status} · {ch.progress}% · {formatEUR(ch.budget)}
                  </span>
                </Link>
              ))
            )}
          </div>
          <div className="rounded-xl border border-border bg-card">
            <h3 className="border-b border-border px-5 py-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Devis liés
            </h3>
            {data.devis.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">Aucun devis.</p>
            ) : (
              data.devis.map((d) => (
                <Link
                  key={d.id}
                  to="/facturation/$id"
                  params={{ id: d.id }}
                  className="flex items-center justify-between border-t border-border px-5 py-3 text-sm first:border-t-0 hover:bg-muted/50"
                >
                  <span className="font-mono font-semibold">{d.number}</span>
                  <span className="text-muted-foreground">{formatDateBE(d.issue_date)}</span>
                  <span className="font-semibold">{formatEUR(d.total_ttc)}</span>
                  <StatusBadge status={d.status} />
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {edit && (
        <ClientFormModal
          client={c}
          onClose={() => setEdit(false)}
          onSaved={() => {
            setEdit(false);
            qc.invalidateQueries({ queryKey: ["client", id] });
            qc.invalidateQueries({ queryKey: ["clients"] });
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
    <p className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </p>
  );
}

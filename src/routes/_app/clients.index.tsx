import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Search, Contact, Building2, User } from "lucide-react";
import { useClients } from "@/components/ClientSelect";
import { ClientFormModal } from "@/components/ClientFormModal";
import { clientLabel } from "@/lib/clients";
import { formatVATDisplay } from "@/lib/belgian";

export const Route = createFileRoute("/_app/clients/")({
  head: () => ({
    meta: [
      { title: "Clients — ConstructFlow" },
      {
        name: "description",
        content:
          "Gérez vos clients particuliers et entreprises, leurs numéros de TVA et leurs chantiers.",
      },
      { property: "og:title", content: "Clients — ConstructFlow" },
      {
        property: "og:description",
        content: "Carnet clients pour entreprises de construction belges.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClientsPage,
});

function ClientsPage() {
  const { data: clients, isLoading } = useClients();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(
    () =>
      (clients ?? []).filter((c) => {
        if (type && c.type !== type) return false;
        if (search) {
          const s =
            `${clientLabel(c)} ${c.ville ?? ""} ${c.email ?? ""} ${c.numero_tva ?? ""}`.toLowerCase();
          if (!s.includes(search.toLowerCase())) return false;
        }
        return true;
      }),
    [clients, search, type],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">
            {clients?.length ?? 0} client(s) — particuliers et entreprises
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Nouveau client
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un client, une ville, un n° TVA…"
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="">Tous les types</option>
          <option value="particulier">Particuliers</option>
          <option value="entreprise">Entreprises</option>
        </select>
      </div>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <Contact className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Aucun client trouvé.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Client</th>
                <th className="px-4 py-3 text-left font-semibold">Type</th>
                <th className="px-4 py-3 text-left font-semibold">N° TVA</th>
                <th className="px-4 py-3 text-left font-semibold">Ville</th>
                <th className="px-4 py-3 text-left font-semibold">Contact</th>
                <th className="px-4 py-3 text-left font-semibold">Langue</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => navigate({ to: "/clients/$id", params: { id: c.id } })}
                  className="cursor-pointer border-t border-border hover:bg-muted/50"
                >
                  <td className="px-4 py-3 font-semibold">{clientLabel(c)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      {c.type === "entreprise" ? (
                        <Building2 className="h-3.5 w-3.5" />
                      ) : (
                        <User className="h-3.5 w-3.5" />
                      )}
                      {c.type === "entreprise" ? "Entreprise" : "Particulier"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {c.numero_tva ? formatVATDisplay(c.numero_tva) : "—"}
                    {c.assujetti_tva && (
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 font-sans text-[10px] font-semibold text-emerald-700">
                        Assujetti
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {[c.code_postal, c.ville].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.email || c.telephone || "—"}
                  </td>
                  <td className="px-4 py-3">{c.langue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <ClientFormModal
          onClose={() => setOpen(false)}
          onSaved={(c) => {
            qc.invalidateQueries({ queryKey: ["clients"] });
            setOpen(false);
            navigate({ to: "/clients/$id", params: { id: c.id } });
          }}
        />
      )}
    </div>
  );
}

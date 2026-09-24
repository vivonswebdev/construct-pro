import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { clientLabel, type Client } from "@/lib/clients";
import { ClientFormModal } from "./ClientFormModal";

export function useClients() {
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  return useQuery({
    queryKey: ["clients", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      return (data ?? []) as Client[];
    },
  });
}

export function ClientSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (id: string, client: Client | null) => void;
  className?: string;
}) {
  const { data: clients } = useClients();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex gap-2">
      <select
        className={
          className ??
          "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        }
        value={value}
        onChange={(e) =>
          onChange(e.target.value, clients?.find((c) => c.id === e.target.value) ?? null)
        }
      >
        <option value="">— Sélectionner un client —</option>
        {(clients ?? []).map((c) => (
          <option key={c.id} value={c.id}>
            {clientLabel(c)}
            {c.type === "entreprise" ? " (entreprise)" : ""}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2.5 text-xs font-semibold text-primary hover:bg-muted"
      >
        <Plus className="h-3.5 w-3.5" /> Nouveau client
      </button>
      {open && (
        <ClientFormModal
          onClose={() => setOpen(false)}
          onSaved={(c) => {
            qc.invalidateQueries({ queryKey: ["clients"] });
            setOpen(false);
            onChange(c.id, c);
          }}
        />
      )}
    </div>
  );
}

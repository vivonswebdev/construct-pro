import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cleanVAT, isValidVAT } from "@/lib/belgian";
import type { Client } from "@/lib/clients";

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

export function ClientFormModal({
  client,
  onClose,
  onSaved,
}: {
  client?: Client;
  onClose: () => void;
  onSaved: (c: Client) => void;
}) {
  const { profile } = useAuth();
  const [f, setF] = useState({
    type: client?.type ?? "particulier",
    nom: client?.nom ?? "",
    prenom: client?.prenom ?? "",
    raison_sociale: client?.raison_sociale ?? "",
    numero_bce: client?.numero_bce ?? "",
    numero_tva: client?.numero_tva ?? "",
    assujetti_tva: client?.assujetti_tva ?? false,
    adresse: client?.adresse ?? "",
    code_postal: client?.code_postal ?? "",
    ville: client?.ville ?? "",
    email: client?.email ?? "",
    telephone: client?.telephone ?? "",
    langue: client?.langue ?? "FR",
    notes: client?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  const isEnt = f.type === "entreprise";
  const vatInvalid = !!f.numero_tva && !isValidVAT(f.numero_tva);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.company_id) return;
    if (isEnt && !f.raison_sociale.trim()) return toast.error("La raison sociale est requise");
    if (!isEnt && !f.nom.trim()) return toast.error("Le nom est requis");
    if (vatInvalid) return toast.error("Numéro de TVA belge invalide (format BE0123456789)");
    if (f.assujetti_tva && !f.numero_tva)
      return toast.error("Un client assujetti doit avoir un numéro de TVA");
    setSaving(true);
    const payload = {
      ...f,
      numero_tva: f.numero_tva ? cleanVAT(f.numero_tva) : null,
      company_id: profile.company_id,
    };
    const q = client
      ? supabase.from("clients").update(payload).eq("id", client.id).select().single()
      : supabase.from("clients").insert(payload).select().single();
    const { data, error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(client ? "Client mis à jour" : "Client créé");
    onSaved(data as Client);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {client ? "Modifier le client" : "Nouveau client"}
          </h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-4 flex w-fit gap-1 rounded-lg bg-muted p-1">
          {(["particulier", "entreprise"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set({ type: t })}
              className={`rounded-md px-4 py-1.5 text-sm font-medium ${f.type === t ? "bg-card shadow-sm" : "text-muted-foreground"}`}
            >
              {t === "particulier" ? "Particulier" : "Entreprise"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {isEnt ? (
            <>
              <L label="Raison sociale *" full>
                <input
                  className={inputCls}
                  value={f.raison_sociale}
                  onChange={(e) => set({ raison_sociale: e.target.value })}
                  placeholder="Ex: Dumont Immo SRL"
                />
              </L>
              <L label="N° BCE">
                <input
                  className={inputCls}
                  value={f.numero_bce}
                  onChange={(e) => set({ numero_bce: e.target.value })}
                  placeholder="0123.456.789"
                />
              </L>
              <L label="Contact (nom)">
                <input
                  className={inputCls}
                  value={f.nom}
                  onChange={(e) => set({ nom: e.target.value })}
                />
              </L>
            </>
          ) : (
            <>
              <L label="Prénom">
                <input
                  className={inputCls}
                  value={f.prenom}
                  onChange={(e) => set({ prenom: e.target.value })}
                />
              </L>
              <L label="Nom *">
                <input
                  className={inputCls}
                  value={f.nom}
                  onChange={(e) => set({ nom: e.target.value })}
                />
              </L>
            </>
          )}
          <L label="N° TVA">
            <input
              className={`${inputCls} ${vatInvalid ? "border-red-500" : ""}`}
              value={f.numero_tva}
              onChange={(e) => set({ numero_tva: e.target.value })}
              placeholder="BE0123456789"
            />
            {vatInvalid && <span className="mt-1 block text-xs text-red-600">Format invalide</span>}
          </L>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={f.assujetti_tva}
              onChange={(e) => set({ assujetti_tva: e.target.checked })}
            />
            Assujetti à la TVA
          </label>
          <L label="Adresse" full>
            <input
              className={inputCls}
              value={f.adresse}
              onChange={(e) => set({ adresse: e.target.value })}
            />
          </L>
          <L label="Code postal">
            <input
              className={inputCls}
              value={f.code_postal}
              onChange={(e) => set({ code_postal: e.target.value })}
            />
          </L>
          <L label="Ville">
            <input
              className={inputCls}
              value={f.ville}
              onChange={(e) => set({ ville: e.target.value })}
            />
          </L>
          <L label="Email">
            <input
              type="email"
              className={inputCls}
              value={f.email}
              onChange={(e) => set({ email: e.target.value })}
            />
          </L>
          <L label="Téléphone">
            <input
              className={inputCls}
              value={f.telephone}
              onChange={(e) => set({ telephone: e.target.value })}
            />
          </L>
          <L label="Langue">
            <select
              className={inputCls}
              value={f.langue}
              onChange={(e) => set({ langue: e.target.value as "FR" | "NL" })}
            >
              <option value="FR">Français</option>
              <option value="NL">Nederlands</option>
            </select>
          </L>
          <L label="Notes" full>
            <textarea
              rows={2}
              className={inputCls}
              value={f.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </L>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Annuler
          </button>
          <button
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}

function L({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? "col-span-2" : ""}`}>
      <span className="mb-1 block text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}

export type Client = {
  id: string;
  company_id: string;
  type: "particulier" | "entreprise";
  nom: string | null;
  prenom: string | null;
  raison_sociale: string | null;
  numero_bce: string | null;
  numero_tva: string | null;
  assujetti_tva: boolean;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  email: string | null;
  telephone: string | null;
  langue: "FR" | "NL";
  notes: string | null;
  created_at: string;
};

export function clientLabel(c: Partial<Client> | null | undefined): string {
  if (!c) return "";
  if (c.type === "entreprise") return c.raison_sociale || c.nom || "";
  return [c.prenom, c.nom].filter(Boolean).join(" ") || c.raison_sociale || "";
}

export function clientAddress(c: Partial<Client> | null | undefined): string {
  if (!c) return "";
  const cityLine = [c.code_postal, c.ville].filter(Boolean).join(" ");
  return [c.adresse, cityLine].filter(Boolean).join(", ");
}

import i18n from "@/lib/i18n";
import { formatEURBE, formatVATDisplay } from "@/lib/belgian";
import { formatDateBE } from "@/lib/format";
import { mentionAutoliquidation } from "@/lib/invoice-pdf";
import { formatBCE, type ContratSousTraitance, type SousTraitant } from "@/lib/sous-traitants";
import type { DonneesContrat } from "./sous-traitance";

type Societe = { name: string; bce_number?: string | null; address?: string | null };
type Chantier = { name: string; address: string | null; client_name: string | null } | null;

/**
 * Pré-remplit le contrat (en français, langue du modèle v1) à partir des données de
 * l'application. Tout reste modifiable avant l'envoi.
 */
export function preremplirContrat(o: {
  societe: Societe;
  representant: string;
  st: SousTraitant;
  contrat: ContratSousTraitance;
  chantier: Chantier;
}): DonneesContrat {
  const fr = i18n.getFixedT("fr", "statuts");
  const { st, contrat: c, chantier } = o;
  const prix =
    c.type_prix === "forfait"
      ? `${formatEURBE(c.montant_forfait_ht)} HTVA — forfait`
      : `${formatEURBE(c.prix_unitaire_ht)} HTVA / ${fr(`unite.${c.unite ?? "piece"}`, {
          defaultValue: c.unite ?? "",
        })} — ${c.type_prix === "horaire" ? "régie" : "métrés"}`;
  const dates = [
    c.date_debut && `Début : ${formatDateBE(c.date_debut)}`,
    c.date_fin && `Fin : ${formatDateBE(c.date_fin)}`,
  ]
    .filter(Boolean)
    .join(" — ");

  return {
    entreprise: {
      denomination: o.societe.name,
      formeJuridique: "",
      bceTva: o.societe.bce_number ? formatBCE(o.societe.bce_number) : "",
      adresse: o.societe.address ?? "",
      pays: "Belgique",
      representant: o.representant,
      qualite: "",
    },
    sousTraitant: {
      denomination: st.raison_sociale,
      formeJuridique: st.forme_juridique
        ? fr(`formeJuridique.${st.forme_juridique}`, { defaultValue: st.forme_juridique })
        : "",
      bceTva: st.numero_tva
        ? formatVATDisplay(st.numero_tva)
        : st.numero_bce
          ? formatBCE(st.numero_bce)
          : "",
      siege: [st.adresse, [st.code_postal, st.ville].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", "),
      representant: st.contact_nom ?? "",
      qualite: "",
      contact: [st.contact_telephone || st.telephone, st.contact_email || st.email]
        .filter(Boolean)
        .join(" / "),
      iban: st.iban ?? "",
    },
    fiche: {
      reference: c.bon_commande_ref || `ST-${c.id.slice(0, 8).toUpperCase()}`,
      maitreOuvrage: chantier?.client_name ?? "",
      adresseChantier: chantier?.address ?? "",
      natureTravaux: c.descriptif_prestations,
      documentsPlans: c.devis_ref ? `Devis ${c.devis_ref}` : "",
      dates,
      prix,
      tva: `Autoliquidation si les conditions sont remplies — mention : « ${mentionAutoliquidation("fr")} »`,
      etatsAvancement: fr(`frequencePaiement.${c.frequence_paiement}`, {
        defaultValue: c.frequence_paiement,
      }),
      delaiPaiementJours: String(c.delai_paiement_jours),
      penaliteJour: "",
      penalitePlafond: "",
      assurances: "",
      securite: "",
      dechets: "",
      reception: "",
      contacts: [o.representant && `${o.representant} (${o.societe.name})`, st.contact_nom]
        .filter(Boolean)
        .join(" — "),
    },
    garantiesContractuelles: "",
  };
}

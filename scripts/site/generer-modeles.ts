// Génère les modèles PDF téléchargeables des guides du site vitrine (FR et NL) :
//   public/modeles/<langue>/*.pdf — checklist, modèle de facture TVA 6 %, fiche de retenue.
// Textes officiels repris des sources citées (consultées le 19/10/2026).
// Lancer : bun scripts/site/generer-modeles.ts

import { mkdirSync, writeFileSync } from "node:fs";
import { jsPDF } from "jspdf";
import { dessinerMarquePdf } from "../../src/lib/marque-pdf";

type Ligne = string;
type Section = { titre: string; lignes?: Ligne[]; cases?: string[]; tableau?: [string, string][] };
type Modele = {
  fichier: string;
  titre: string;
  sousTitre: string;
  sections: Section[];
  mention?: { titre: string; texte: string };
  sources: string[];
  avertissement: string;
};

const DATE = "19/10/2026";

const MENTION_6 = {
  fr: "Taux de TVA : En l’absence de contestation par écrit, dans un délai d’un mois à compter de la réception de la facture, le client est présumé reconnaître que (1) les travaux sont effectués à un bâtiment d’habitation dont la première occupation a eu lieu au cours d’une année civile qui précède d’au moins dix ans la date de la première facture relative à ces travaux, (2) qu’après l’exécution de ces travaux, l’habitation est utilisée, soit exclusivement soit à titre principal comme logement privé et (3) que ces travaux sont fournis et facturés à un consommateur final. Si au moins une de ces conditions n’est pas remplie, le taux normal de TVA de 21 % sera applicable et le client endossera, par rapport à ces conditions, la responsabilité quant au paiement de la taxe, des intérêts et des amendes dus.",
  nl: "Btw-tarief: Bij gebrek aan schriftelijke betwisting binnen een termijn van één maand vanaf de ontvangst van de factuur, wordt de klant geacht te erkennen dat: (1) de werken worden verricht aan een woning waarvan de eerste ingebruikneming heeft plaatsgevonden in een kalenderjaar dat ten minste tien jaar voorafgaat aan de datum van de eerste factuur met betrekking tot die werken, (2) de woning, na uitvoering van die werken, uitsluitend of hoofdzakelijk als privéwoning wordt gebruikt en (3) de werken worden verstrekt en gefactureerd aan een eindverbruiker. Wanneer minstens één van die voorwaarden niet is voldaan, zal het normale btw-tarief van 21 % van toepassing zijn en is de afnemer ten aanzien van die voorwaarden aansprakelijk voor de betaling van de verschuldigde belasting, interesten en geldboeten.",
};

const MODELES: Record<"fr" | "nl", Modele[]> = {
  fr: [
    {
      fichier: "checklist-verification-sous-traitant.pdf",
      titre: "Checklist : vérifier un sous-traitant",
      sousTitre: "À joindre au dossier de chaque contrat et de chaque paiement",
      sections: [
        {
          titre: "Identification",
          tableau: [
            ["Sous-traitant", ""],
            ["Numéro d'entreprise (BCE)", ""],
            ["Chantier", ""],
          ],
        },
        {
          titre: "À la signature du contrat",
          cases: [
            "Obligation de retenue consultée (checkobligationderetenue.be) — date et résultat notés",
            "Preuve de la consultation conservée (capture ou attestation)",
            "Contrat de sous-traitance signé",
            "IBAN vérifié auprès du sous-traitant",
            "Sous-traitant ou travailleurs venant de l'étranger : déclaration Limosa vérifiée",
            "Chantier de 500 000 € hors TVA ou plus : enregistrement des présences (Checkinatwork) prévu",
          ],
        },
        {
          titre: "Avant chaque paiement",
          cases: [
            "Nouvelle consultation de l'obligation de retenue, le jour du paiement",
            "Preuve datée conservée et rattachée au paiement",
            "Obligation de retenue : retenue calculée sur le montant hors TVA",
            "Retenues versées à l'ONSS et/ou au SPF Finances en même temps que le paiement",
          ],
        },
      ],
      sources: [
        "ONSS — Retenue sur facture : socialsecurity.be/site_fr/employer/applics/30bis/general/invoice.htm",
        "Check obligation de retenue : checkobligationderetenue.be",
        "Checkinatwork : socialsecurity.be/site_fr/employer/applics/checkinatwork/general/construction-works.htm",
        "Limosa : socialsecurity.be/site_fr/employer/applics/meldingsplicht/wie_melden.htm",
      ],
      avertissement:
        "Information générale à jour au 19/10/2026. Elle ne remplace pas l'avis de votre comptable ou de votre secrétariat social.",
    },
    {
      fichier: "modele-facture-tva-6.pdf",
      titre: "Modèle de facture avec TVA à 6 %",
      sousTitre: "Rénovation d'un logement privé de plus de dix ans",
      sections: [
        {
          titre: "En-tête",
          tableau: [
            ["Entrepreneur (dénomination, adresse, TVA)", ""],
            ["Client consommateur final (nom, adresse)", ""],
            ["Numéro et date de la facture", ""],
            ["Adresse du logement concerné", ""],
          ],
        },
        {
          titre: "Éléments qui justifient le taux de 6 %",
          lignes: [
            "Décrivez précisément les travaux : transformation, rénovation, amélioration, réparation ou entretien (hors nettoyage).",
            "Indiquez le logement concerné et, si possible, l'année de première occupation.",
            "Détaillez les postes, la base hors TVA, la TVA à 6 % et le total TVAC.",
          ],
        },
      ],
      mention: {
        titre: "Mention obligatoire (texte officiel du SPF Finances)",
        texte: MENTION_6.fr,
      },
      sources: [
        "SPF Finances — Rénover : taux de TVA : fin.belgium.be/fr/particuliers/habitation/construire-renover/renover/renover-taux-de-tva",
      ],
      avertissement:
        "Modèle indicatif à jour au 19/10/2026. Faites valider vos factures par votre comptable.",
    },
    {
      fichier: "fiche-obligation-de-retenue.pdf",
      titre: "Fiche de calcul : obligation de retenue",
      sousTitre: "Une fiche par paiement soumis à retenue",
      sections: [
        {
          titre: "Paiement",
          tableau: [
            ["Sous-traitant et BCE", ""],
            ["Facture n° et date", ""],
            ["Montant hors TVA (A)", ""],
            ["Date et heure de la consultation", ""],
          ],
        },
        {
          titre: "Retenues (taux publiés par l'ONSS)",
          tableau: [
            ["Volet fiscal — SPF Finances : 15 % de A", ""],
            ["Volet social — ONSS et/ou fonds : 35 % de A", ""],
            ["Volet social — INASTI : 15 % de A", ""],
            ["Total retenu (plafond : 50 % de A)", ""],
            ["Montant versé au sous-traitant", ""],
          ],
        },
        {
          titre: "Versements (en même temps que le paiement de la facture)",
          lignes: [
            "Volet social : compte BE76 6790 0001 9295, communication structurée générée lors de la préparation (unique, ne pas réutiliser).",
            "Volet fiscal : attestation demandée au SPF Finances, puis compte BE63 6792 0036 4008 avec la communication indiquée.",
          ],
        },
        {
          titre: "Preuves à conserver",
          cases: ["Consultation datée", "Calcul de la retenue", "Preuves des versements"],
        },
      ],
      sources: [
        "ONSS — Retenue sur facture : socialsecurity.be/site_fr/employer/applics/30bis/general/invoice.htm",
      ],
      avertissement:
        "Information générale à jour au 19/10/2026 ; vérifiez les taux et comptes en vigueur avant chaque versement.",
    },
  ],
  nl: [
    {
      fichier: "checklist-controle-onderaannemer.pdf",
      titre: "Checklist: een onderaannemer controleren",
      sousTitre: "Bij het dossier van elk contract en elke betaling voegen",
      sections: [
        {
          titre: "Identificatie",
          tableau: [
            ["Onderaannemer", ""],
            ["Ondernemingsnummer (KBO)", ""],
            ["Werf", ""],
          ],
        },
        {
          titre: "Bij de ondertekening van het contract",
          cases: [
            "Inhoudingsplicht geraadpleegd (checkinhoudingsplicht.be) — datum en resultaat genoteerd",
            "Bewijs van de raadpleging bewaard (schermafdruk of attest)",
            "Onderaannemingscontract ondertekend",
            "IBAN gecontroleerd bij de onderaannemer",
            "Onderaannemer of werknemers uit het buitenland: Limosa-melding gecontroleerd",
            "Werf van 500 000 euro excl. btw of meer: registratie van aanwezigheden (Checkinatwork) voorzien",
          ],
        },
        {
          titre: "Voor elke betaling",
          cases: [
            "Nieuwe raadpleging van de inhoudingsplicht, op de dag van de betaling",
            "Gedateerd bewijs bewaard en gekoppeld aan de betaling",
            "Inhoudingsplicht: inhouding berekend op het bedrag excl. btw",
            "Inhoudingen gestort aan de RSZ en/of de FOD Financiën tegelijk met de betaling",
          ],
        },
      ],
      sources: [
        "RSZ — Inhouding op factuur: socialsecurity.be/site_nl/employer/applics/30bis/general/invoice.htm",
        "Check inhoudingsplicht: checkinhoudingsplicht.be",
        "Checkinatwork: socialsecurity.be/site_nl/employer/applics/checkinatwork/general/construction-works.htm",
        "Limosa: socialsecurity.be/site_nl/employer/applics/meldingsplicht/wie_melden.htm",
      ],
      avertissement:
        "Algemene informatie, bijgewerkt op 19/10/2026. Ze vervangt niet het advies van uw boekhouder of sociaal secretariaat.",
    },
    {
      fichier: "model-factuur-btw-6.pdf",
      titre: "Model van factuur met 6 % btw",
      sousTitre: "Renovatie van een privéwoning ouder dan tien jaar",
      sections: [
        {
          titre: "Hoofding",
          tableau: [
            ["Aannemer (benaming, adres, btw)", ""],
            ["Klant-eindverbruiker (naam, adres)", ""],
            ["Nummer en datum van de factuur", ""],
            ["Adres van de betrokken woning", ""],
          ],
        },
        {
          titre: "Elementen die het tarief van 6 % rechtvaardigen",
          lignes: [
            "Beschrijf de werken nauwkeurig: verbouwing, renovatie, verbetering, herstelling of onderhoud (behalve reiniging).",
            "Vermeld de betrokken woning en, indien mogelijk, het jaar van eerste ingebruikneming.",
            "Detailleer de posten, de basis excl. btw, de btw van 6 % en het totaal incl. btw.",
          ],
        },
      ],
      mention: {
        titre: "Verplichte vermelding (officiële tekst FOD Financiën)",
        texte: MENTION_6.nl,
      },
      sources: [
        "FOD Financiën — Verbouwen: btw-tarief: fin.belgium.be/nl/particulieren/woning/bouwen-verbouwen/verbouwen/verbouwen-btw-tarief",
      ],
      avertissement:
        "Indicatief model, bijgewerkt op 19/10/2026. Laat uw facturen valideren door uw boekhouder.",
    },
    {
      fichier: "fiche-inhoudingsplicht.pdf",
      titre: "Berekeningsfiche: inhoudingsplicht",
      sousTitre: "Eén fiche per betaling met inhouding",
      sections: [
        {
          titre: "Betaling",
          tableau: [
            ["Onderaannemer en KBO-nummer", ""],
            ["Factuurnummer en datum", ""],
            ["Bedrag exclusief btw (A)", ""],
            ["Datum en uur van de raadpleging", ""],
          ],
        },
        {
          titre: "Inhoudingen (percentages gepubliceerd door de RSZ)",
          tableau: [
            ["Fiscaal luik — FOD Financiën: 15 % van A", ""],
            ["Sociaal luik — RSZ en/of fondsen: 35 % van A", ""],
            ["Sociaal luik — RSVZ: 15 % van A", ""],
            ["Totale inhouding (plafond: 50 % van A)", ""],
            ["Bedrag betaald aan de onderaannemer", ""],
          ],
        },
        {
          titre: "Stortingen (tegelijk met de betaling van de factuur)",
          lignes: [
            "Sociaal luik: rekening BE76 6790 0001 9295, gestructureerde mededeling aangemaakt bij de voorbereiding (uniek, niet hergebruiken).",
            "Fiscaal luik: attest aangevraagd bij de FOD Financiën, daarna rekening BE63 6792 0036 4008 met de vermelde mededeling.",
          ],
        },
        {
          titre: "Te bewaren bewijzen",
          cases: [
            "Gedateerde raadpleging",
            "Berekening van de inhouding",
            "Bewijzen van de stortingen",
          ],
        },
      ],
      sources: [
        "RSZ — Inhouding op factuur: socialsecurity.be/site_nl/employer/applics/30bis/general/invoice.htm",
      ],
      avertissement:
        "Algemene informatie, bijgewerkt op 19/10/2026; controleer de geldende percentages en rekeningen voor elke storting.",
    },
  ],
};

const SRC = { fr: "Sources (consultées le", nl: "Bronnen (geraadpleegd op" };

function generer(langue: "fr" | "nl", m: Modele) {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  doc.setProperties({ title: m.titre, author: "ZidarPro", subject: m.sousTitre });
  const W = 210;
  const M = 18;
  let y = 14;
  dessinerMarquePdf(doc, M, y, 8, "clair");
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.8);
  doc.line(M, 26, W - M, 26);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  y = 36;
  doc.setTextColor(15, 42, 67);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(m.titre, M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(m.sousTitre, M, y + 6);
  doc.setTextColor(15, 23, 42);
  y += 16;

  const place = (h: number) => {
    if (y + h > 280) {
      doc.addPage();
      y = 20;
    }
  };
  for (const s of m.sections) {
    place(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 42, 67);
    doc.text(s.titre, M, y);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    y += 6;
    for (const l of s.lignes ?? []) {
      const t = doc.splitTextToSize(l, W - 2 * M) as string[];
      place(t.length * 4.6 + 2);
      doc.text(t, M, y);
      y += t.length * 4.6 + 2;
    }
    for (const c of s.cases ?? []) {
      const t = doc.splitTextToSize(c, W - 2 * M - 8) as string[];
      place(t.length * 4.6 + 3);
      doc.rect(M, y - 3.4, 4, 4);
      doc.text(t, M + 7, y);
      y += t.length * 4.6 + 3;
    }
    for (const [k, v] of s.tableau ?? []) {
      place(9);
      doc.setDrawColor(203, 213, 225);
      doc.rect(M, y - 5, W - 2 * M, 8.5);
      doc.line(M + 90, y - 5, M + 90, y + 3.5);
      doc.setDrawColor(0, 0, 0);
      doc.text(doc.splitTextToSize(k, 86) as string[], M + 2, y);
      if (v) doc.text(v, M + 92, y);
      y += 8.5;
    }
    y += 5;
  }
  if (m.mention) {
    const t = doc.splitTextToSize(m.mention.texte, W - 2 * M - 8) as string[];
    place(t.length * 4.2 + 16);
    doc.setFillColor(255, 247, 237);
    doc.setDrawColor(245, 158, 11);
    doc.rect(M, y - 2, W - 2 * M, t.length * 4.2 + 12, "FD");
    doc.setDrawColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(m.mention.titre, M + 4, y + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(t, M + 4, y + 10);
    y += t.length * 4.2 + 18;
  }
  place(30);
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "bold");
  doc.text(`${SRC[langue]} ${DATE})`, M, y);
  doc.setFont("helvetica", "normal");
  y += 4.5;
  for (const s of m.sources) {
    const t = doc.splitTextToSize(`• ${s}`, W - 2 * M) as string[];
    doc.text(t, M, y);
    y += t.length * 3.8;
  }
  y += 3;
  doc.text(doc.splitTextToSize(m.avertissement, W - 2 * M) as string[], M, y);
  return Buffer.from(doc.output("arraybuffer"));
}

for (const langue of ["fr", "nl"] as const) {
  mkdirSync(`public/modeles/${langue}`, { recursive: true });
  for (const m of MODELES[langue]) {
    const chemin = `public/modeles/${langue}/${m.fichier}`;
    writeFileSync(chemin, generer(langue, m));
    console.log(`✓ ${chemin}`);
  }
}

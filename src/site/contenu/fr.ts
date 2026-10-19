/* Contenu éditorial du site vitrine (français), hors i18next. */
import type { InterfaceSite, PageSite, Source } from "../types";

const C = "2026-10-19"; // date de consultation des sources
const MAJ = "2026-10-19";

const S: Record<string, Source> = {
  onssRetenue: {
    titre: "ONSS — Retenue sur facture : consultation, préparation et paiement",
    url: "https://www.socialsecurity.be/site_fr/employer/applics/30bis/general/invoice.htm",
    consulteLe: C,
  },
  check: {
    titre: "ONSS / SPF Finances — Check obligation de retenue",
    url: "https://www.checkobligationderetenue.be",
    consulteLe: C,
  },
  tva6: {
    titre: "SPF Finances — Rénover : taux de TVA",
    url: "https://fin.belgium.be/fr/particuliers/habitation/construire-renover/renover/renover-taux-de-tva",
    consulteLe: C,
  },
  caw: {
    titre: "Sécurité sociale — Checkinatwork : travaux immobiliers",
    url: "https://www.socialsecurity.be/site_fr/employer/applics/checkinatwork/general/construction-works.htm",
    consulteLe: C,
  },
  limosa: {
    titre: "Sécurité sociale — Limosa : qui doit être déclaré ?",
    url: "https://www.socialsecurity.be/site_fr/employer/applics/meldingsplicht/wie_melden.htm",
    consulteLe: C,
  },
  autoliq: {
    titre: "UCM — Autoliquidation de la TVA pour les travaux immobiliers : changements 2023",
    url: "https://www.ucm.be/actualites/autoliquidation-de-la-tva-pour-les-travaux-immobiliers-changements-2023",
    consulteLe: C,
  },
};

const AVERTISSEMENT =
  "Information générale à jour au 19/10/2026, établie à partir des sources officielles citées. Elle ne remplace pas l'avis de votre comptable ou de votre secrétariat social : vérifiez toujours la règle en vigueur avant de l'appliquer.";

export const interfaceFr: InterfaceSite = {
  langueNom: "Français",
  nav: {
    fonctions: "Fonctionnalités",
    tarifs: "Tarifs",
    guides: "Guides",
    faq: "FAQ",
    connexion: "Se connecter",
  },
  demo: "Demander une démo",
  autreLangue: "Nederlands",
  piedTexte:
    "ZidarPro aide les entreprises belges de la construction à travailler avec leurs sous-traitants en règle : vérification 30bis, contrats, prestations, retenues et preuves de conformité.",
  piedFonctions: "Fonctionnalités",
  piedRessources: "Ressources",
  piedLegal: "Informations",
  mentionsLegales: "Mentions légales",
  majLe: "Mis à jour le",
  sources: "Sources officielles",
  consulteLe: "consulté le",
  telecharger: "Télécharger le modèle (PDF)",
  reponse: "En bref",
  ariane: "Fil d'Ariane",
  accueil: "Accueil",
  ouvrirApp: "Ouvrir l'application",
  formulaire: {
    titre: "Votre demande de démo",
    nom: "Nom et prénom",
    societe: "Entreprise",
    email: "E-mail professionnel",
    telephone: "Téléphone (facultatif)",
    message: "Votre activité et vos besoins (facultatif)",
    envoyer: "Préparer l'e-mail de demande",
    note: "Le bouton ouvre votre messagerie avec un e-mail prérempli : rien n'est enregistré sur ce site.",
    indisponible:
      "Le formulaire sera actif très prochainement. En attendant, contactez-nous par le canal habituel.",
    sujet: "Demande de démo ZidarPro",
  },
  illustration: "Illustration de l'interface (données fictives)",
  legal: {
    enAttente:
      "Les informations de l'éditeur (dénomination, adresse, numéro d'entreprise, contact) seront publiées ici prochainement.",
    editeur: "Éditeur",
    adresse: "Adresse",
    bce: "Numéro d'entreprise",
    contact: "Contact",
  },
  illus: {
    verification: {
      titre: "Paiement — Électricité Lambert SRL",
      lignes: [
        { libelle: "Vérification 30bis du jour", valeur: "19/10 à 09:42", etat: "ok" },
        { libelle: "Capture de la consultation", valeur: "Enregistrée", etat: "ok" },
        { libelle: "Dette sociale (ONSS)", valeur: "Aucune", etat: "ok" },
        { libelle: "Dette fiscale (SPF Finances)", valeur: "Aucune", etat: "ok" },
        { libelle: "Montant à verser", valeur: "12 100,00 €", etat: "neutre" },
      ],
    },
    retenue: {
      titre: "Paiement — Dakwerken Peeters BV",
      lignes: [
        { libelle: "Facture hors TVA", valeur: "10 000,00 €", etat: "neutre" },
        { libelle: "Dette ONSS constatée", valeur: "3 000,00 €", etat: "alerte" },
        { libelle: "Retenue ONSS (plafonnée à la dette)", valeur: "3 000,00 €", etat: "alerte" },
        { libelle: "Retenue SPF Finances", valeur: "0,00 €", etat: "neutre" },
        { libelle: "À verser au sous-traitant", valeur: "7 000,00 €", etat: "ok" },
      ],
    },
    conformite: {
      titre: "Conformité — Nowak Bud Sp. z o.o.",
      lignes: [
        { libelle: "Attestation 30bis", valeur: "Expire dans 18 jours", etat: "alerte" },
        { libelle: "Attestation TVA", valeur: "Valide", etat: "ok" },
        { libelle: "IBAN validé", valeur: "Oui", etat: "ok" },
        { libelle: "Contrat signé en ligne", valeur: "Oui", etat: "ok" },
      ],
    },
    devis: {
      titre: "Devis D-2026-014 — rénovation salle de bain",
      lignes: [
        { libelle: "Langue du client", valeur: "Néerlandais", etat: "neutre" },
        { libelle: "TVA", valeur: "6 %", etat: "neutre" },
        { libelle: "Mention légale TVA 6 %", valeur: "Imprimée", etat: "ok" },
        { libelle: "Total TVAC", valeur: "9 540,00 €", etat: "neutre" },
      ],
    },
    chantier: {
      titre: "Chantier — Rénovation rue Haute 12",
      lignes: [
        { libelle: "Prestations encodées", valeur: "30", etat: "neutre" },
        { libelle: "Heures sous-traitance", valeur: "270 h", etat: "neutre" },
        { libelle: "Payé hors TVA", valeur: "5 500,00 €", etat: "neutre" },
        { libelle: "Retenues 30bis versées", valeur: "825,00 €", etat: "ok" },
      ],
    },
  },
};

export const pagesFr: PageSite[] = [
  // ------------------------------------------------------------------ Accueil
  {
    cle: "accueil",
    type: "accueil",
    chemin: "",
    titre: "ZidarPro — Sous-traitance et 30bis en règle, sans papier",
    description:
      "Logiciel belge pour la construction : vérification 30bis avant chaque paiement, contrats signés en ligne, prestations, retenues et preuves de conformité.",
    h1: "Vos sous-traitants en règle, chaque paiement prouvé",
    chapo:
      "ZidarPro vérifie l'obligation de retenue avant chaque paiement, calcule les retenues, fait signer vos contrats en ligne et garde toutes les preuves de conformité au même endroit.",
    majLe: MAJ,
    blocs: [
      { type: "cta" },
      { type: "illustration", variante: "verification" },
      { type: "h2", texte: "Le risque que ZidarPro vous évite", id: "risque" },
      {
        type: "p",
        texte:
          "Si vous payez un sous-traitant qui a des dettes sociales ou fiscales sans effectuer la retenue obligatoire, vous risquez une amende administrative et une responsabilité solidaire pour ses dettes. La règle impose de vérifier à la signature du contrat et avant chaque paiement ([ONSS](https://www.socialsecurity.be/site_fr/employer/applics/30bis/general/invoice.htm)).",
      },
      { type: "h2", texte: "Tout le cycle de la sous-traitance", id: "fonctionnalites" },
      {
        type: "cartes",
        items: [
          {
            titre: "Vérification 30bis",
            texte:
              "Vérification du jour exigée avant chaque paiement, capture conservée, alerte en cas de dette.",
            lien: "/fr/fonctionnalites/verification-30bis",
          },
          {
            titre: "Sous-traitants et conformité",
            texte:
              "Attestations, IBAN validé, contrat signé : statut de chaque sous-traitant et blocage automatique.",
            lien: "/fr/fonctionnalites/sous-traitants-conformite",
          },
          {
            titre: "Devis et autoliquidation",
            texte:
              "Devis en français, néerlandais ou anglais avec les mentions légales TVA 6 % et autoliquidation.",
            lien: "/fr/fonctionnalites/devis-autoliquidation",
          },
          {
            titre: "Gestion des chantiers",
            texte:
              "Chantiers, journal des prestations des sous-traitants, totaux d'heures et de montants, exports.",
            lien: "/fr/fonctionnalites/gestion-chantiers",
          },
        ],
      },
      { type: "h2", texte: "Comment ça marche", id: "fonctionnement" },
      {
        type: "etapes",
        items: [
          {
            titre: "Encodez vos sous-traitants",
            texte:
              "Numéro d'entreprise, IBAN, attestations : ZidarPro calcule leur statut de conformité.",
          },
          {
            titre: "Faites signer le contrat en ligne",
            texte:
              "Un lien sécurisé, une signature à l'écran, une piste d'audit et un PDF signé pour les deux parties.",
          },
          {
            titre: "Payez en règle",
            texte:
              "Avant chaque paiement : vérification du jour, retenue calculée et plafonnée, montant à verser au sous-traitant, à l'ONSS et au SPF Finances.",
          },
          {
            titre: "Gardez les preuves",
            texte:
              "Registre des retenues, dossier de conformité PDF par sous-traitant et export pour votre comptable.",
          },
        ],
      },
      { type: "h2", texte: "Pour les PME belges de la construction" },
      {
        type: "liste",
        items: [
          "Entrepreneurs généraux et spécialisés qui travaillent avec des sous-traitants.",
          "Interface en français, néerlandais, anglais, roumain et polonais ; documents pour vos clients en français, néerlandais ou anglais.",
          "Formats belges : montants, dates, numéros de TVA et d'entreprise.",
        ],
      },
      { type: "h2", texte: "Guides pratiques" },
      {
        type: "cartes",
        items: [
          {
            titre: "Vérifier un sous-traitant",
            texte: "Les contrôles à faire avant de signer et avant chaque paiement.",
            lien: "/fr/guides/verifier-un-sous-traitant",
          },
          {
            titre: "Facture avec TVA à 6 %",
            texte: "Conditions et mention légale officielle à reprendre sur la facture.",
            lien: "/fr/guides/facture-tva-6-pourcent",
          },
          {
            titre: "Obligation de retenue",
            texte: "Taux, plafond, paiement à l'ONSS et au SPF Finances, sanctions.",
            lien: "/fr/guides/obligation-de-retenue",
          },
        ],
      },
      { type: "cta", texte: "Découvrez ZidarPro sur vos propres cas en 30 minutes." },
    ],
  },

  // ------------------------------------------------------------------ Fonctions
  {
    cle: "f-30bis",
    type: "fonction",
    chemin: "fonctionnalites/verification-30bis",
    titre: "Vérification 30bis avant chaque paiement | ZidarPro",
    description:
      "Vérification de l'obligation de retenue le jour du paiement, capture conservée, retenue ONSS et SPF Finances calculée et plafonnée, registre des retenues.",
    h1: "Vérification 30bis avant chaque paiement",
    chapo:
      "ZidarPro n'enregistre un paiement de sous-traitance qu'après une vérification de l'obligation de retenue faite le jour même.",
    majLe: MAJ,
    parents: ["accueil"],
    blocs: [
      { type: "illustration", variante: "retenue" },
      { type: "h2", texte: "Ce que fait ZidarPro" },
      {
        type: "liste",
        items: [
          "Lien direct vers le service officiel Check obligation de retenue, numéro d'entreprise prérempli.",
          "Résultat enregistré et daté (heure de Bruxelles), avec la capture d'écran de la consultation, sans modification possible ensuite.",
          "Paiement refusé sans vérification du jour pour ce sous-traitant.",
          "En cas de dette : retenue sociale (ONSS) et fiscale (SPF Finances) calculée sur le montant hors TVA, plafonnée au montant de la dette communiquée et au montant du paiement.",
          "Montants à verser au sous-traitant, à l'ONSS et au SPF Finances affichés au moment du paiement.",
          "Registre des retenues (CSV et PDF) et export pour votre comptable.",
        ],
      },
      {
        type: "avertissement",
        texte:
          "Les taux de retenue sont des paramètres datés, présentés comme indicatifs : faites-les valider par votre comptable. Le volet INASTI (indépendants) annoncé par l'ONSS n'est pas encore géré par ZidarPro.",
      },
      {
        type: "p",
        texte:
          "Pour comprendre la règle, lisez nos guides [Vérifier un sous-traitant](/fr/guides/verifier-un-sous-traitant) et [Obligation de retenue](/fr/guides/obligation-de-retenue).",
      },
      { type: "cta" },
    ],
  },
  {
    cle: "f-devis",
    type: "fonction",
    chemin: "fonctionnalites/devis-autoliquidation",
    titre: "Devis, TVA 6 % et autoliquidation | ZidarPro",
    description:
      "Devis en français, néerlandais ou anglais avec les mentions légales complètes : TVA 6 % en rénovation et autoliquidation (cocontractant).",
    h1: "Devis avec TVA à 6 % et autoliquidation",
    chapo:
      "Préparez des devis dans la langue de votre client, avec les mentions légales complètes exigées pour la TVA à 6 % et l'autoliquidation.",
    majLe: MAJ,
    parents: ["accueil"],
    blocs: [
      { type: "illustration", variante: "devis" },
      { type: "h2", texte: "Ce que fait ZidarPro" },
      {
        type: "liste",
        items: [
          "Devis PDF en français, néerlandais ou anglais, selon la langue de votre client.",
          "TVA à 6 % : la mention officielle publiée par le SPF Finances est imprimée sur le document.",
          "Autoliquidation (cocontractant) : la mention complète exigée depuis le 1er janvier 2023 est imprimée sur le document.",
          "Plusieurs taux de TVA par devis, totaux par taux.",
          "Formats belges : montants, dates, numéros de TVA et d'entreprise.",
        ],
      },
      {
        type: "p",
        texte:
          "Les conditions de la TVA à 6 % sont détaillées dans notre guide [Facture avec TVA à 6 %](/fr/guides/facture-tva-6-pourcent).",
      },
      { type: "cta" },
    ],
  },
  {
    cle: "f-chantiers",
    type: "fonction",
    chemin: "fonctionnalites/gestion-chantiers",
    titre: "Gestion des chantiers et des prestations | ZidarPro",
    description:
      "Chantiers, journal des prestations des sous-traitants, heures et ouvriers, totaux par sous-traitant, exports CSV et PDF du journal de chantier.",
    h1: "Gestion des chantiers",
    chapo:
      "Suivez vos chantiers et ce que chaque sous-traitant y a réellement presté, avec les montants payés et retenus.",
    majLe: MAJ,
    parents: ["accueil"],
    blocs: [
      { type: "illustration", variante: "chantier" },
      { type: "h2", texte: "Ce que fait ZidarPro" },
      {
        type: "liste",
        items: [
          "Fiche chantier : client, adresse, budget, avancement, contrats de sous-traitance rattachés.",
          "Journal des prestations : date, heures, ouvriers (nom, fonction, heures), case Checkinatwork, validation par un gestionnaire.",
          "Saisie d'une prestation directement depuis le chantier, avec blocage si le sous-traitant n'est pas en règle.",
          "Totaux par sous-traitant : heures, forfait, payé hors TVA, retenues, versé, reste à payer.",
          "Export du journal de chantier en CSV et en PDF.",
        ],
      },
      {
        type: "p",
        texte:
          "Pour l'enregistrement des présences, voir la question Checkinatwork de notre [FAQ](/fr/faq).",
      },
      { type: "cta" },
    ],
  },
  {
    cle: "f-conformite",
    type: "fonction",
    chemin: "fonctionnalites/sous-traitants-conformite",
    titre: "Sous-traitants et conformité | ZidarPro",
    description:
      "Statut de conformité de chaque sous-traitant : attestations 30bis et TVA, IBAN validé, contrat signé en ligne, alertes d'échéance et blocage automatique.",
    h1: "Sous-traitants et conformité",
    chapo:
      "Un statut clair pour chaque sous-traitant, des alertes avant l'échéance des attestations et un dossier de preuves prêt à présenter.",
    majLe: MAJ,
    parents: ["accueil"],
    blocs: [
      { type: "illustration", variante: "conformite" },
      { type: "h2", texte: "Ce que fait ZidarPro" },
      {
        type: "liste",
        items: [
          "Quatre exigences suivies : attestation 30bis, attestation TVA, IBAN validé, contrat de sous-traitance.",
          "Alertes 30 jours avant l'échéance d'une attestation, sur le tableau de bord.",
          "Affectation à un chantier bloquée si l'attestation 30bis n'est pas valide, sauf dérogation motivée (30 jours maximum, révocable).",
          "Contrat de sous-traitance signé en ligne par lien sécurisé : signature à l'écran, piste d'audit (horodatage, empreinte du document) et PDF signé.",
          "Dossier de conformité PDF par sous-traitant : attestations, vérifications, contrats, paiements et retenues.",
          "Documents conservés comme preuves : jamais supprimés, seulement invalidés avec un motif.",
        ],
      },
      {
        type: "avertissement",
        texte:
          "Le modèle de contrat fourni est un modèle générique à faire valider par votre juriste.",
      },
      { type: "cta" },
    ],
  },

  // ------------------------------------------------------------------ Tarifs
  {
    cle: "tarifs",
    type: "tarifs",
    chemin: "tarifs",
    titre: "Tarifs ZidarPro — sur demande",
    description:
      "Tarifs ZidarPro sur demande, selon la taille de votre entreprise et le nombre de sous-traitants. Demandez une démo personnalisée.",
    h1: "Tarifs",
    chapo:
      "Nos tarifs sont établis sur demande, selon la taille de votre entreprise et le nombre de sous-traitants que vous gérez.",
    majLe: MAJ,
    parents: ["accueil"],
    blocs: [
      { type: "h2", texte: "Tarifs sur demande" },
      {
        type: "liste",
        items: [
          "Démonstration sur vos propres cas : vérification 30bis, contrats, retenues.",
          "Proposition adaptée à votre activité.",
          "Interface en 5 langues et documents FR / NL / EN inclus.",
        ],
      },
      { type: "cta" },
    ],
  },

  // ------------------------------------------------------------------ FAQ
  {
    cle: "faq",
    type: "faq",
    chemin: "faq",
    titre: "FAQ 30bis, Checkinatwork, Limosa, TVA | ZidarPro",
    description:
      "Réponses courtes et sourcées : obligation de retenue 30bis, Checkinatwork, Limosa, autoliquidation de la TVA et calcul des retenues.",
    h1: "Questions fréquentes",
    chapo: "Les réponses courtes, avec un lien vers la source officielle.",
    majLe: MAJ,
    parents: ["accueil"],
    blocs: [
      { type: "h2", texte: "Obligation de retenue (30bis)" },
      {
        type: "faq",
        items: [
          {
            q: "Quand dois-je vérifier l'obligation de retenue d'un sous-traitant ?",
            r: "À la signature du contrat et avant chaque paiement de facture, via le service Check obligation de retenue (ONSS / SPF Finances). Voir notre guide [Vérifier un sous-traitant](/fr/guides/verifier-un-sous-traitant).",
          },
          {
            q: "Qui est concerné ?",
            r: "Les donneurs d'ordre, entrepreneurs et sous-traitants actifs notamment dans les travaux immobiliers. Les particuliers qui font réaliser des travaux à des fins strictement privées ne sont pas visés (source : ONSS).",
          },
          {
            q: "Que risque-t-on si on ne retient pas ?",
            r: "Une amende administrative et une responsabilité solidaire pour les dettes fiscales et sociales du cocontractant (source : ONSS).",
          },
        ],
      },
      { type: "h2", texte: "Retenues" },
      {
        type: "faq",
        items: [
          {
            q: "Quels sont les taux de retenue ?",
            r: "D'après l'ONSS : 15 % pour le volet fiscal (SPF Finances), 35 % pour le volet social (ONSS et/ou fonds), 15 % pour l'INASTI, calculés sur le montant hors TVA, avec un plafond de 50 %. Détails dans notre guide [Obligation de retenue](/fr/guides/obligation-de-retenue).",
          },
          {
            q: "Comment verser la retenue ?",
            r: "En même temps que le paiement de la facture : volet social sur le compte indiqué par l'ONSS avec la communication structurée générée lors de la préparation ; volet fiscal après avoir obtenu l'attestation du SPF Finances (source : ONSS).",
          },
        ],
      },
      { type: "h2", texte: "Checkinatwork" },
      {
        type: "faq",
        items: [
          {
            q: "À partir de quel montant faut-il enregistrer les présences ?",
            r: "Pour les travaux immobiliers commencés après le 29/02/2016, dès que le montant total atteint 500 000 € hors TVA, au début ou pendant les travaux (source : sécurité sociale, Checkinatwork).",
          },
          {
            q: "Quand enregistrer la présence ?",
            r: "Avant que la personne ne commence à travailler sur le chantier. L'entrepreneur déclarant veille à ce que les présences soient enregistrées (source : sécurité sociale, Checkinatwork).",
          },
        ],
      },
      { type: "h2", texte: "Limosa" },
      {
        type: "faq",
        items: [
          {
            q: "Qui doit faire l'objet d'une déclaration Limosa ?",
            r: "Les travailleurs salariés qui viennent travailler temporairement ou partiellement en Belgique et qui, en principe, ne sont pas assujettis à la sécurité sociale belge ; et les indépendants qui viennent exercer temporairement dans un secteur à risques, dont la construction. Des exceptions existent, notamment pour des missions de courte durée (source : sécurité sociale, Limosa).",
          },
        ],
      },
      { type: "h2", texte: "Autoliquidation de la TVA" },
      {
        type: "faq",
        items: [
          {
            q: "Qu'est-ce que l'autoliquidation dans la construction ?",
            r: "Pour certains travaux immobiliers, la TVA n'est pas facturée par l'entrepreneur mais due par son client (le cocontractant), lorsque celui-ci est un assujetti tenu au dépôt de déclarations TVA périodiques.",
          },
          {
            q: "Quelle mention faut-il sur la facture ?",
            r: "Depuis le 1er janvier 2023, la formule courte ne suffit plus : la facture doit contenir la mention complète prévue par l'arrêté royal du 26 octobre 2022 (présomption de reconnaissance par le client, sauf contestation écrite dans le mois). ZidarPro l'imprime sur vos devis. Faites valider le texte par votre comptable.",
          },
        ],
      },
      { type: "h2", texte: "ZidarPro" },
      {
        type: "faq",
        items: [
          {
            q: "ZidarPro remplace-t-il mon comptable ou mon secrétariat social ?",
            r: "Non. ZidarPro organise les vérifications, les calculs et les preuves ; les taux et règles restent à valider par votre comptable ou votre secrétariat social.",
          },
          {
            q: "Comment essayer ZidarPro ?",
            r: "Sur demande de démo : nous vous montrons ZidarPro sur vos propres cas. [Demander une démo](/fr/demande-de-demo).",
          },
        ],
      },
      { type: "sources", items: [S.onssRetenue, S.caw, S.limosa, S.autoliq] },
      { type: "cta" },
    ],
  },

  // ------------------------------------------------------------------ Guides
  {
    cle: "guides",
    type: "guides",
    chemin: "guides",
    titre: "Guides pratiques construction : 30bis, TVA 6 % | ZidarPro",
    description:
      "Guides pratiques et sourcés pour les entreprises belges de la construction : vérifier un sous-traitant, facture avec TVA à 6 %, obligation de retenue.",
    h1: "Guides pratiques",
    chapo:
      "Des réponses directes, des étapes claires, un modèle à télécharger et les sources officielles.",
    majLe: MAJ,
    parents: ["accueil"],
    blocs: [
      {
        type: "cartes",
        items: [
          {
            titre: "Vérifier un sous-traitant",
            texte:
              "Les contrôles avant de signer et avant chaque paiement, et les preuves à garder.",
            lien: "/fr/guides/verifier-un-sous-traitant",
          },
          {
            titre: "Facture avec TVA à 6 %",
            texte: "Les conditions et la mention officielle à reprendre sur la facture.",
            lien: "/fr/guides/facture-tva-6-pourcent",
          },
          {
            titre: "Obligation de retenue",
            texte: "Taux, plafond, limitation, paiement et sanctions.",
            lien: "/fr/guides/obligation-de-retenue",
          },
        ],
      },
    ],
  },
  {
    cle: "g-verifier",
    type: "guide",
    chemin: "guides/verifier-un-sous-traitant",
    titre: "Vérifier un sous-traitant : contrôles et preuves",
    description:
      "Comment vérifier un sous-traitant en Belgique : obligation de retenue avant chaque paiement, preuves à conserver, Checkinatwork et Limosa. Checklist PDF.",
    h1: "Vérifier un sous-traitant : les contrôles avant de signer et de payer",
    majLe: MAJ,
    parents: ["accueil", "guides"],
    blocs: [
      {
        type: "reponse",
        titre: "En bref",
        texte:
          "Avant de signer le contrat et avant chaque paiement, consultez le service officiel Check obligation de retenue avec le numéro d'entreprise du sous-traitant. S'il affiche une obligation de retenue, retenez le pourcentage prévu sur le montant hors TVA et versez-le à l'ONSS et/ou au SPF Finances en même temps que le paiement. Gardez une preuve datée de chaque consultation.",
      },
      { type: "h2", texte: "Les étapes" },
      {
        type: "etapes",
        items: [
          {
            titre: "Récupérez le numéro d'entreprise (BCE)",
            texte:
              "C'est la clé de toutes les consultations. Vérifiez qu'il correspond bien à l'entreprise qui facture.",
          },
          {
            titre: "Consultez l'obligation de retenue à la signature",
            texte:
              "Sur [Check obligation de retenue](https://www.checkobligationderetenue.be). Pour un grand nombre d'entreprises, l'ONSS propose le service web Billretainment.",
          },
          {
            titre: "Consultez à nouveau avant chaque paiement",
            texte:
              "La situation change : les données sont mises à jour chaque mois, le vendredi qui suit le dernier jeudi du mois (source : ONSS). Une consultation ancienne ne couvre pas un nouveau paiement.",
          },
          {
            titre: "Gardez une preuve datée",
            texte:
              "Date, heure, résultat et capture ou attestation de consultation, rattachés au paiement concerné.",
          },
          {
            titre: "S'il y a une obligation de retenue, appliquez-la",
            texte:
              "Calculez la retenue sur le montant hors TVA et versez-la en même temps que le paiement. Voir le guide [Obligation de retenue](/fr/guides/obligation-de-retenue).",
          },
          {
            titre: "Vérifiez les autres obligations du chantier",
            texte:
              "Enregistrement des présences (Checkinatwork) si le chantier atteint 500 000 € hors TVA, et déclaration Limosa pour un sous-traitant ou des travailleurs venant de l'étranger (voir la [FAQ](/fr/faq)).",
          },
        ],
      },
      {
        type: "modele",
        fichier: "/modeles/fr/checklist-verification-sous-traitant.pdf",
        libelle: "Checklist : vérifier un sous-traitant",
        description: "Une page à imprimer ou à joindre à chaque dossier de paiement.",
      },
      { type: "h2", texte: "Avec ZidarPro" },
      {
        type: "p",
        texte:
          "ZidarPro exige la vérification du jour avant d'enregistrer un paiement, conserve la capture et calcule la retenue. Voir [Vérification 30bis](/fr/fonctionnalites/verification-30bis).",
      },
      { type: "avertissement", texte: AVERTISSEMENT },
      { type: "sources", items: [S.onssRetenue, S.check, S.caw, S.limosa] },
      { type: "cta" },
    ],
  },
  {
    cle: "g-tva6",
    type: "guide",
    chemin: "guides/facture-tva-6-pourcent",
    titre: "Facture avec TVA à 6 % : conditions et mention",
    description:
      "TVA à 6 % pour la rénovation d'un logement de plus de 10 ans : conditions, nature des travaux et mention officielle à reprendre sur la facture. Modèle PDF.",
    h1: "Facture avec TVA à 6 % : conditions et mention légale",
    majLe: MAJ,
    parents: ["accueil", "guides"],
    blocs: [
      {
        type: "reponse",
        titre: "En bref",
        texte:
          "La TVA à 6 % peut s'appliquer à la rénovation d'un logement privé dont la première occupation date d'au moins dix ans, pour des travaux fournis et facturés à un consommateur final. Depuis 2022, il n'y a plus d'attestation à faire signer : la facture doit contenir les éléments qui justifient le taux réduit et la mention officielle publiée par le SPF Finances.",
      },
      { type: "h2", texte: "Les conditions" },
      {
        type: "liste",
        items: [
          "Âge : première occupation au cours d'une année civile qui précède d'au moins dix ans la date de la première facture des travaux.",
          "Usage : après les travaux, le logement est utilisé exclusivement ou à titre principal comme logement privé.",
          "Client : les travaux sont fournis et facturés à un consommateur final.",
          "Nature : transformation, rénovation, amélioration, réparation ou entretien (sauf nettoyage) du logement.",
        ],
      },
      {
        type: "p",
        texte:
          "Attention : si les travaux sont trop importants (extension de surface, ajout de murs porteurs…), il peut s'agir d'une nouvelle construction, soumise à 21 % (source : SPF Finances).",
      },
      { type: "h2", texte: "Les étapes" },
      {
        type: "etapes",
        items: [
          {
            titre: "Vérifiez les conditions avec votre client",
            texte: "Âge du logement, usage privé après travaux, client consommateur final.",
          },
          {
            titre: "Décrivez les travaux sur la facture",
            texte:
              "La facture reprend tous les éléments qui justifient l'application du taux de 6 %.",
          },
          {
            titre: "Reprenez la mention officielle",
            texte: "Le texte exact est reproduit ci-dessous et dans le modèle à télécharger.",
          },
          {
            titre: "En cas de contestation",
            texte:
              "Le client dispose d'un mois à compter de la réception de la facture pour contester par écrit ; vous lui remettez alors une facture corrigée.",
          },
        ],
      },
      { type: "h2", texte: "La mention officielle (SPF Finances)" },
      {
        type: "p",
        texte:
          "« Taux de TVA : En l’absence de contestation par écrit, dans un délai d’un mois à compter de la réception de la facture, le client est présumé reconnaître que (1) les travaux sont effectués à un bâtiment d’habitation dont la première occupation a eu lieu au cours d’une année civile qui précède d’au moins dix ans la date de la première facture relative à ces travaux, (2) qu’après l’exécution de ces travaux, l’habitation est utilisée, soit exclusivement soit à titre principal comme logement privé et (3) que ces travaux sont fournis et facturés à un consommateur final. Si au moins une de ces conditions n’est pas remplie, le taux normal de TVA de 21 % sera applicable et le client endossera, par rapport à ces conditions, la responsabilité quant au paiement de la taxe, des intérêts et des amendes dus. »",
      },
      {
        type: "modele",
        fichier: "/modeles/fr/modele-facture-tva-6.pdf",
        libelle: "Modèle de facture avec TVA à 6 %",
        description: "Structure de facture et mention officielle à reprendre.",
      },
      { type: "h2", texte: "Avec ZidarPro" },
      {
        type: "p",
        texte:
          "ZidarPro imprime la mention officielle sur vos devis, en français, néerlandais ou anglais. Voir [Devis et autoliquidation](/fr/fonctionnalites/devis-autoliquidation).",
      },
      { type: "avertissement", texte: AVERTISSEMENT },
      { type: "sources", items: [S.tva6] },
      { type: "cta" },
    ],
  },
  {
    cle: "g-retenue",
    type: "guide",
    chemin: "guides/obligation-de-retenue",
    titre: "Obligation de retenue (30bis) : taux et paiement",
    description:
      "Obligation de retenue sur facture : qui est concerné, taux ONSS, SPF Finances et INASTI, plafond, limitation, paiement et sanctions. Fiche de calcul PDF.",
    h1: "Obligation de retenue (30bis) : taux, paiement et sanctions",
    majLe: MAJ,
    parents: ["accueil", "guides"],
    blocs: [
      {
        type: "reponse",
        titre: "En bref",
        texte:
          "Si votre cocontractant a des dettes sociales ou fiscales, vous devez retenir un pourcentage du montant hors TVA de sa facture et le verser directement à l'ONSS et/ou au SPF Finances, en même temps que le paiement. La vérification se fait à la signature du contrat et avant chaque paiement.",
      },
      { type: "h2", texte: "Qui est concerné ?" },
      {
        type: "p",
        texte:
          "Les donneurs d'ordre, entrepreneurs et sous-traitants actifs dans l'immobilier (ainsi que le gardiennage et la préparation de la viande). Les particuliers qui font réaliser des travaux à des fins strictement privées ne sont pas visés. Pour les indépendants, l'extension aux dettes sociales ne concerne que les activités immobilières (source : ONSS).",
      },
      { type: "h2", texte: "Les taux (source : ONSS)" },
      {
        type: "tableau",
        entetes: ["Volet", "Organisme", "Taux sur le montant hors TVA"],
        lignes: [
          ["Fiscal", "SPF Finances", "15 %"],
          ["Social", "ONSS et/ou fonds (OPOC / FSEG)", "35 %"],
          ["Social (indépendants)", "INASTI", "15 %"],
          ["Plafond", "Total retenu", "50 %"],
        ],
      },
      { type: "h2", texte: "Les étapes" },
      {
        type: "etapes",
        items: [
          {
            titre: "Consultez avant chaque paiement",
            texte:
              "Sur [Check obligation de retenue](https://www.checkobligationderetenue.be) : le résultat indique s'il faut retenir et pour quel volet.",
          },
          {
            titre: "Calculez la retenue",
            texte:
              "Appliquez le taux de chaque volet au montant hors TVA de la facture, dans la limite du plafond.",
          },
          {
            titre: "Préparez le versement",
            texte:
              "Volet social : préparation dans l'application en ligne, qui génère une communication structurée unique. Volet fiscal : demandez d'abord une attestation au SPF Finances, qui indique la communication à utiliser.",
          },
          {
            titre: "Versez en même temps que la facture",
            texte:
              "Le sous-traitant reçoit le montant de la facture diminué des retenues ; l'ONSS et le SPF Finances reçoivent les retenues.",
          },
          {
            titre: "Gardez les preuves",
            texte: "Consultation datée, calcul, preuves de paiement.",
          },
        ],
      },
      { type: "h2", texte: "Limitation de la retenue" },
      {
        type: "p",
        texte:
          "Pour une facture de plus de 7 143 € hors TVA, la retenue peut être limitée au montant de la dette, sur la base d'une attestation demandée par l'entreprise en dette (sociale) ou par l'entrepreneur (fiscale, valable 20 jours) (source : ONSS).",
      },
      { type: "h2", texte: "Sanctions" },
      {
        type: "p",
        texte:
          "En cas de non-respect : une amende administrative et une responsabilité solidaire pour les dettes fiscales et sociales du cocontractant (source : ONSS).",
      },
      {
        type: "modele",
        fichier: "/modeles/fr/fiche-obligation-de-retenue.pdf",
        libelle: "Fiche de calcul : obligation de retenue",
        description: "Tableau de calcul et liste des preuves à conserver pour chaque paiement.",
      },
      { type: "h2", texte: "Avec ZidarPro" },
      {
        type: "p",
        texte:
          "ZidarPro calcule les retenues ONSS et SPF Finances, plafonnées à la dette communiquée et au montant du paiement, et tient le registre des retenues. Voir [Vérification 30bis](/fr/fonctionnalites/verification-30bis).",
      },
      { type: "avertissement", texte: AVERTISSEMENT },
      { type: "sources", items: [S.onssRetenue, S.check] },
      { type: "cta" },
    ],
  },

  // ------------------------------------------------------------------ Démo, mentions légales
  {
    cle: "demo",
    type: "demo",
    chemin: "demande-de-demo",
    titre: "Demander une démo de ZidarPro",
    description:
      "Demandez une démonstration de ZidarPro sur vos propres cas : vérification 30bis, contrats de sous-traitance, retenues et preuves de conformité.",
    h1: "Demander une démo",
    chapo:
      "30 minutes pour voir ZidarPro sur vos propres cas : sous-traitants, vérification 30bis, contrats et retenues.",
    majLe: MAJ,
    parents: ["accueil"],
    blocs: [{ type: "demo" }],
  },
  {
    cle: "legal",
    type: "legal",
    chemin: "mentions-legales",
    titre: "Mentions légales | ZidarPro",
    description:
      "Mentions légales du site ZidarPro : éditeur du site, adresse, contact, hébergement et données.",
    h1: "Mentions légales",
    majLe: MAJ,
    parents: ["accueil"],
    noindex: true,
    blocs: [],
  },
];

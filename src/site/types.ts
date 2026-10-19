/**
 * Site vitrine ZidarPro : types du contenu éditorial (FR / NL). Le contenu est un texte rédigé
 * (comme un CMS), pas des libellés d'interface : il vit dans `src/site/contenu/*.ts`, hors i18next.
 * Liens dans le texte : syntaxe `[texte](/chemin)` ou `[texte](https://…)`.
 */
export type LangueSite = "fr" | "nl";

export type Source = { titre: string; url: string; consulteLe: string };

export type Bloc =
  | { type: "h2"; texte: string; id?: string }
  | { type: "p"; texte: string }
  | { type: "liste"; items: string[] }
  | { type: "reponse"; titre: string; texte: string }
  | { type: "etapes"; items: { titre: string; texte: string }[] }
  | { type: "cartes"; items: { titre: string; texte: string; lien?: string }[] }
  | { type: "tableau"; entetes: string[]; lignes: string[][] }
  | { type: "faq"; items: { q: string; r: string }[] }
  | { type: "modele"; fichier: string; libelle: string; description: string }
  | { type: "sources"; items: Source[] }
  | { type: "avertissement"; texte: string }
  | {
      type: "illustration";
      variante: "verification" | "retenue" | "conformite" | "devis" | "chantier";
    }
  | { type: "cta"; texte?: string }
  | { type: "demo" };

export type TypePage =
  | "accueil"
  | "fonction"
  | "tarifs"
  | "faq"
  | "guides"
  | "guide"
  | "demo"
  | "legal";

export type PageSite = {
  /** Identifiant commun aux langues (relie /fr/... et /nl/...). */
  cle: string;
  type: TypePage;
  /** Chemin sans préfixe de langue ("" = accueil). */
  chemin: string;
  /** Balise <title> (60 caractères maximum, marque comprise). */
  titre: string;
  /** Meta description (155 caractères maximum). */
  description: string;
  h1: string;
  chapo?: string;
  blocs: Bloc[];
  /** Date de mise à jour du contenu (AAAA-MM-JJ). */
  majLe: string;
  /** Fil d'Ariane : clés des pages parentes. */
  parents?: string[];
  /** Exclure du sitemap et indexation (ex. page en attente d'informations). */
  noindex?: boolean;
};

/** Libellés de l'habillage du site (en-tête, pied, boutons), par langue. */
export type InterfaceSite = {
  langueNom: string;
  nav: { fonctions: string; tarifs: string; guides: string; faq: string; connexion: string };
  demo: string;
  autreLangue: string;
  piedTexte: string;
  piedFonctions: string;
  piedRessources: string;
  piedLegal: string;
  mentionsLegales: string;
  majLe: string;
  sources: string;
  consulteLe: string;
  telecharger: string;
  reponse: string;
  ariane: string;
  accueil: string;
  ouvrirApp: string;
  formulaire: {
    titre: string;
    nom: string;
    societe: string;
    email: string;
    telephone: string;
    message: string;
    envoyer: string;
    note: string;
    indisponible: string;
    sujet: string;
  };
  illustration: string;
  legal: { enAttente: string; editeur: string; adresse: string; bce: string; contact: string };
  illus: Record<
    "verification" | "retenue" | "conformite" | "devis" | "chantier",
    {
      titre: string;
      lignes: { libelle: string; valeur: string; etat: "ok" | "alerte" | "neutre" }[];
    }
  >;
};

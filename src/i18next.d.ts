// Typage des clés de traduction : le français est la référence.
// Ajouter ici chaque nouveau namespace créé dans src/locales/fr/.
import "i18next";
import type common from "./locales/fr/common.json";
import type statuts from "./locales/fr/statuts.json";
import type nav from "./locales/fr/nav.json";
import type auth from "./locales/fr/auth.json";
import type dashboard from "./locales/fr/dashboard.json";
import type chantiers from "./locales/fr/chantiers.json";
import type clients from "./locales/fr/clients.json";
import type devis from "./locales/fr/devis.json";
import type personnel from "./locales/fr/personnel.json";
import type vehicules from "./locales/fr/vehicules.json";
import type stock from "./locales/fr/stock.json";
import type precompte from "./locales/fr/precompte.json";
import type tva from "./locales/fr/tva.json";
import type assistant from "./locales/fr/assistant.json";
import type profil from "./locales/fr/profil.json";
import type pdf from "./locales/fr/pdf.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: {
      common: typeof common;
      statuts: typeof statuts;
      nav: typeof nav;
      auth: typeof auth;
      dashboard: typeof dashboard;
      chantiers: typeof chantiers;
      clients: typeof clients;
      devis: typeof devis;
      personnel: typeof personnel;
      vehicules: typeof vehicules;
      stock: typeof stock;
      precompte: typeof precompte;
      tva: typeof tva;
      assistant: typeof assistant;
      profil: typeof profil;
      pdf: typeof pdf;
    };
  }
}

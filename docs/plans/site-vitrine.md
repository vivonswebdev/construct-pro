# Plan — site vitrine ZidarPro et référencement (Google et recherches IA)

État au 19/10/2026. Basé sur `docs/seo/recherche-mots-cles.md`. Plan seulement : chaque étape
fera l'objet d'une PR séparée, non fusionnée par Claude. **Aucune migration** (contenu statique).

## Constat technique

- **Seule la page de connexion est publique.** `/` affiche un indicateur de chargement puis
  redirige vers la connexion : Google y voit une page vide. `/signer/$token` est en `noindex`
  (à garder).
- **Ni `robots.txt` ni `sitemap.xml`**, pas de données structurées. `<html lang="fr">` est fixe,
  quelle que soit la langue de la page.
- **Pas de domaine** : l'application tourne sur une adresse Lovable ; `zidarpro.be` est libre.
- **Atout** : TanStack Start fait le **rendu côté serveur (SSR)**. Les pages arrivent complètes
  chez Google et chez les robots des IA, sans dépendre du JavaScript.

## Choix d'architecture

- **Même application, pages publiques séparées** :
  - le site vitrine vit dans de nouvelles routes publiques (`src/routes/(site)/…`), sans
    connexion, rendues côté serveur ;
  - l'application garde ses routes actuelles.
  - Avantages : un seul déploiement Lovable, la même marque et le même domaine.
- **Langues dans l'URL** : `/fr/…`, `/nl/…`, `/en/…`, avec `hreflang` et `x-default`.
  - `<html lang>` suit la langue de la page.
  - RO et PL ne concernent que l'interface (les clients visés sont belges) : à ajouter plus tard si
    utile.
- **Accueil** : `/` montre le site vitrine aux visiteurs et redirige vers le tableau de bord un
  utilisateur déjà connecté. La langue est détectée depuis le navigateur, avec un lien vers les
  autres langues.
- **Domaine** : `zidarpro.be` pour le site et l'application (à réserver par Youssef). Toutes les
  pages déclarent leur URL **canonique** sur ce domaine dès qu'il existe.

## Arborescence (FR / NL / EN)

| Page                                                              | FR                                            | NL                                             | Mots-clés visés                                                                                             |
| ----------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Accueil                                                           | `/fr`                                         | `/nl`                                          | ZidarPro, logiciel construction Belgique, bouwsoftware                                                      |
| Sous-traitants et 30bis                                           | `/fr/fonctionnalites/sous-traitance-30bis`    | `/nl/functies/onderaanneming-inhoudingsplicht` | obligation de retenue, inhoudingsplicht, check inhoudingsplicht                                             |
| Devis et factures (autoliquidation, TVA 6 %)                      | `/fr/fonctionnalites/devis-factures`          | `/nl/functies/offertes-facturen`               | autoliquidation, btw verlegd, tva 6 %                                                                       |
| Chantiers, présences, journal                                     | `/fr/fonctionnalites/chantiers`               | `/nl/functies/werven`                          | checkinatwork, journal de chantier                                                                          |
| Tarifs                                                            | `/fr/tarifs`                                  | `/nl/prijzen`                                  | logiciel construction prix                                                                                  |
| FAQ                                                               | `/fr/faq`                                     | `/nl/faq`                                      | questions de tous les clusters                                                                              |
| Guides (hub)                                                      | `/fr/guides`                                  | `/nl/gidsen`                                   | —                                                                                                           |
| Guide « Obligation de retenue 30bis : vérifier un sous-traitant » | `/fr/guides/obligation-de-retenue-30bis`      | `/nl/gidsen/inhoudingsplicht`                  | check obligation de retenue / check inhoudingsplicht, inhoudingsplicht controleren, wat is inhoudingsplicht |
| Guide « Facture en autoliquidation : modèle et mentions »         | `/fr/guides/facture-autoliquidation`          | `/nl/gidsen/factuur-btw-verlegd`               | factuur btw verlegd, voorbeeld factuur btw verlegd, medecontractant                                         |
| Guide « Checkinatwork : qui, quand, comment »                     | `/fr/guides/checkinatwork`                    | `/nl/gidsen/checkinatwork`                     | checkinatwork, check in at work                                                                             |
| Guide « Limosa et sous-traitants étrangers »                      | `/fr/guides/limosa`                           | `/nl/gidsen/limosa`                            | limosa                                                                                                      |
| Guide « TVA 6 % en rénovation »                                   | `/fr/guides/tva-6-renovation`                 | `/nl/gidsen/btw-6-renovatie`                   | tva 6 %, btw 6 procent                                                                                      |
| Mentions légales, confidentialité                                 | `/fr/mentions-legales`, `/fr/confidentialite` | idem NL                                        | (confiance, RGPD)                                                                                           |

**Ordre de publication** :

1. accueil, 30bis et autoliquidation (FR + NL) ;
2. Checkinatwork, TVA 6 %, FAQ, tarifs ;
3. Limosa, primes rénovation, EN.

## Contenu des guides (pensé pour Google et les IA)

- **Réponse directe en tête** : 2 à 3 phrases qui répondent à la question. Les résumés IA de
  Google, ChatGPT et Perplexity citent ce type de passage.
- **Étapes numérotées**, tableaux (taux, délais, sanctions), exemple chiffré, **modèle
  téléchargeable** (facture en autoliquidation, checklist 30bis).
- **Sources officielles citées et datées** (SPF Finances, ONSS / RSZ, VLAIO), avec la mention
  « indicatif — à valider par votre comptable ». Jamais de taux en dur sans source ni date
  (règle du projet).
- **Lien vers l'outil officiel** (Check Inhoudingsplicht) **et** vers ZidarPro, qui automatise la
  vérification du jour avant chaque paiement, la capture et la retenue plafonnée.
- **Auteur et date de mise à jour** visibles ; relecture par un comptable avant publication.

## Technique SEO (équivalent de Yoast, intégré au code)

- **Par page** : `<title>` unique (≤ 60 caractères), meta description (≤ 155), canonique,
  `hreflang`, Open Graph et image de partage aux couleurs ZidarPro, un seul `<h1>`.
- **Données structurées JSON-LD** (vérifiées avec le _Rich Results Test_) :
  - `Organization` (logo, réseaux) et `WebSite` ;
  - `SoftwareApplication` (catégorie BusinessApplication, prix une fois fixés) ;
  - `FAQPage` sur la FAQ et les guides ;
  - `HowTo` sur les guides à étapes ;
  - `BreadcrumbList` ;
  - `Article` (auteur, dates).
- **`robots.txt`** : site autorisé, application (`/dashboard`, `/admin`…) et `/signer/` exclus ;
  lien vers le sitemap. **`sitemap.xml`** généré, multilingue.
- **Recherches IA** :
  - `llms.txt` à la racine : présentation de ZidarPro et liens vers les guides ;
  - contenu factuel et sourcé ;
  - robots des IA autorisés sur le site vitrine, mais pas sur l'application.
- **Performance** (_PageSpeed Insights_) :
  - pages vitrine sans les bibliothèques de l'application (graphiques, PDF) ;
  - images en WebP avec dimensions ;
  - polices préchargées.
  - Objectifs : LCP < 2,5 s, CLS < 0,1, INP < 200 ms.
- **Liens cassés** (équivalent de _Screaming Frog_) : script de contrôle des liens et des statuts
  HTTP lancé avant chaque publication (`scripts/seo/verifier-liens.ts`) ; Screaming Frog en
  complément, sur le poste de Youssef.

## Mesure (par Youssef, avec ses comptes)

1. Réserver `zidarpro.be` et le relier à Lovable.
2. **Google Search Console** :
   - ajouter la propriété du domaine (vérification DNS) ;
   - soumettre le sitemap ;
   - m'envoyer les exports « Performances » une fois par mois. Je les analyse : pages, requêtes,
     positions, taux de clic.
3. **Keyword Planner / Ubersuggest** : exporter les volumes des mots-clés de
   `recherche-mots-cles.md` (Belgique, FR et NL) pour fixer les priorités chiffrées.
4. **Bing Webmaster Tools** (alimente aussi ChatGPT et Copilot) : importer la propriété depuis
   Search Console.
5. **Google Business Profile** : si une adresse professionnelle peut être publiée.

## PR prévues

| PR  | Contenu                                                                                                                                                                                                          | Migration |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1   | Socle : routes publiques multilingues, `/` vitrine, `<html lang>` dynamique, composants SEO (title, description, canonique, hreflang, JSON-LD), `robots.txt`, `sitemap.xml`, `llms.txt`, en-tête et pied du site | Non       |
| 2   | Accueil + fonctions 30bis et devis/factures (FR + NL) + FAQ, contenus à valider par Youssef                                                                                                                      | Non       |
| 3   | Guides 30bis et autoliquidation (FR + NL) avec modèles téléchargeables, relus par un comptable                                                                                                                   | Non       |
| 4   | Checkinatwork, TVA 6 %, tarifs, EN ; script de contrôle des liens ; audit PageSpeed                                                                                                                              | Non       |

## Questions pour Youssef

1. **Tarifs** : publier des prix (et lesquels) ou « sur demande » ?
2. **Inscription libre** sur le site (essai gratuit), ou demande de démo ?
3. **Nom de l'éditeur** et adresse pour les mentions légales et les données structurées
   `Organization`.
4. **Relecteur comptable** pour les guides (taux, délais, sanctions).
5. **Captures d'écran** du produit : à partir d'un compte démo (données fictives) ?

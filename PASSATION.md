# PASSATION — ConstructFlow

> Document de passation destiné à **Claude Code**. À placer à la racine du dépôt.
> Il décrit l'existant (projet généré par Lovable), la cible fonctionnelle et l'ordre de réalisation.
> Porteur du projet : Youssef (FiscoTeam, fiduciaire belge). Langue de travail : **français**.

---

## 0. Instructions pour Claude Code (à lire en premier)

1. **Lis tout ce document**, puis explore le dépôt (`src/routes/_app/*`, `src/lib/*`, `supabase/migrations/*`, `src/integrations/supabase/types.ts`) avant d'écrire du code.
2. Travaille **phase par phase** (section 6), dans l'ordre. Une phase = une branche `phase-XX-nom` = un ou plusieurs commits propres. Ne démarre pas la phase suivante tant que les critères d'acceptation de la phase en cours ne sont pas remplis.
3. **Au début de chaque phase** : présente un plan court (tables, routes, composants, risques) et attends la validation si un choix structurant n'est pas tranché dans ce document.
4. **Toute modification de schéma = une nouvelle migration SQL** dans `supabase/migrations/` (jamais de modification d'une migration existante). Chaque nouvelle table a `company_id`, RLS activée et les 4 policies calquées sur l'existant (`get_user_company_id(auth.uid())`).
5. Régénère/maintiens `src/integrations/supabase/types.ts` après chaque migration. Supprime progressivement les `as any` existants (`factures`, `materiaux`, `vehicules`…).
6. **Ne casse pas l'existant** : après chaque phase, `bun run build` et `bun run lint` passent, les pages existantes s'affichent.
7. Aucune clé secrète côté front. Les appels IA, emails et webhooks passent par des **server functions** (`createServerFn` + `requireSupabaseAuth`) ou des routes serveur.
8. Toute règle fiscale ou sociale belge est **paramétrable** (table de paramètres) et affichée avec la mention « indicatif — à valider par votre comptable / secrétariat social ». Ne code jamais un taux légal en dur dans un composant.
9. Tiens à jour `docs/JOURNAL.md` (ce qui a été fait, décisions prises, points ouverts) et crée `CLAUDE.md` avec les conventions de la section 4.
10. En cas de doute métier, **pose la question** plutôt que d'inventer.

---

## 1. Contexte produit

**ConstructFlow** est un SaaS de gestion pour les **PME belges de la construction** (entrepreneurs généraux, rénovation, gros œuvre, 2 à 50 personnes).
Promesse : chantiers, personnel, heures, flotte, stock, devis, conformité sociale belge et site vitrine dans un seul outil, en FR/NL/EN (+ RO/PL pour les ouvriers).

Différenciation : obligations propres au secteur en Belgique (30bis, autoliquidation, TVA 6 %, CP 124, Checkinatwork, ATN, primes rénovation par région) et lien naturel avec la fiduciaire (exports, rapport mensuel).

**Hors périmètre actuel (projets futurs)** : facturation de vente (attente d'un accès API Peppol), Belcotax, synchronisation de boîte mail entrante, sous-domaines wildcard actifs.

---

## 2. Existant (projet Lovable)

### 2.1 Stack
- **TanStack Start** (React, SSR, routing fichiers `src/routes`, `createServerFn`), TanStack Query, TypeScript, Tailwind, shadcn/ui, lucide-react, sonner, zod, **bun**.
- **Supabase** (Postgres + Auth + RLS + Storage). Client : `src/integrations/supabase/client.ts`, serveur : `client.server.ts`, middleware d'auth : `auth-middleware.ts`.
- IA : gateway Lovable (`https://ai.gateway.lovable.dev/v1/chat/completions`, `LOVABLE_API_KEY`, modèle `google/gemini-2.5-flash`) dans `src/lib/assistant.functions.ts`.
  → **Décision à prendre avec Youssef** : garder le gateway Lovable (si le projet reste hébergé sur Lovable) ou passer à l'API Anthropic. Encapsule l'appel IA dans `src/lib/ai.server.ts` (fonction `chat()` et `chatWithTools()`) pour pouvoir changer de fournisseur sans toucher au reste.

### 2.2 Routes existantes (`src/routes/_app/`)
`dashboard`, `chantiers.index`, `chantiers.$id`, `personnel.index`, `personnel.$id`, `vehicules.index`, `vehicules.$id`, `stock.index`, `facturation.index`, `facturation.$id`, `conformite-tva`, `precompte`, `assistant`, `profil`. Plus `login`, `index`, layout `_app.tsx`, `Sidebar.tsx`.

### 2.3 Tables existantes
`companies`, `profiles`, `chantiers`, `etapes`, `personnel`, `presence`, `affectations`, `vehicules`, `vehicule_affectations`, `tva_checks`, `salary_payments`, `precompte_payments`, `onss_payments`, `factures` (type devis/facture), `facture_lignes`, `materiaux`, `stock_mouvements`.
Fonction RLS : `get_user_company_id(uuid)`.

### 2.4 Helpers
- `src/lib/belgian.ts` : `formatEURBE`, `isValidVAT`, `quarterOfMonth`, `onssDueDate`, `precompteDueDate`, `DEFAULTS` (taux).
- `src/lib/pdf.ts`, `src/lib/invoice-pdf.ts` : génération PDF.
- `src/lib/seed.ts` : données de démo (`seedDataIfEmpty`).

### 2.5 Bugs et dettes identifiés
| # | Problème | Cause | Correction attendue |
|---|---|---|---|
| B1 | Doublons dans la démo (chantiers, personnel) | `seedDataIfEmpty` appelé dans un `useEffect` de `_app.tsx` ; deux appels concurrents passent le test « 0 chantier » | Colonne `companies.demo_seeded` + RPC `seed_lock(company_id)` atomique (`UPDATE … WHERE demo_seeded = false RETURNING id`) + `useRef` ; nettoyage des doublons |
| B2 | « SPRL » dans la démo | Forme supprimée par le CSA (2019) | Remplacer par « SRL » partout |
| B3 | Tous les chantiers démo en retard | Seed peu réaliste | Statuts variés |
| B4 | Module Précompte/ONSS : calculs faux | Précompte sur brut (au lieu de brut − ONSS perso), ONSS ouvrier sans base 108 %, pas de provisions ONSS mensuelles, précompte suivi par ouvrier au lieu de par société, taux non persistés (useState) | Refonte phase 3 |
| B5 | `as any` sur plusieurs tables | Types Supabase non régénérés | Régénérer les types |
| B6 | Vérifier le contenu de `.env` | Présent dans l'archive | S'assurer qu'aucune clé secrète n'est commitée ; seules les clés publiques Supabase côté front |

---

## 3. Architecture cible

### 3.1 Menu (sidebar)
```
Dashboard
Agenda
Chantiers            (onglets : Infos, Estimation, Planning, Rentabilité, Journal, Travaux supp., Sous-traitants, Matériel, Déchets, Documents)
Clients
Devis
Personnel            (onglets : Liste, Horaires/Timesheet, Conformité)
Sous-traitants & Conformité
Véhicules            (onglet ATN pour les voitures)
Matériel & Location
Stock
Achats
Précompte & ONSS     (suivi des échéances)
Conformité TVA
Mon site web         (Configuration, Réalisations, Demandes, Avis)
Assistant IA
Mon profil           (Société, Paramètres fiscaux, Bibliothèque de postes, Emails, CG, Intégrations)
— Bientôt disponible —
Facturation (Peppol)
Belcotax
```

### 3.2 Routes publiques (sans auth, SSR)
- `/s/$slug` : site vitrine de l'entreprise
- `/avis/$token` : dépôt d'un avis client
- `/devis/$token` : consultation + acceptation/signature d'un devis, avenant ou contrat
- `/m` : application mobile ouvrier (PWA, auth requise mais interface dédiée)

### 3.3 Nouvelles tables (vue d'ensemble)
`company_settings`, `clients`, `sites`, `site_realisations`, `site_demandes`, `avis`, `emails_envoyes`, `email_modeles`, `evenements`, `postes_types`, `sous_traitants`, `chantier_sous_traitants`, `verifications_30bis`, `documents_conformite`, `conditions_generales` (versionnées), `documents_signes` (devis/avenants/contrats/PV), `journal_entrees`, `travaux_supplementaires`, `fournisseurs`, `achats`, `achat_lignes`, `equipements`, `dechets`, `primes_regles` (globale, gérée par l'admin plateforme), `atn_parametres`, `traductions`, `rapports_mensuels`, `integrations`.
Le détail des colonnes est donné dans chaque phase.

---

## 4. Conventions (à reprendre dans `CLAUDE.md`)

- **Langue du code** : noms de tables et colonnes en français snake_case (cohérent avec l'existant), code TS en camelCase.
- **Multi-société** : chaque ligne porte `company_id` ; RLS systématique. Ressources publiques : policies `anon` strictement limitées (publié = true, token valide) ou via RPC `security definer`.
- **Valeurs d'énumération** : codes neutres en base (`en_cours`, `accepte`), traduits à l'affichage via i18n.
- **Formats belges** : montants `245 000,00 €` (`formatEURBE`), dates JJ/MM/AAAA, TVA `BE0123 456 789`.
- **Validation** : zod sur toutes les entrées serveur et formulaires.
- **Données fiscales/sociales** : tables de paramètres datées + bandeau « indicatif ».
- **IA** : jamais d'écriture directe en base par l'IA. L'IA produit un brouillon, l'utilisateur confirme.
- **Fichiers** : Supabase Storage, un bucket par usage (`logos`, `sites`, `chantiers`, `documents`, `achats`), chemins préfixés par `company_id`.
- **i18n** : aucune chaîne visible en dur (voir phase 1).
- **Accessibilité / mobile** : toutes les pages utilisables sur tablette ; `/m` pensé pour téléphone.

---

## 5. Règles métier belges (référence)

> Toutes ces valeurs vont dans des tables de paramètres, avec la date de vérification. Youssef valide les valeurs de l'année en cours.

- **TVA** : 21 / 12 / 6 / 0 %. **Autoliquidation** (cocontractant) pour travaux immobiliers facturés à un client assujetti déposant des déclarations périodiques : TVA 0 % + mention « Autoliquidation – Art. 20 AR n°1 TVA ». **6 %** : rénovation de logements de plus de 10 ans, attestation du client requise.
- **Précompte professionnel** : versement société mensuel (déclaration 274), échéance le 15 du mois suivant. Base indicative = brut − ONSS personnelle.
- **ONSS** : provisions mensuelles (le 5 du mois suivant), solde trimestriel (fin du mois suivant le trimestre). Ouvriers : cotisation personnelle 13,07 % sur 108 % du brut. La paie officielle vient du **secrétariat social** : l'app suit les échéances, elle ne remplace pas la paie.
- **CP 124** (construction) : timbres fidélité/intempéries (Constructiv), chômage temporaire intempéries.
- **30bis / 30ter** : vérification des dettes sociales et fiscales du cocontractant avant paiement ; retenue 35 % (ONSS) / 15 % (SPF Finances) si dette. Conserver la preuve datée de la vérification. Déclaration de travaux.
- **Checkinatwork** : enregistrement des présences sur les chantiers au-delà d'un seuil (paramètre, par défaut 500 000 € HTVA).
- **ATN voiture** : valeur catalogue × 6/7 × coefficient d'âge × % CO2. % CO2 = 5,5 % ± 0,1 %/g par rapport au CO2 de référence de l'année (min 4 %, max 18 %) ; électrique 4 %. Coefficient d'âge : 100 % puis −6 % par année entamée, minimum 70 %. Minimum annuel légal. Paramètres annuels dans `atn_parametres`.
- **Facturation électronique** : Peppol obligatoire en B2B depuis le 01/01/2026, d'où la facturation mise en « Bientôt ».
- **Mentions légales** (site, devis, CG) : dénomination, forme juridique, siège, BCE, TVA, email.
- **B2C** : droit de rétractation 14 jours pour contrats hors établissement ; régime encadré des clauses pénales et intérêts de retard ; loi Breyne pour le résidentiel neuf avec acomptes. CG = **modèles indicatifs à faire valider par un juriste**.
- **Régions** (déduites du code postal) : Bruxelles 1000–1299 ; Wallonie 1300–1499 et 4000–7999 ; Flandre le reste. Primes : Rénolution (BXL), primes habitation (WAL), Mijn VerbouwPremie (VL). Déchets en Flandre : sloopopvolgingsplan / Tracimat, asbestattest.
- **Faux indépendants** : critères spécifiques au secteur de la construction ; afficher un avertissement, jamais un verdict.

---

## 6. Plan de réalisation par phases

Chaque phase liste : objectif, tables, écrans, règles, **critères d'acceptation (CA)**.

### Phase 0 — Mise en place et corrections
- Créer `CLAUDE.md`, `docs/JOURNAL.md`, régénérer les types, retirer les `as any`.
- Corriger B1, B2, B3, B5, B6.
- Créer `company_settings` (company_id unique, taux paramétrés, marge cible, coefficient coût chargé, heures/jour, marge intempéries %, seuil Checkinatwork, couleur, IBAN/BIC).
- Créer `src/lib/ai.server.ts` (abstraction fournisseur IA).
- **CA** : plus aucun doublon après 10 rechargements ; build et lint OK ; démo « Démo Construction SRL ».

### Phase 1 — Multilingue (i18n)
- react-i18next, `src/locales/{fr,nl,en,ro,pl}.json` par module ; fr = défaut et secours.
- Toutes les chaînes extraites (sidebar, titres, boutons, formulaires, toasts, statuts, états vides). Pluriels i18next (y compris PL/RO).
- Terminologie métier correcte (NL : werf, bestek, onderaannemer, oplevering…).
- `profiles.langue`, `personnel.langue`, `clients.langue` (FR/NL/EN) ; sélecteur avec drapeau ; détection navigateur.
- Documents officiels (devis, contrats, CG, emails) : FR/NL/EN selon la langue du client.
- Contenu saisi : `translateText()` serveur + table `traductions` (cache) ; bouton « Traduire » / « Voir l'original ».
- Script de test des clés manquantes entre les 5 fichiers.
- **CA** : changement de langue instantané sur tout l'écran ; test des clés vert ; aucune chaîne en dur (grep).

### Phase 2 — Clients, Devis uniquement, démo enrichie
- Table `clients` (type particulier/entreprise, nom, prénom, raison_sociale, numero_bce, numero_tva, assujetti_tva, adresse, code_postal, ville, email, telephone, langue, statut client/prospect, notes).
- `chantiers.client_id`, `factures.client_id` ; migration des `client_name` texte vers `clients`.
- Menu **Clients** (liste + fiche : chantiers, devis, totaux).
- « Devis & Factures » devient **Devis** : statuts brouillon/envoyé/accepté/refusé/expiré, validité 30 j, dupliquer, « Créer le chantier » depuis un devis accepté, TVA par ligne, autoliquidation automatique si client assujetti, case attestation 6 %.
- « Facturation (Peppol) » dans *Bientôt disponible*. Dashboard : KPI factures remplacés par « Devis en attente » et « Taux d'acceptation ».
- Seed : 6 clients, 7 véhicules (dont voiture dirigeant hybride), 20 matériaux (3 sous le minimum) avec mouvements, 8 devis détaillés.
- **CA** : aucun écran ne permet de créer une facture ; un devis pour client assujetti propose l'autoliquidation.

### Phase 3 — Timesheet, Précompte/ONSS, ATN
- **Timesheet** (sur `presence`, adaptée) : grille semaine ouvriers × jours ; cellule = heures + chantier + code (Travail, Congé, Maladie, Intempéries, Férié, Formation, Absence) ; « Semaine type », « Copier semaine précédente », sélection multiple ; horaire type par ouvrier ; heures sup en surbrillance ; export CSV/Excel mensuel pour le secrétariat social ; heures × coût alimentent la rentabilité.
- **Précompte & ONSS** refondu en suivi d'échéances (voir §5) : saisie ou import CSV des montants du secrétariat social ; défauts basés sur les heures réelles ; précompte = 1 versement société/mois ; provisions ONSS mensuelles + solde trimestriel ; taux persistés dans `company_settings` ; alertes à 7 jours et retards au dashboard.
- **ATN** : champs véhicule `valeur_catalogue`, `date_premiere_immatriculation`, `carburant`, `co2_g_km`, `usage_prive`, `beneficiaire_id` ; table `atn_parametres` (annee, co2_ref_essence, co2_ref_diesel, minimum_annuel, date_verification) éditable dans Mon profil > Paramètres fiscaux ; affichage annuel/mensuel + détail + simulation.
- **CA** : tests unitaires du calcul ATN (âge, plancher/plafond %, minimum, électrique) ; les heures saisies modifient la rentabilité du chantier.

### Phase 4 — Assistant IA avec outils
- Function calling : `search_clients`, `search_chantiers`, `create_client`, `create_devis`, `create_personnel`, `create_vehicule`, `create_materiau`, `add_stock_mouvement`, `draft_email`.
- Les outils renvoient un **brouillon** ; le chat affiche une carte de prévisualisation (Confirmer / Modifier → formulaire prérempli / Annuler) ; insertion au clic seulement, avec le client authentifié (RLS).
- Validation zod des arguments ; l'IA demande les champs manquants au lieu d'inventer.
- Contexte : clients, devis, timesheet de la semaine, échéances ; plus de factures. 4 suggestions cliquables.
- **CA** : « Crée un devis rénovation salle de bain 8 m² pour Dupont à Namur » produit un brouillon cohérent, rien n'est écrit sans clic.

### Phase 5 — Site web généré
- Tables `sites`, `site_realisations`, `site_demandes` (colonnes : voir prompt d'origine en annexe A) ; bucket public `sites` ; slugs réservés.
- Admin « Mon site web » : slug avec vérification de disponibilité, 3 templates, génération IA des textes (FR, NL si bilingue), réalisations depuis chantiers terminés (**jamais de nom ni d'adresse exacte de particulier**), demandes reçues → « Créer le client » (prospect) / « Préparer un devis » (assistant), aperçu, publier/dépublier, QR code.
- Public `/s/$slug` en SSR : hero, services, réalisations (lightbox), zones, à propos, formulaire de devis (3 photos max, consentement RGPD, honeypot, rate limit), contact, mentions légales auto, politique de confidentialité, SEO (meta, OG, JSON-LD LocalBusiness/GeneralContractor), sitemap, robots.
- `getSiteSlug(request)` compatible chemin **et** sous-domaine ; `sites.domaine_personnalise` ; `docs/SOUS-DOMAINES.md` (DNS wildcard + Worker Cloudflare).
- **CA** : site démo publié, score Lighthouse ≥ 90 (perf/SEO), une demande crée une ligne visible dans l'admin.

### Phase 6 — Avis clients
- Table `avis` (token unique à usage unique, note 1-5, commentaire, prénom affiché, ville, type travaux, statut, réponse). RPC `submit_avis`.
- Chantier « Terminé » → proposition de demande d'avis (email + 1 relance à J+7). Page `/avis/$token` avec consentement de publication.
- Publication uniquement après validation ; l'entrepreneur ne peut pas modifier un avis. Section avis + note agrégée JSON-LD sur le site.
- **CA** : un token utilisé ne fonctionne plus ; un avis non validé n'apparaît jamais publiquement.

### Phase 7 — Emails et agenda
- **Emails sortants** via Resend (secret serveur) ; expéditeur `Nom société <noreply@…>`, reply-to société ; modèles éditables FR/NL/EN avec variables ; `emails_envoyes` + historique dans fiches client/chantier ; relances automatiques de devis paramétrables.
- **Agenda** : table `evenements` (types, début/fin, chantier, client, personnel_ids, vehicule_id, lieu, rappel) ; vues jour/semaine/mois/ressources ; glisser-déposer ; affichage en lecture des échéances (chantiers, précompte/ONSS, véhicules, documents, validité devis, locations) ; détection de conflits ; flux iCal privé par utilisateur.
- **CA** : conflit détecté si un ouvrier est planifié deux fois ; le flux .ics s'importe dans Google Calendar.

### Phase 8 — Estimation, planning, rentabilité
- `postes_types` (catégorie, libellé, unité, prix vente, coût matériaux, heures/unité, nb ouvriers recommandé, matériaux liés) préremplie (~40 postes) ; lignes de devis depuis la bibliothèque.
- `personnel.cout_horaire_charge` (défaut = taux × coefficient `company_settings`).
- Estimation : heures totales ; nb ouvriers → durée en jours ouvrables ; date de fin → nb ouvriers ; week-ends, **jours fériés belges** (Pâques calculé), marge intempéries ; disponibilité réelle ; Gantt simple.
- Rentabilité : prévu vs réel par poste (main-d'œuvre, matériaux, sous-traitance, véhicules, location, déchets, divers) ; marge € et % ; avancement vs budget consommé ; alertes 80 %/100 % ; projection à terminaison ; dashboard mis à jour.
- **CA** : tests unitaires du calcul de jours ouvrables (fériés inclus) ; la marge réelle change quand on ajoute des heures ou une sortie de stock.

### Phase 9 — Sous-traitants et conformité
- `sous_traitants`, `chantier_sous_traitants`, `verifications_30bis` (date, résultat, preuve), `documents_conformite` (entite_type personnel/sous_traitant/dirigeant/societe, type, fichier, dates, statut calculé).
- Paiement d'un sous-traitant : bouton « Vérifier les dettes » (lien vers le service officiel, BCE prérempli, enregistrement manuel du résultat daté + capture) ; si dette : calcul de la retenue et blocage du paiement complet.
- Checklists paramétrables par statut (indépendant, associé actif, dirigeant, salarié, sous-traitant, société) : BCE, caisse d'assurances sociales, accès à la profession selon la région, RC, décennale, VCA, Limosa, Dimona, permis, examen médical, formations, ConstruBadge…
- Tableau de bord feu tricolore ; alertes à 30 jours ; blocage optionnel d'affectation ; rappel Checkinatwork ; avertissement faux indépendant.
- Démo : 5 sous-traitants (1 document expiré, 1 dette constatée).
- **CA** : impossible d'enregistrer un paiement complet à un sous-traitant avec dette sans calcul de retenue.

### Phase 10 — Devis pro, CG, contrats, signature
- Mon profil > Société : logo, couleur, IBAN/BIC, mentions légales (réutilisés partout).
- PDF devis refait : logo, couleur, lignes par catégorie, récap TVA par taux, autoliquidation/6 %, échéancier d'acomptes, CG en annexe, 3 mises en page, FR/NL/EN.
- Signature en ligne `/devis/$token` : acceptation des CG, signature dessinée, horodatage, IP, **hash SHA-256 du PDF accepté** ; table `documents_signes`.
- `conditions_generales` versionnées (B2B / B2C) générées par l'IA puis éditables ; le devis référence la version acceptée ; bandeau « à faire valider par un juriste ».
- Génération : contrat d'entreprise, contrat de sous-traitance (clauses 30bis/sécurité), PV de réception provisoire/définitive (signature sur tablette), avenants.
- **CA** : modifier les CG après signature ne modifie pas la version liée au devis signé.

### Phase 11 — Journal de chantier mobile et travaux supplémentaires
- PWA `/m` (manifest, service worker, hors ligne avec file de synchronisation) : chantiers du jour, pointage arrivée/départ → timesheet, consignes dans la langue de l'ouvrier.
- `journal_entrees` (type note/photo/problème/livraison/visite/sécurité/intempérie, texte, langue originale, photos compressées, audio transcrit, géoloc, météo Open-Meteo) ; traduction via `translateText()` ; bouton « Journée d'intempéries » ; export PDF du journal.
- `travaux_supplementaires` (origine, photos, lignes, montant, impact délai, statuts) : création mobile, chiffrage gérant, signature client en ligne, bandeau « NE PAS EXÉCUTER avant signature », intégration budget/planning.
- **CA** : une note saisie hors ligne est synchronisée au retour du réseau ; une note en polonais est lisible en français par le gérant.

### Phase 12 — Achats fournisseurs
- `fournisseurs`, `achats`, `achat_lignes`.
- Entrées : email dédié (`achats+{slug}@…`, webhook Resend inbound) ; upload ; **UBL Peppol BIS Billing 3.0 parsé de façon déterministe** (sans IA, contrôle des totaux) ; PDF/photo extraits par IA (statut « à valider », champs incertains surlignés) ; endpoint `/api/hooks/achats` signé HMAC préparé pour un futur connecteur Peppol (inactif).
- Écran de validation document | données ; affectation des lignes aux chantiers et matériaux (suggestion) ; à la validation : entrée de stock + coût chantier + fournisseur créé.
- Doublons, alerte hausse de prix > 10 %, échéances fournisseurs dans l'agenda, export CSV/UBL pour le comptable.
- **CA** : un fichier UBL d'exemple est importé sans IA avec des totaux exacts ; un doublon est bloqué.

### Phase 13 — Matériel/location et déchets
- `equipements` (propre/loué, loueur, tarifs jour/semaine, caution, dates, chantier, contrôles périodiques) ; coût calculé et imputé ; alertes retour et contrôle ; visible agenda et mobile.
- `dechets` (type, volume/poids, conteneur, collecteur, enlèvement, bordereau, coût, destination) ; checklist par région (Flandre : sloopopvolgingsplan/Tracimat, asbestattest) ; amiante → avertissement « entreprise agréée requise » ; rapport PDF par chantier ; obligations dans une table paramétrable.
- **CA** : le coût de location suit le tarif le plus avantageux ; le coût des déchets apparaît dans la rentabilité.

### Phase 14 — Primes rénovation (3 régions)
- `primes_regles` globale (région, programme, type de travaux, conditions, montants par catégorie de revenus jsonb, documents requis, lien officiel, date de vérification), éditable par un rôle **admin plateforme**.
- Région auto depuis le code postal ; sur le devis : « Primes possibles » + annexe PDF optionnelle FR/NL/EN ; checklist de documents ; attestation entrepreneur préremplie si nécessaire ; rappel TVA 6 %.
- Bandeau « montants indicatifs » avec la date de vérification.
- **CA** : un devis à Gand propose les règles flamandes, à Ixelles les règles bruxelloises, à Namur les règles wallonnes.

### Phase 15 — Rapport mensuel automatique
- PDF aux couleurs de la société (FR/NL/EN) : activité commerciale, chantiers (marges, dépassements, projections), main-d'œuvre, achats, matériel/déchets, conformité, échéances du mois suivant, 3 à 5 suggestions IA marquées comme telles.
- `pg_cron` le 3 du mois → fonction serveur ; bouton « Générer maintenant » ; table `rapports_mensuels` + historique ; destinataires : gérant + option copie comptable/fiduciaire ; annexe Excel optionnelle.
- **CA** : génération manuelle fonctionnelle sur la démo ; le cron est planifié et documenté.

---

## 7. Qualité, sécurité, performance

- **Tests** : Vitest pour la logique pure (`belgian.ts`, ATN, jours ouvrables/fériés, retenue 30bis, parsing UBL, calcul rentabilité, parsing TVA). Un test par règle métier.
- **RLS** : pour chaque nouvelle table, vérifier qu'un utilisateur d'une autre société ne voit rien (script de test SQL ou test d'intégration).
- **Public** : rate limit + honeypot sur les formulaires publics ; tokens aléatoires ≥ 32 octets ; pas de données personnelles de particuliers sur le site.
- **Webhooks** : signature HMAC SHA-256, horodatage, rejet des rejouements.
- **Fichiers** : limites de taille, types MIME contrôlés, compression d'images côté client.
- **RGPD** : consentements enregistrés (date, texte), export et suppression des données d'un client sur demande.
- **Performance** : pagination serveur sur toutes les listes, index sur `company_id` et clés étrangères.

---

## 8. Points à valider par Youssef avant ou pendant le développement

1. Fournisseur IA : gateway Lovable ou API Anthropic ?
2. Hébergement cible : rester sur Lovable (sync GitHub) ou déployer ailleurs (Vercel/Netlify/Cloudflare, requis pour les sous-domaines wildcard) ?
3. Nom de domaine définitif (`constructflow.be` ?) et domaine d'envoi des emails (Resend).
4. Valeurs de l'année en cours : paramètres ATN, taux ONSS/précompte indicatifs, seuil Checkinatwork, règles de primes par région.
5. Coefficient de coût horaire chargé par défaut.
6. Relecture des fichiers de langue NL/RO/PL par un locuteur natif du secteur.
7. Relecture juridique des modèles de CG et contrats.
8. Modèle économique (plans, modules payants, option domaine personnalisé) : impacte la gestion des droits par module.

---

## 9. Définition de « terminé » pour chaque phase

- [ ] Migrations appliquées, types régénérés, aucune nouvelle occurrence de `as any`
- [ ] RLS testée (isolation entre sociétés)
- [ ] Chaînes traduites dans les 5 langues (clés présentes partout)
- [ ] Données de démo mises à jour pour la fonctionnalité
- [ ] Tests unitaires des règles métier de la phase
- [ ] `bun run build` et `bun run lint` OK
- [ ] `docs/JOURNAL.md` mis à jour (fait, décidé, reste à faire)
- [ ] Captures ou description des écrans ajoutées au résumé de la PR

---

## Annexe A — Détail des colonnes (reprise des spécifications d'origine)

**sites** : id, company_id (unique), slug (unique, `^[a-z0-9-]{3,40}$`), publie, template (`moderne|classique|artisan`), couleur_principale, logo_url, photo_couverture_url, slogan, a_propos, services jsonb `[{titre, description, icone}]`, zones_intervention text[], langues (`FR|NL|FR_NL`), horaires, telephone_public, email_public, afficher_bce, seo_titre, seo_description, domaine_personnalise, updated_at.
Slugs réservés : `www, app, api, admin, s, m, login, dashboard, mail, support, demo`.

**site_realisations** : id, site_id, chantier_id, titre, type_travaux, ville, annee, description, photos text[], ordre, visible.

**site_demandes** : id, company_id, nom, email, telephone, code_postal, type_travaux, description, budget_estime, photos text[], consentement_rgpd, statut (`nouvelle|traitee|convertie`), client_id, devis_id, created_at.

**avis** : id, company_id, chantier_id, client_id, token, note, commentaire, prenom_affiche, ville, type_travaux, statut (`en_attente|recu|publie|masque`), reponse_entreprise, envoye_le, recu_le, publie_le.

**evenements** : id, company_id, titre, type (`visite_technique|rdv_client|livraison|chantier|reception|echeance|autre`), debut, fin, journee_entiere, chantier_id, client_id, personnel_ids uuid[], vehicule_id, lieu, notes, rappel_minutes.

**postes_types** : id, company_id, categorie, libelle, unite (`m2|m3|m|piece|forfait`), prix_vente_ht, cout_materiaux_unitaire, heures_par_unite, nb_ouvriers_recommande, materiaux jsonb `[{materiau_id, quantite_par_unite}]`.

**sous_traitants** : id, company_id, raison_sociale, forme_juridique, numero_bce, numero_tva, contact, email, telephone, adresse, metiers text[], conditions, note_interne, statut (`actif|bloque`), commentaire.

**documents_conformite** : id, company_id, entite_type, entite_id, type_document, fichier_url, date_emission, date_expiration, statut (calculé : `valide|expire_bientot|expire|manquant`).

**journal_entrees** : id, company_id, chantier_id, auteur_id, date, type, texte, langue_originale, photos text[], audio_url, geoloc, meteo jsonb, created_at.

**travaux_supplementaires** : id, company_id, chantier_id, origine, description, photos, lignes jsonb, montant_ht, tva, impact_delai_jours, statut (`signale|chiffre|envoye|accepte|refuse|execute`), signe_le, document_signe_id.

**achats** : id, company_id, fournisseur_id, numero, date, echeance, montant_ht, tva, montant_ttc, source (`email|upload|ubl|peppol_connecteur|manuel`), fichier_url, xml_url, statut (`a_valider|valide|paye|conteste`), chantier_id.

**equipements** : id, company_id, nom, categorie, propriete (`propre|loue`), loueur_id, reference_contrat, tarif_jour, tarif_semaine, caution, date_debut, date_retour_prevue, date_retour_reelle, chantier_id, statut, date_controle, documents.

**dechets** : id, company_id, chantier_id, type, volume, poids, equipement_id, collecteur_id, date_enlevement, bordereau_url, cout, destination.

**primes_regles** : id, region (`BXL|WAL|VL`), programme, type_travaux, conditions, montants jsonb, documents_requis, lien_officiel, date_verification, actif.

**atn_parametres** : annee (PK), co2_ref_essence, co2_ref_diesel, minimum_annuel, date_verification, source.

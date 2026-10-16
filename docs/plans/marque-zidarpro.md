# Plan — identité visuelle ZidarPro et renommage progressif

État au 16/10/2026. Nom validé par Youssef : **ZidarPro** (« zidar » = maçon en roumain et en
serbo-croate). Branche `marque-zidarpro`, une PR non fusionnée. **Aucune migration, aucune action
sur la base de production.**

## 1. Logo

- **Symbole** : un Z construit en briques, d'après le visuel fourni.
  - Rangées du haut et du bas : briques bleu foncé et orange en quinconce.
  - Diagonale et rangée inférieure droite en biseau.
  - Géométrie unique dans `src/lib/marque.ts` (grille 64 × 64), réutilisée pour le composant React,
    le favicon, les fichiers SVG et le dessin vectoriel dans les PDF.
- **Couleurs** : bleu foncé `#0F2A43`, orange chantier `#F59E0B`, blanc.
- **Typographie** : **Inter** (déjà chargée par l'application : aucune police supplémentaire),
  graisse 800. « Zidar » en bleu (ou blanc), « Pro » en orange.
- **Déclinaisons** :
  - **claire** (fond blanc : PDF, documents) — briques bleues et orange, texte bleu et orange ;
  - **sombre** (fond bleu foncé : barre latérale, connexion) — briques blanches et orange, texte
    blanc et orange ;
  - **icône seule** (favicon, petites tailles) — symbole sans texte, sur fond bleu arrondi.
- **Fichiers** :
  - `docs/marque/` : SVG clair, sombre et icône, plus une charte courte (couleurs, zone de
    protection, taille minimale, usages interdits) ;
  - `public/` : `favicon.svg`, `favicon.ico` (16, 32, 48 px), `apple-touch-icon.png` (180 px),
    `icon-512.png`.
  - Les PNG et l'ICO sont produits par `scripts/marque/generer_icones.py` (Python sans
    dépendance) à partir de la même géométrie.
- **Limite** : dans les fichiers SVG autonomes, le texte reste du texte (police Inter, puis repli
  sur les polices système). Pour l'impression professionnelle (enseigne, véhicules), il faudra une
  version vectorisée par un graphiste.

## 2. Intégration (renommage progressif)

| Endroit                                                                        | Avant                                       | Après                                                                                               |
| ------------------------------------------------------------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Nom de l'application (`common:appName`, titres de page, copyright) — 5 langues | ConstructFlow                               | ZidarPro                                                                                            |
| Barre latérale                                                                 | monogramme « CF » + nom                     | logo ZidarPro sombre + nom de la société                                                            |
| Page de connexion                                                              | casque + nom                                | logo ZidarPro sombre                                                                                |
| Favicon                                                                        | aucun                                       | icône ZidarPro                                                                                      |
| Couleur de la barre latérale et de la connexion                                | `#1a2332`                                   | bleu de marque `#0F2A43`                                                                            |
| En-tête des rapports internes (`header()`)                                     | bandeau sombre « ConstructFlow »            | **version claire** : fond blanc, logo de la société s'il existe, sinon logo ZidarPro ; filet orange |
| Pied de page des PDF, avertissement des exports                                | « via ConstructFlow »                       | « via ZidarPro »                                                                                    |
| Devis et factures                                                              | nom de la société (repli « ConstructFlow ») | inchangé (identité du client) ; repli « ZidarPro »                                                  |
| Assistant IA (prompt), User-Agent TVA                                          | ConstructFlow                               | ZidarPro                                                                                            |
| README, CLAUDE.md                                                              | ConstructFlow                               | ZidarPro (ex-ConstructFlow)                                                                         |

- **Contrats** :
  - **aucun logo** (ni ZidarPro ni société) ;
  - le texte du contrat ne contient pas le nom du produit, donc ni texte ni empreinte ne changent ;
  - seule la note de la piste d'audit (« Document généré via … ») passe à ZidarPro. Elle décrit
    l'outil qui produit le PDF et ne fait pas partie de l'empreinte.
- **Inchangés** : nom du dépôt, migrations, historique (`JOURNAL.md`, `PASSATION.md`), compte de
  démonstration `demo@constructflow.be` (compte existant en production), configuration de lancement.
- **E-mails** : aucun modèle d'e-mail dans le dépôt (phase 7). Les e-mails d'authentification sont
  configurés dans Supabase / Lovable (nom d'expéditeur, modèles) : à renommer par Youssef.
- **Plus tard (« progressif »)** : couleur principale des boutons (aujourd'hui sarcelle) vers le
  bleu de marque, à valider visuellement ; nom de domaine dans l'application une fois le domaine
  réservé.

## 3. Domaines, réseaux sociaux, marque (constat au 16/10/2026, rien de réservé)

- **Domaines**, vérifiés auprès des registres officiels :
  - WHOIS DNS Belgium : `zidarpro.be` disponible ;
  - WHOIS Verisign : `zidarpro.com` disponible ;
  - WHOIS EURid : `zidarpro.eu` disponible.
- **Réseaux** : GitHub, Instagram, TikTok, YouTube, X et LinkedIn (page entreprise) n'ont pas de
  compte « zidarpro » ; Facebook est probablement libre (même message que pour un profil privé).
- **Marques (TMview)** : aucune marque « ZIDARPRO » active. Plusieurs marques « ZIDAR » existent
  (Espagne, OMPI, Moldavie : classes 6, 16, 19, 35…). Recommandation : vérification par un conseil
  en marques, puis dépôt Benelux (BOIP) ou UE (EUIPO) en classes 9 et 42 (logiciel, SaaS),
  éventuellement 35.

## Vérifications

- `tsc`, lint, `i18n:check`, build, tests existants (empreintes des contrats inchangées).
- Navigateur (serveur de dev, sans connexion) :
  - page de connexion et favicon ;
  - en-tête PDF clair (avec et sans logo de société) ;
  - absence de logo dans le PDF de contrat ;
  - rendu du logo à 16, 32 et 180 px.

# Contrat de sous-traitance v2 — suivi des retours attendus

État au 15/10/2026. **La v2 ne sera rédigée qu'après réception des réponses du juriste.** Ce
document liste ce qui est attendu, ce que chaque réponse changera, et la procédure d'intégration.

| #   | Retour attendu                    | Destinataire       | Envoyé le        | Reçu le | État         |
| --- | --------------------------------- | ------------------ | ---------------- | ------- | ------------ |
| 1   | Dossier de relecture NL / RO / PL | Relecteurs natifs  | _à compléter_    |         | En attente   |
| 2   | Note juridique                    | Juriste            | _à compléter_    | —       | Envoyée      |
| 3   | Réponses aux 23 points            | Juriste            | (avec la note 2) |         | En attente   |
| 4   | Corrections à intégrer en v2      | Youssef (décision) | —                |         | Bloqué par 3 |

---

## 1. Dossier de relecture NL / RO / PL

- **Fichier envoyé** : `docs/relecture/relecture-nl-ro-pl.xlsx` (2 025 textes).

  | Langue | P1 — mentions légales PDF | P2 — page de signature | P3 — écrans |
  | ------ | ------------------------- | ---------------------- | ----------- |
  | NL     | 24                        | 23                     | 612         |
  | RO     | 24                        | 23                     | 628         |
  | PL     | 24                        | 23                     | 644         |

- **Attendu en retour** : le même fichier, avec pour chaque ligne revue :
  - un **statut** : validé, ou correction proposée ;
  - la **traduction corrigée**, le cas échéant ;
  - un commentaire, facultatif.

  La colonne « Clé technique » ne doit pas être modifiée.

- **Minimum utile** : les priorités 1 et 2 en **NL**. Les PDF clients et la page de signature sont en
  usage réel.
- **Contrôles à la réception** (script de réintégration à écrire à ce moment-là) :
  - clés techniques inchangées ;
  - variables `{{…}}` conservées à l'identique ;
  - formes plurielles complètes (RO : `_few` ; PL : `_few` / `_many`) ;
  - `bun run i18n:check` vert.
- **Lien avec la v2** : aucun. Ce dossier ne porte que sur l'interface et les mentions des PDF ; le
  **texte du contrat** est en français uniquement et n'y figure pas (voir point 5.2).
- **Livraison** : une PR « traductions » séparée de la v2, sans migration.

## 2. Note juridique envoyée au juriste

- **Document** : `docs/juridique/note-juriste-contrat-sous-traitance.md`, avec en annexe le texte
  exact du modèle `sous_traitance_cadre_v1` (généré par `scripts/juridique/exporter_contrat.ts`).
- **Contenu** :
  - le fonctionnement du logiciel (pré-remplissage, signature, piste d'audit, 30bis) ;
  - 5 points à valider et 3 points facultatifs, soit **23 questions** ;
  - un tableau de réponses.
- **Attendu en retour** :
  - le tableau rempli (réponse, modification proposée, priorité, validé oui / non) ;
  - idéalement, le **texte de remplacement exact** pour chaque clause modifiée. Sans lui, on ne
    peut pas rédiger la v2 sans interpréter.
- **À confirmer** : la date d'envoi et la version de la note envoyée (commit `458cfb5`).

## 3. Réponses du juriste sur les 23 points

« Impact » indique ce que la réponse modifie :

- **T** : texte du contrat (donc v2) ;
- **L** : logiciel ;
- **M** : migration de base ;
- **—** : aucun changement si la réponse valide l'existant.

| N°  | Question                                   | Impact possible                                                                                                                                                    |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.1 | Validité de la clause pénale               | T (art. 6, annexe 1)                                                                                                                                               |
| 1.2 | Plafond ou délai de grâce                  | T ; L si plafond calculé (p. ex. % du prix) ou champs rendus obligatoires                                                                                          |
| 1.3 | Pointillés vides dans un contrat signé     | T ; L si les champs doivent être remplis avant l'envoi (blocage à la signature de l'entrepreneur)                                                                  |
| 1.4 | Clause réciproque (retard de paiement)     | T                                                                                                                                                                  |
| 2.1 | Délai de paiement maximal                  | L (formulaire, aujourd'hui 0–365 j) **et M** (contrainte `CHECK delai_paiement_jours BETWEEN 0 AND 365`), ou avertissement seul (L)                                |
| 2.2 | Point de départ « facture correcte »       | T (art. 7)                                                                                                                                                         |
| 2.3 | Intérêts et indemnité de retard            | T (art. 7)                                                                                                                                                         |
| 2.4 | Compensation et retenues de garantie       | T (art. 7, al. 3)                                                                                                                                                  |
| 3.1 | Clause 30bis / art. 402 CIR suffisante     | T (art. 9)                                                                                                                                                         |
| 3.2 | Retenues libératoires                      | T (art. 9)                                                                                                                                                         |
| 3.3 | Clause de recours (solidarité)             | T (art. 9)                                                                                                                                                         |
| 3.4 | Répartition des déclarations               | T (art. 3)                                                                                                                                                         |
| 3.5 | Règles du logiciel (vérification, plafond) | L (triggers 30bis) **et M** si la règle change ; — si validées                                                                                                     |
| 4.1 | Signature électronique simple suffisante   | — si oui ; sinon voir 4.2                                                                                                                                          |
| 4.2 | Cas exigeant une signature qualifiée       | L important (itsme / eID) : **projet séparé**, hors v2                                                                                                             |
| 4.3 | Contenu de la piste d'audit                | L (p. ex. copie automatique au signataire : nécessite l'envoi d'e-mails côté serveur) ; M si nouvelles preuves stockées                                            |
| 4.4 | Mention « deux exemplaires »               | T                                                                                                                                                                  |
| 4.5 | Pouvoir de représentation du signataire    | T (déclaration expresse) ; L si case à cocher supplémentaire sur la page de signature                                                                              |
| 5.1 | Contrat en français seul                   | — ou 5.2                                                                                                                                                           |
| 5.2 | Versions NL / EN qui font foi              | T (traduction juridique **fournie par le juriste**) ; L : choix de la langue par sous-traitant ; **M** : colonne `langue` sur `sous_traitants` (elle n'existe pas) |
| 6.1 | RGPD, conservation 10 ans                  | T (art. 16) ; L si la durée change (paramètre existant)                                                                                                            |
| 6.2 | Assurances et décennale                    | T (art. 11, 13)                                                                                                                                                    |
| 6.3 | Signature de chaque fiche chantier         | L important (signature d'annexe séparée) ; T (art. 1, annexe 1)                                                                                                    |

**Décisions qui reviennent à Youssef** une fois les réponses reçues :

- quelles modifications « moyenne / basse » entrent dans la v2 ;
- si 5.2 (versions NL / EN) fait partie de la v2 ou d'une v3 ;
- si 4.2 et 6.3 sont lancés comme projets séparés.

## 4. Corrections à intégrer dans le contrat v2

### Prérequis technique, à faire avant la v2 (sans changer de texte)

Le rendu du contrat (`rendreContrat`, utilisé par l'envoi, la page `/signer/$token` et le PDF)
**ignore la colonne `modele`** et produit toujours le texte v1. Si la v2 était publiée telle quelle,
voici ce qui se passerait pour un lien v1 encore ouvert :

1. la page afficherait le texte v2 ;
2. l'empreinte ne correspondrait plus à celle de l'envoi ;
3. la signature serait **refusée**.

Les PDF des contrats v1 déjà signés seraient aussi régénérés avec le mauvais texte.

Ce qu'il faut faire, dans une PR distincte, sans migration et sans changer le texte v1 :

- **Registre des modèles** par code : `sous_traitance_cadre_v1` → fonction de rendu v1.
- **Rendu selon `modele`** pour chaque demande (envoi, page publique, PDF).
- **Erreur explicite** si le code est inconnu, au lieu d'un repli silencieux.
- **Tests de non-régression** : l'empreinte de v1 est identique avant et après la refonte, sur des
  données fictives.

### Procédure v2 (après les réponses du juriste)

1. **Texte**
   - Nouveau fichier `src/lib/contrats/sous-traitance-v2.ts`, avec le code
     `sous_traitance_cadre_v2`.
   - Le texte v1 n'est pas modifié (contrats signés et liens v1 restent valides).
   - Chaque clause modifiée renvoie au n° du tableau ci-dessus (commentaire dans le code).
2. **Nouveaux contrats en v2** : `ContratSignatureModal` envoie `modele: v2`. Les liens v1 en cours
   restent signables en v1 jusqu'à expiration ou annulation.
3. **Logiciel** : uniquement les points « L » retenus (délai maximal, champs obligatoires,
   déclaration de pouvoir…), avec traductions dans les 5 langues.
4. **Migration** : seulement si un point « M » est retenu (contrainte de délai, colonne `langue`…),
   en nouveau fichier idempotent avec rollback commenté. Avant de durcir une contrainte, fournir
   d'abord un contrôle SQL en lecture seule (contrats existants hors limite).
5. **Annexe pour le juriste** : régénérer le texte v2 et un **comparatif v1 / v2** clause par clause
   pour validation finale.
6. **Tests**
   - Unitaires : empreintes v1 inchangées ; v2 stable ; rendu selon `modele`.
   - PGlite : environnement Supabase simulé.
   - **Aucun test de signature définitif sans l'accord de Youssef.**
   - **Aucune écriture dans la base de production.**
7. **Validation finale du juriste** sur le comparatif, puis PR de mise en service (non fusionnée par
   Claude).

### Hors v2 (à planifier séparément si le juriste le demande)

- Signature avancée ou qualifiée (itsme, eID) — point 4.2.
- Signature séparée de chaque fiche chantier — point 6.3.
- Envoi automatique d'une copie signée au sous-traitant — point 4.3.

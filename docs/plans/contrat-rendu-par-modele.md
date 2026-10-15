# Plan — rendu de chaque contrat dans sa version de modèle

Branche : `contrat-rendu-par-modele`. Prérequis de la v2 du contrat de sous-traitance (voir
`docs/juridique/suivi-retours-contrat-v2.md`). **Aucune migration, aucun changement du texte v1,
aucune écriture en base.**

## Constat

`contrat_signatures.modele` est enregistré à l'envoi (`sous_traitance_cadre_v1`) et renvoyé par
`contrat_a_signer`, mais le code l'ignore : `rendreContrat` (texte v1) est appelé en dur dans
4 endroits.

| Endroit                                  | Usage                                       |
| ---------------------------------------- | ------------------------------------------- |
| `ContratSignatureModal` (envoi)          | aperçu, empreinte d'envoi, `modele` inséré  |
| `/signer/$token` — formulaire            | texte affiché, empreinte recalculée, signée |
| `/signer/$token` — contrat déjà signé    | texte affiché, « Fait à … »                 |
| `telechargerContratPDF` (les deux côtés) | texte du PDF, « Fait à … »                  |

Si la v2 remplaçait ce rendu :

- un lien v1 encore ouvert afficherait le texte v2 → empreinte différente → signature refusée
  (`document_modifie`) ;
- le PDF d'un contrat v1 signé serait régénéré avec le texte v2.

## Solution

1. **`src/lib/contrats/modeles.ts`** (pur, sans React ni i18n, testable avec bun) :
   - un registre `code → { rendre, faitA }` (aujourd'hui : v1 seul, branché sur les fonctions
     existantes) et la constante `MODELE_COURANT` (= v1), utilisée seulement pour les **nouveaux**
     envois ;
   - `modeleContrat(code)` lève une erreur explicite `modele_inconnu` pour un code absent ou
     inconnu, **jamais de repli** sur un autre modèle ;
   - empreintes d'envoi et de signature calculées avec le modèle **de la demande** ;
   - `documentDemande(sig)` : texte et « Fait à … » d'une demande, selon son `modele` (page signée
     et PDF).
2. **`sous-traitance.ts` inchangé, octet pour octet**, donc le texte v1, `faitA` et les anciennes
   fonctions d'empreinte aussi. Le registre appelle ces fonctions.
3. **Appelants** :
   - l'envoi utilise `MODELE_COURANT` à la fois pour l'aperçu, l'empreinte et la colonne `modele`,
     ce qui garantit leur cohérence ;
   - la page de signature et le PDF utilisent `sig.modele` ;
   - le type `SignatureContrat` reçoit `modele`.
4. **Page `/signer/$token`** : si le modèle est inconnu, elle affiche le message traduit
   `sign.errors.modele_inconnu` (5 langues) au lieu de planter.
5. **`exporter_contrat.ts`** accepte un code de modèle en argument ; par défaut, le modèle
   courant. La sortie v1 est inchangée.

## Tests (données fictives uniquement)

`scripts/tests/modeles-contrat.check.ts` :

1. **Texte v1 inchangé** :
   - le texte rendu pour un contrat fictif est identique à l'instantané
     `scripts/tests/fixtures/contrat-v1-fictif.txt`, capturé sur `main` (22b5b5c) avant la refonte ;
   - les empreintes d'envoi, de signature et sur données vides sont égales aux valeurs calculées
     sur `main`.
2. **Registre = ancien code** : les empreintes passant par le registre sont égales à celles des
   anciennes fonctions.
3. **Lien v1 ouvert après l'arrivée d'une v2** : avec un registre de test contenant une fausse v2
   et cette v2 en modèle courant,
   - une demande v1 affiche le texte v1 ;
   - son empreinte recalculée est égale à `document_hash`, donc la signature est possible.
4. **Contrat v2** : une demande `…_v2` affiche le texte v2 ; son empreinte diffère de la v1.
5. **PDF d'un contrat v1 signé** : le texte et le « Fait à … » utilisés pour le PDF sont exactement
   ceux du v1 (corrections du sous-traitant comprises), même avec une v2 courante ; l'empreinte
   signée recalculée est égale à la valeur de référence.
6. **Modèle inconnu ou vide** : erreur `modele_inconnu`, aucun repli.

Vérification complémentaire dans le navigateur, sur le serveur de dev et sans base : générer le PDF
d'un contrat v1 signé fictif avec `construireContratPDF` et comparer son texte extrait au texte v1.

Aucun test sur la base de production ; aucune signature réelle.

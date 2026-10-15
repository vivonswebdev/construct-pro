# Note pour le juriste — Contrat-cadre de sous-traitance (construction, Belgique)

**Objet** : demande de validation du modèle de contrat utilisé dans le logiciel ConstructFlow
**Modèle** : `sous_traitance_cadre_v1` (texte complet en annexe A)
**Préparée le** : 15/10/2026, à partir du texte exact utilisé par l'application
**Pour** : [nom du juriste / cabinet]
**Contact** : Youssef — [e-mail]

> **Avertissement.** Cette note ne contient **aucun avis juridique**. Elle décrit le modèle de
> contrat et la façon dont le logiciel l'utilise, puis liste des **questions**. Les mentions de
> textes légaux ne sont que des repères pour situer les questions : leur portée et leur
> application relèvent de votre appréciation.

---

## 1. Contexte

ConstructFlow est un logiciel de gestion pour PME belges de la construction. L'entreprise
utilisatrice (« entrepreneur principal ») y gère ses sous-traitants. Le modèle de contrat
ci-joint a été fourni par l'entreprise ; il est intégré tel quel dans le logiciel.

### Fonctionnement dans le logiciel

1. **Pré-remplissage** : identités des parties, n° BCE / TVA, adresse, IBAN, chantier, maître
   d'ouvrage, prix, délai de paiement, mention d'autoliquidation. Tout reste modifiable avant
   l'envoi. Un champ vide apparaît en pointillés dans le contrat.
2. **Signature de l'entrepreneur** : son représentant relit le contrat et trace sa signature à
   l'écran (signature manuscrite numérisée) ; il indique son nom et sa qualité.
3. **Envoi d'un lien unique** au sous-traitant (par e-mail ou WhatsApp, depuis la messagerie de
   l'entreprise). Validité du lien : 1 à 90 jours (30 par défaut). Le lien peut être annulé tant
   qu'il n'est pas signé.
4. **Signature du sous-traitant**, sans création de compte : il relit le contrat, complète ou
   corrige son représentant, sa qualité, ses coordonnées et son IBAN, indique le lieu, coche
   « J'ai lu le contrat proposé par [entreprise] et ses annexes, et je l'accepte au nom du
   sous-traitant », puis trace sa signature.
5. **Preuves conservées** (piste d'audit, imprimée en dernière page du PDF) :
   - date et heure (heure du serveur, fuseau de Bruxelles) de l'envoi et de la signature de
     l'entrepreneur, de la première consultation du lien, de la signature du sous-traitant ;
   - adresse IP et navigateur du signataire ;
   - **empreinte SHA-256** du texte envoyé et du texte signé. La signature est **refusée** si
     le texte présenté au sous-traitant diffère de celui envoyé ;
   - une demande signée ne peut plus être modifiée ni supprimée ; le contrat signé non plus.
6. **PDF signé** : téléchargeable par les deux parties (contrat, signatures, piste d'audit).
7. **Langue** : le contrat existe **uniquement en français**. La page de signature (interface)
   est traduite en NL, EN, RO et PL et précise : « Le contrat est rédigé en français ; seule
   cette version fait foi. »

### Ce que le logiciel fait par ailleurs (contexte des clauses 30bis)

- Avant **chaque** paiement d'un sous-traitant, une vérification du jour sur
  checkobligationderetenue.be est obligatoire (résultat et capture enregistrés, horodatés,
  immuables).
- En cas de dette, le logiciel calcule la retenue : 35 % (ONSS) / 15 % (SPF Finances) du
  montant HTVA, plafonnées à la dette communiquée et au montant du paiement. Ces taux sont des
  paramètres indicatifs, à valider par le comptable.
- Un sous-traitant sans attestation 30bis valide ne peut pas être affecté à un chantier, sauf
  dérogation écrite et motivée (30 jours maximum).

---

## 2. Points à valider

### Point 1 — Pénalités de retard (article 6 et annexe 1)

- **Texte** : une pénalité ne s'applique que si son montant (EUR/jour) et son plafond (EUR)
  sont renseignés dans la fiche chantier, « sous réserve du contrôle judiciaire de sa validité
  et de sa proportionnalité » ; à défaut, seul le dommage réellement subi peut être réclamé.
- **Dans le logiciel** : les deux montants sont facultatifs ; vides, ils apparaissent en
  pointillés.
- **Questions** :
  1. La rédaction est-elle valable au regard des règles actuelles sur les clauses pénales
     (Livre 5 du Code civil) ?
  2. Faut-il imposer un plafond (par exemple un pourcentage du prix) ou un délai de grâce ?
  3. Des pointillés laissés vides dans un contrat signé posent-ils un problème (clause réputée
     non convenue, comme le prévoit le texte) ?
  4. Faut-il une clause réciproque (retard de paiement de l'entrepreneur) ?

### Point 2 — Délais de paiement et loi du 2 août 2002 (article 7 et annexe 1)

- **Texte** : la facture est payable « dans le délai légal applicable ou, si la loi le permet,
  dans le délai expressément convenu sur la fiche chantier : … jours ».
- **Dans le logiciel** : délai pré-rempli à **30 jours** ; l'utilisateur peut saisir de 0 à
  **365 jours**. Paiement exclusivement par virement (article 7).
- **Questions** :
  1. Quel délai maximal le logiciel doit-il accepter pour rester dans le cadre de la loi du
     2 août 2002 concernant la lutte contre le retard de paiement dans les transactions
     commerciales ? Faut-il bloquer ou avertir au-delà d'un seuil ?
  2. Le mécanisme de « réception d'une facture correcte et des pièces requises » comme point de
     départ est-il admissible ? Faut-il prévoir une procédure de vérification limitée dans le
     temps ?
  3. Faut-il mentionner les intérêts de retard et l'indemnité forfaitaire prévus par la loi ?
  4. La compensation (article 7, alinéa 3) et les retenues de garantie doivent-elles être
     davantage encadrées ?

### Point 3 — Clauses 30bis, retenues et responsabilité solidaire (article 9)

- **Texte** : le sous-traitant fournit les attestations nécessaires ; l'entrepreneur peut
  suspendre le démarrage ou le paiement « dans la mesure nécessaire pour respecter une
  obligation légale » ; toute retenue obligatoire est effectuée et versée à l'autorité.
- **Questions** :
  1. La clause est-elle suffisante au regard de l'article 30bis de la loi du 27 juin 1969 et de
     l'article 402 du CIR 92 (retenues et responsabilité solidaire) ?
  2. Faut-il prévoir expressément que les retenues versées à l'ONSS / au SPF sont **libératoires**
     à l'égard du sous-traitant (imputation sur le prix) ?
  3. Faut-il une clause de recours (garantie) de l'entrepreneur contre le sous-traitant si sa
     responsabilité solidaire est engagée ?
  4. Les obligations de déclaration (déclaration de travaux, Checkinatwork, Limosa) doivent-elles
     être réparties plus précisément entre les parties (article 3) ?
  5. La règle du logiciel « vérification le jour de chaque paiement » et le plafonnement de la
     retenue au montant de la dette communiquée vous paraissent-ils conformes ?

### Point 4 — Valeur de la signature électronique simple

- **Faits** : signature électronique **simple** au sens du règlement (UE) n° 910/2014 (eIDAS) :
  signature manuscrite tracée à l'écran, lien à jeton unique, piste d'audit (section 1, point 5).
  Pas d'identification forte (pas d'itsme, pas de carte eID).
- **Questions** :
  1. Cette signature suffit-elle pour ce contrat-cadre et ses fiches chantier entre
     professionnels ? Quelle force probante en cas de contestation (Livre 8 du Code civil) ?
  2. Faut-il une signature avancée ou qualifiée (itsme, eID) dans certains cas (montants,
     sous-traitant étranger, avenants) ?
  3. Le contenu de la piste d'audit est-il suffisant ? Manque-t-il un élément (par exemple un
     horodatage qualifié, l'envoi automatique d'une copie au signataire) ?
  4. La mention du texte (« en deux exemplaires ou par signature électronique valable »)
     convient-elle ?
  5. Le signataire du sous-traitant déclare seulement son nom et sa qualité : faut-il vérifier
     son pouvoir de représentation (BCE, statuts) ou ajouter une déclaration expresse ?

### Point 5 — Versions néerlandaise et anglaise

- **Faits** : contrat uniquement en français ; interface de signature traduite en NL, EN, RO,
  PL avec la mention « seule la version française fait foi ». Des sous-traitants peuvent être
  établis en Flandre ou à l'étranger.
- **Questions** :
  1. Un contrat uniquement en français est-il acceptable avec un sous-traitant néerlandophone
     ou établi en Flandre (législation linguistique) ?
  2. Faut-il des versions NL et EN **qui font foi** (ou seulement des traductions de courtoisie) ?
  3. Si oui : le texte traduit sera intégré comme version v2 (NL / EN), après votre validation.

### Autres points à signaler (facultatif)

- **Données personnelles** : noms des ouvriers du sous-traitant enregistrés comme preuve des
  prestations, conservés 10 ans par défaut (paramètre). Clause RGPD de l'article 16 suffisante ?
- **Assurances** (article 11) et **responsabilité décennale** (article 13) : formulation adaptée ?
- **Ordre de priorité des documents** (article 1) et **fiche chantier** (annexe 1) : faut-il que
  chaque fiche chantier soit signée séparément (aujourd'hui, la fiche de la mission est jointe
  au contrat signé) ?

---

## 3. Tableau de réponses à remplir

| N°  | Point                  | Question (renvoi)                          | Réponse du juriste | Modification proposée au texte | Priorité (haute / moyenne / basse) | Validé (oui / non) |
| --- | ---------------------- | ------------------------------------------ | ------------------ | ------------------------------ | ---------------------------------- | ------------------ |
| 1.1 | Pénalités de retard    | Validité de la rédaction                   |                    |                                |                                    |                    |
| 1.2 | Pénalités de retard    | Plafond ou délai de grâce                  |                    |                                |                                    |                    |
| 1.3 | Pénalités de retard    | Pointillés vides                           |                    |                                |                                    |                    |
| 1.4 | Pénalités de retard    | Clause réciproque                          |                    |                                |                                    |                    |
| 2.1 | Délais de paiement     | Délai maximal à accepter                   |                    |                                |                                    |                    |
| 2.2 | Délais de paiement     | Point de départ (facture correcte)         |                    |                                |                                    |                    |
| 2.3 | Délais de paiement     | Intérêts et indemnité de retard            |                    |                                |                                    |                    |
| 2.4 | Délais de paiement     | Compensation et retenues de garantie       |                    |                                |                                    |                    |
| 3.1 | 30bis / solidarité     | Clause suffisante (30bis, 402 CIR)         |                    |                                |                                    |                    |
| 3.2 | 30bis / solidarité     | Retenues libératoires                      |                    |                                |                                    |                    |
| 3.3 | 30bis / solidarité     | Clause de recours                          |                    |                                |                                    |                    |
| 3.4 | 30bis / solidarité     | Répartition des déclarations               |                    |                                |                                    |                    |
| 3.5 | 30bis / solidarité     | Règles du logiciel (vérification, plafond) |                    |                                |                                    |                    |
| 4.1 | Signature électronique | Suffisance de la signature simple          |                    |                                |                                    |                    |
| 4.2 | Signature électronique | Cas exigeant une signature qualifiée       |                    |                                |                                    |                    |
| 4.3 | Signature électronique | Contenu de la piste d'audit                |                    |                                |                                    |                    |
| 4.4 | Signature électronique | Mention « deux exemplaires »               |                    |                                |                                    |                    |
| 4.5 | Signature électronique | Pouvoir de représentation du signataire    |                    |                                |                                    |                    |
| 5.1 | Versions NL / EN       | Contrat en français seul                   |                    |                                |                                    |                    |
| 5.2 | Versions NL / EN       | Versions qui font foi                      |                    |                                |                                    |                    |
| 6.1 | Autres                 | RGPD (article 16, conservation 10 ans)     |                    |                                |                                    |                    |
| 6.2 | Autres                 | Assurances et décennale                    |                    |                                |                                    |                    |
| 6.3 | Autres                 | Signature de chaque fiche chantier         |                    |                                |                                    |                    |

**Après votre retour** : chaque modification du texte donnera une **nouvelle version** du modèle
(v2). Les contrats déjà signés restent inchangés (leur texte est figé par son empreinte), et les
liens déjà envoyés en v1 restent signables tels quels jusqu'à leur expiration ou annulation.

---

## Annexe A — Texte du modèle `sous_traitance_cadre_v1`

Texte exact présenté au sous-traitant ; les champs vides sont en pointillés. « [ENTREPRENEUR
PRINCIPAL] » est remplacé par la dénomination de l'entreprise.

<!-- Modèle sous_traitance_cadre_v1 — généré par scripts/juridique/exporter_contrat.ts -->

### CONTRAT-CADRE DE SOUS-TRAITANCE — TRAVAUX DE CONSTRUCTION — BELGIQUE

_Référence : ……………………_

#### ENTRE LES SOUSSIGNÉS

1. L’ENTREPRENEUR PRINCIPAL / DONNEUR D’ORDRE

……………………, ……………………, BCE/TVA : ……………………. Siège : ……………………, ……………………. Représentée par : ……………………, ……………………. Ci-après « [ENTREPRENEUR PRINCIPAL] ».

2. LE SOUS-TRAITANT

- **Dénomination** : ……………………
- **Forme juridique** : ……………………
- **BCE/TVA** : ……………………
- **Siège** : ……………………
- **Représentant et qualité** : ……………………, ……………………
- **Téléphone / e-mail pour notifications** : ……………………
- **Compte bancaire IBAN** : ……………………

Ci-après « le Sous-traitant ».

[ENTREPRENEUR PRINCIPAL] et le Sous-traitant sont individuellement une « Partie » et ensemble les « Parties ».

#### ARTICLE 1 – OBJET ET PORTÉE DU CONTRAT-CADRE

Le présent contrat fixe les conditions générales applicables aux travaux de construction, rénovation, parachèvement, démolition, installation ou autres prestations confiés par [ENTREPRENEUR PRINCIPAL] au Sous-traitant. Il ne constitue pas, à lui seul, une commande de travaux. Chaque intervention doit faire l’objet d’un bon de commande ou d’une fiche chantier signée par les Parties, précisant au minimum : le maître d’ouvrage, l’adresse du chantier, la description et les limites exactes des prestations, les plans et versions applicables, le prix, le régime TVA, les délais, les étapes de réception et les éventuelles exigences du marché principal.

En cas de contradiction, l’ordre de priorité est : (1) avenant signé postérieur, (2) bon de commande/fiche chantier signé, (3) plans et prescriptions expressément identifiés, (4) présent contrat. Les conditions générales du Sous-traitant ne s’appliquent que si [ENTREPRENEUR PRINCIPAL] les accepte expressément par écrit.

#### ARTICLE 2 – ABSENCE DE COMMANDE IMPLICITE ET MODIFICATIONS

Aucun travail supplémentaire, changement de matériau, adaptation de méthode, prolongation de délai ou dépassement de quantité ne peut être facturé sans demande ou accord écrit préalable d’[ENTREPRENEUR PRINCIPAL] précisant son incidence sur le prix et le planning. Une instruction orale doit être confirmée par écrit avant exécution, sauf mesure urgente strictement nécessaire à la sécurité; dans ce cas, le Sous-traitant avertit immédiatement [ENTREPRENEUR PRINCIPAL] et documente les faits. Le silence d’[ENTREPRENEUR PRINCIPAL] ne vaut pas acceptation d’un supplément.

#### ARTICLE 3 – OBLIGATIONS DU SOUS-TRAITANT

Le Sous-traitant s’engage à :

- exécuter les travaux avec diligence, selon les règles de l’art, les normes applicables, les plans et prescriptions communiqués, ainsi que les instructions écrites d’[ENTREPRENEUR PRINCIPAL] compatibles avec la sécurité et la réglementation;
- vérifier avant démarrage les dimensions, supports, accès, interfaces et documents utiles; signaler par écrit, avant d’exécuter, toute erreur, incohérence, omission ou condition de chantier susceptible d’affecter la qualité, le coût, la sécurité ou le délai;
- fournir, sauf mention contraire sur la fiche chantier, la main-d’œuvre, l’encadrement, les outils, équipements, consommables et moyens nécessaires à ses prestations;
- affecter du personnel qualifié, légalement occupé, autorisé à travailler en Belgique et correctement déclaré; respecter les obligations sociales, fiscales, salariales, de détachement, Limosa, Dimona, Checkinatwork et autres formalités applicables selon le cas;
- respecter les règles de sécurité, le plan de sécurité et de santé, les consignes du coordinateur et du chantier, les règles environnementales, de tri et d’évacuation des déchets;
- protéger les ouvrages existants, les parties communes, les biens des tiers et les travaux déjà exécutés; réparer à ses frais les dommages imputables à son fait, à son personnel ou à ses sous-traitants;
- maintenir le chantier propre et évacuer les déchets issus de ses prestations conformément aux règles applicables;
- remettre sur demande les fiches techniques, certificats, attestations, rapports de contrôle, notices, garanties fournisseurs et documents « as built » relatifs à ses travaux.

#### ARTICLE 4 – AUTORISATIONS, AGRÉATIONS ET SOUS-SOUS-TRAITANCE

Le Sous-traitant garantit disposer des inscriptions, accès à la profession, agréments, compétences et autorisations légalement requis pour les prestations commandées. Il remet les preuves à première demande. Il ne peut céder le contrat ni confier tout ou partie des travaux à un tiers sans l’accord écrit préalable d’[ENTREPRENEUR PRINCIPAL]. Cet accord ne le libère d’aucune obligation; il demeure responsable des actes et omissions de ses intervenants comme des siens, sous réserve des règles impératives.

#### ARTICLE 5 – CONTRÔLES, NON-CONFORMITÉS ET REPRISES

[ENTREPRENEUR PRINCIPAL] peut contrôler l’avancement et la conformité des travaux, sans que ce contrôle ne transfère la responsabilité du Sous-traitant à [ENTREPRENEUR PRINCIPAL]. Le Sous-traitant avertit [ENTREPRENEUR PRINCIPAL] dès qu’une étape doit être contrôlée ou risque d’être masquée. Toute non-conformité est consignée par écrit. Le Sous-traitant propose sans délai un plan de correction et, lorsque la non-conformité lui est imputable, reprend les travaux à ses frais dans le délai raisonnable fixé par [ENTREPRENEUR PRINCIPAL]. En cas d’urgence, de refus ou d’inaction après mise en demeure écrite et délai raisonnable, [ENTREPRENEUR PRINCIPAL] peut faire exécuter les corrections par un tiers aux frais du Sous-traitant, dans la mesure permise par la loi, et réclamer le dommage prouvé.

#### ARTICLE 6 – DÉLAIS ET RETARDS

Les dates de démarrage, jalons et date d’achèvement figurent sur la fiche chantier. Le Sous-traitant informe immédiatement [ENTREPRENEUR PRINCIPAL], par écrit, de tout événement pouvant retarder les travaux, en indiquant la cause, la durée estimée et les mesures de mitigation. Une prolongation n’est accordée que pour la durée de l’impact effectivement justifié et non imputable au Sous-traitant, après accord écrit d’[ENTREPRENEUR PRINCIPAL], sans préjudice des règles impératives. Une pénalité de retard ne s’applique que si son montant ou sa formule est expressément renseigné dans la fiche chantier et sous réserve du contrôle judiciaire de sa validité et de sa proportionnalité : …………………… EUR/jour, plafonnée à …………………… EUR. À défaut de stipulation complétée, aucun montant forfaitaire de pénalité n’est convenu; le dommage réellement subi peut être réclamé conformément au droit applicable.

#### ARTICLE 7 – PRIX, FACTURATION ET PAIEMENT

Le prix convenu est celui figurant sur la fiche chantier. Sauf stipulation contraire, il couvre l’ensemble des moyens nécessaires aux prestations décrites, les frais, déplacements, manutentions, protections et nettoyage liés à celles-ci. Les travaux supplémentaires sont soumis à l’article 2.

Les factures doivent identifier [ENTREPRENEUR PRINCIPAL], le chantier, le bon de commande, la période et les prestations réalisées, et joindre les états d’avancement et pièces justificatives convenus. La facture est payable dans le délai légal applicable ou, si la loi le permet, dans le délai expressément convenu sur la fiche chantier : …………………… jours à compter de la réception d’une facture correcte et des pièces requises. Toute contestation motivée est notifiée dans un délai raisonnable; la partie non contestée demeure payable à l’échéance. Aucune clause ne permet de déroger aux règles impératives en matière de délais de paiement, marchés publics, insolvabilité ou sous-traitance.

[ENTREPRENEUR PRINCIPAL] peut compenser les sommes certaines, liquides et exigibles réciproques dans les limites autorisées par la loi. Toute retenue de garantie, retenue de paiement ou compensation liée à une réserve doit être prévue clairement dans la fiche chantier et rester conforme au droit impératif.

Toute facture du Sous-traitant sera payée exclusivement par virement bancaire. Aucun paiement en espèces ne sera accepté pour l’exécution du présent contrat.

#### ARTICLE 8 – TVA, FACTURATION ET OBLIGATIONS FISCALES

Chaque Partie assume ses obligations fiscales et de facturation. Le Sous-traitant vérifie le régime TVA applicable à l’opération et mentionne sur la facture les mentions légalement requises. Lorsque le mécanisme d’autoliquidation est applicable, la facture comporte la mention légale appropriée et les Parties coopèrent pour vérifier les conditions. Le Sous-traitant fournit les informations nécessaires à la vérification de son statut et informe immédiatement [ENTREPRENEUR PRINCIPAL] de tout changement. Le présent contrat ne garantit pas, à lui seul, l’application d’un régime TVA déterminé.

#### ARTICLE 9 – DETTES SOCIALES, FISCALES ET VÉRIFICATIONS LÉGALES

Avant le début des travaux et pendant leur exécution, le Sous-traitant fournit les attestations et informations raisonnablement nécessaires à [ENTREPRENEUR PRINCIPAL] pour vérifier les obligations légales pertinentes, notamment les règles de retenue sur facture en cas de dettes fiscales ou sociales, les obligations de déclaration et les interdictions de contracter. [ENTREPRENEUR PRINCIPAL] peut suspendre le démarrage ou le paiement dans la mesure nécessaire pour respecter une obligation légale ou une notification officielle, après en avoir informé le Sous-traitant. Toute retenue légalement obligatoire est effectuée et versée à l’autorité compétente selon la procédure applicable. Cette clause n’exclut ni ne limite les responsabilités que la loi impose à [ENTREPRENEUR PRINCIPAL].

#### ARTICLE 10 – SÉCURITÉ ET BIEN-ÊTRE AU TRAVAIL

Le Sous-traitant respecte le Code du bien-être au travail, la législation sur les chantiers temporaires ou mobiles et les instructions de sécurité applicables. Il fournit les EPI, formations, habilitations, contrôles et équipements requis. Il signale immédiatement tout accident, incident, danger ou arrêt de travail et prend les mesures conservatoires nécessaires. [ENTREPRENEUR PRINCIPAL] peut faire arrêter une activité présentant un danger ou une non-conformité manifeste, sans que cela dispense le Sous-traitant de ses obligations. La répartition contractuelle des tâches de coordination et de sécurité doit être précisée sur la fiche chantier et ne peut supprimer les responsabilités légales de chaque intervenant.

#### ARTICLE 11 – ASSURANCES

Avant toute intervention, le Sous-traitant remet une attestation d’assurance responsabilité civile exploitation et après livraison, couvrant les activités commandées, avec limites de garantie adaptées au chantier. Si les travaux relèvent d’une assurance obligatoire de responsabilité décennale, il remet la preuve de couverture exigée par la loi avant le début des travaux. Les montants, franchises et périodes de couverture sont annexés à la fiche chantier. Le Sous-traitant avertit [ENTREPRENEUR PRINCIPAL] sans délai de toute suspension, résiliation ou modification substantielle de ses polices. L’assurance ne limite pas la responsabilité légale ou contractuelle du Sous-traitant.

#### ARTICLE 12 – DOMMAGES, RESPONSABILITÉ ET INDEMNISATION

Le Sous-traitant répond, dans les limites prévues par le droit applicable, des dommages directs causés par ses manquements contractuels, ses fautes, celles de son personnel et de ses intervenants, ainsi que des défauts et non-conformités imputables à ses prestations. Il indemnise [ENTREPRENEUR PRINCIPAL] des réclamations de tiers, frais raisonnables de défense et coûts de remise en état dans la mesure où ils résultent de ces manquements et sont légalement récupérables. Aucune stipulation ne supprime une responsabilité impérative, notamment en cas de dol, faute intentionnelle ou autre hypothèse pour laquelle une exclusion est interdite. La répartition des responsabilités tient compte des fautes respectives et des règles légales applicables.

#### ARTICLE 13 – RÉCEPTION ET GARANTIES

La fin matérielle des travaux ne vaut pas automatiquement réception. Les Parties établissent, lorsque cela est pertinent, un procès-verbal de réception provisoire mentionnant les réserves, responsables et délais de levée, puis un procès-verbal de réception définitive selon la fiche chantier et le marché principal. Le Sous-traitant corrige les réserves qui lui sont imputables dans le délai convenu. La réception ou le paiement ne couvre pas les défauts non apparents ni ne supprime les garanties légales applicables, dont la responsabilité décennale lorsque ses conditions sont réunies. Les garanties contractuelles particulières sont indiquées ici : ……………………

#### ARTICLE 14 – SUSPENSION ET RÉSILIATION

En cas de manquement important, la Partie lésée adresse une mise en demeure écrite décrivant le manquement et accordant un délai raisonnable pour y remédier, sauf urgence, impossibilité de remède ou autre cas permettant légalement une résolution immédiate. À défaut de remède, elle peut mettre fin au contrat ou à la commande concernée, sans préjudice des dommages prouvés et des règles impératives. [ENTREPRENEUR PRINCIPAL] peut suspendre temporairement les travaux pour des motifs de sécurité, de coordination, d’instruction du maître d’ouvrage ou de force majeure, en informant le Sous-traitant et en documentant les conséquences sur les coûts et délais. Les travaux correctement exécutés et non contestés sont décomptés selon le contrat et la loi.

#### ARTICLE 15 – FORCE MAJEURE ET CIRCONSTANCES EXCEPTIONNELLES

La Partie qui invoque un événement répondant aux critères légaux de force majeure en informe l’autre Partie sans délai, fournit les justificatifs disponibles et prend les mesures raisonnables pour limiter ses conséquences. Les difficultés ordinaires d’approvisionnement, de personnel ou de trésorerie ne constituent pas automatiquement un cas de force majeure. Les Parties se concertent sur les mesures de continuité, l’adaptation des délais et, si nécessaire, la fin de la commande conformément au droit applicable.

#### ARTICLE 16 – CONFIDENTIALITÉ, PHOTOS ET DONNÉES

Le Sous-traitant garde confidentiels les plans, prix, données commerciales, informations du maître d’ouvrage et informations de chantier reçus dans le cadre du contrat. Il ne publie aucune photographie, référence ou information sur le chantier sans autorisation écrite préalable d’[ENTREPRENEUR PRINCIPAL] et, le cas échéant, du maître d’ouvrage. Chaque Partie respecte la réglementation applicable en matière de protection des données.

#### ARTICLE 17 – NOTIFICATIONS ET PREUVES

Les commandes, avenants, réserves, mises en demeure et demandes de supplément sont adressés aux coordonnées indiquées en tête du contrat, par e-mail permettant d’en conserver la preuve et, lorsqu’une mise en demeure formelle ou la loi l’exige, par recommandé ou tout autre mode légalement valable. Chaque Partie conserve les commandes, plans datés, rapports, photos, feuilles de présence, procès-verbaux et factures utiles à la preuve de l’exécution.

#### ARTICLE 18 – DROIT APPLICABLE ET LITIGES

Le contrat est régi par le droit belge. Les Parties recherchent d’abord une solution amiable documentée. À défaut, le litige relève des juridictions matériellement et territorialement compétentes conformément aux règles impératives belges; aucune clause attributive ne déroge aux règles impératives de compétence.

#### ARTICLE 19 – DISPOSITIONS FINALES

Toute modification doit être écrite et acceptée par les Parties. Si une clause est invalide, les autres restent applicables dans la mesure permise par la loi; les Parties remplaceront la clause concernée par une stipulation licite se rapprochant de son objectif économique. Le présent contrat et ses fiches chantier constituent l’accord des Parties pour leur objet, sous réserve des documents du marché principal expressément incorporés et communiqués au Sous-traitant avant acceptation.

#### ANNEXE 1 – FICHE DE COMMANDE / CHANTIER

- **Référence de commande** : ……………………
- **Maître d’ouvrage / client final** : ……………………
- **Adresse complète du chantier** : ……………………
- **Nature et limites exactes des travaux** : ……………………
- **Documents contractuels et versions des plans** : ……………………
- **Date de début / jalons / date de fin** : ……………………
- **Prix HTVA et méthode (forfait / métrés / régie)** : ……………………
- **TVA et mention de facturation applicable** : ……………………
- **États d’avancement et pièces à joindre** : ……………………
- **Délai de paiement convenu, sous réserve de la loi** : ……………………
- **Pénalité de retard (si convenue) et plafond** : …………………… EUR/jour, plafonnée à …………………… EUR
- **Assurances requises et montants** : ……………………
- **Consignes sécurité / coordinateur / accès** : ……………………
- **Déchets, stockage, protections et nettoyage** : ……………………
- **Réception, réserves et garantie contractuelle** : ……………………
- **Personnes de contact / e-mails** : ……………………

#### ANNEXE 2 – LISTE DE CONTRÔLE AVANT DÉMARRAGE

- [ ] Bon de commande et périmètre signés par les deux Parties.
- [ ] Plans, métrés et version des documents identifiés.
- [ ] Prix, TVA, délai de paiement et délais de chantier confirmés.
- [ ] Vérification du statut BCE/TVA et des retenues légalement applicables.
- [ ] Attestations d’assurance reçues et validées.
- [ ] Documents sociaux et autorisations du personnel vérifiés selon le cas.
- [ ] Limosa / Checkinatwork / déclarations obligatoires vérifiées selon le cas.
- [ ] Consignes de sécurité, coordination et accès chantier communiqués.
- [ ] Autorisation préalable de sous-traitance ultérieure obtenue si nécessaire.
- [ ] Répartition des protections, déchets, stockage et nettoyage convenue.

#### RÉFÉRENCES JURIDIQUES

- Livre 5 du Code civil (obligations et contrats), entré en vigueur le 1er janvier 2023.
- Ancien Code civil, notamment les articles 1792 et 2270 lorsque la responsabilité décennale est applicable, ainsi que les dispositions pertinentes relatives au contrat d’entreprise, sous réserve des réformes législatives et du régime applicable à la date du contrat.
- Loi du 20 mars 1991 organisant l’agréation d’entrepreneurs de travaux, si applicable.
- Loi du 17 juin 2016 relative aux marchés publics et arrêté royal du 14 janvier 2013 établissant les règles générales d’exécution des marchés publics, uniquement si le chantier relève des marchés publics.
- Code du bien-être au travail et réglementation relative aux chantiers temporaires ou mobiles.
- Réglementation TVA belge, notamment l’autoliquidation pour travaux immobiliers lorsque les conditions sont remplies.
- Réglementation belge relative à la responsabilité solidaire pour les dettes sociales/fiscales et au paiement de la rémunération dans le secteur de la construction.
- Règles régionales applicables aux déchets, permis, environnement et sécurité incendie.

#### SIGNATURES

Fait à ……………………, le ……/……/……, par signature électronique.

Pour l'entrepreneur principal : nom, qualité, signature électronique manuscrite (image), date et heure.

Pour le sous-traitant : nom, qualité, signature électronique manuscrite (image), date et heure.

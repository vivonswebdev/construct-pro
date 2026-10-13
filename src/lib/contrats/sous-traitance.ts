/**
 * Modèle « Contrat-cadre de sous-traitance — travaux de construction (Belgique) », version 1.
 *
 * Texte repris du modèle générique fourni par Youssef (Modele_generique_contrat_sous_traitance_
 * construction.docx). C'est le DOCUMENT (en français) : il n'est pas traduit par i18n. Les
 * versions NL / EN devront être rédigées et validées par un juriste avant d'être ajoutées.
 *
 * Ne jamais modifier ce texte pour une version déjà envoyée : l'empreinte SHA-256 du document
 * présenté est figée à l'envoi et vérifiée à la signature. Toute évolution = nouveau modèle (v2).
 */

export const MODELE_SOUS_TRAITANCE_V1 = "sous_traitance_cadre_v1";

export type DonneesContrat = {
  entreprise: {
    denomination: string;
    formeJuridique: string;
    bceTva: string;
    adresse: string;
    pays: string;
    representant: string;
    qualite: string;
  };
  sousTraitant: {
    denomination: string;
    formeJuridique: string;
    bceTva: string;
    siege: string;
    representant: string;
    qualite: string;
    contact: string;
    iban: string;
  };
  fiche: {
    reference: string;
    maitreOuvrage: string;
    adresseChantier: string;
    natureTravaux: string;
    documentsPlans: string;
    dates: string;
    prix: string;
    tva: string;
    etatsAvancement: string;
    delaiPaiementJours: string;
    penaliteJour: string;
    penalitePlafond: string;
    assurances: string;
    securite: string;
    dechets: string;
    reception: string;
    contacts: string;
  };
  garantiesContractuelles: string;
};

/** Champs que le sous-traitant complète ou corrige au moment de signer. */
export type ChampsSousTraitant = Pick<
  DonneesContrat["sousTraitant"],
  "representant" | "qualite" | "contact" | "iban"
>;

export type Bloc =
  | { k: "titre"; t: string }
  | { k: "soustitre"; t: string }
  | { k: "h"; t: string }
  | { k: "p"; t: string }
  | { k: "li"; t: string }
  | { k: "check"; t: string }
  | { k: "ligne"; label: string; valeur: string };

const VIDE = "……………………";

const v = (s: string | null | undefined) => (s ?? "").trim() || VIDE;

/** Données avec les corrections du sous-traitant appliquées. */
export function appliquerChamps(d: DonneesContrat, champs?: Partial<ChampsSousTraitant> | null) {
  if (!champs) return d;
  const st = { ...d.sousTraitant };
  for (const k of ["representant", "qualite", "contact", "iban"] as const) {
    const val = champs[k]?.trim();
    if (val) st[k] = val;
  }
  return { ...d, sousTraitant: st };
}

/** Corps du contrat (parties, articles, annexes). La zone de signature est rendue à part. */
export function rendreContrat(d: DonneesContrat): Bloc[] {
  const EP = d.entreprise.denomination.trim() || "[ENTREPRENEUR PRINCIPAL]";
  const e = d.entreprise;
  const s = d.sousTraitant;
  const f = d.fiche;
  const ep = (t: string) => t.replaceAll("[EP]", EP);
  const p = (t: string): Bloc => ({ k: "p", t: ep(t) });
  const h = (t: string): Bloc => ({ k: "h", t });
  const li = (t: string): Bloc => ({ k: "li", t: ep(t) });

  const penalite =
    f.penaliteJour.trim() || f.penalitePlafond.trim()
      ? `${v(f.penaliteJour)} EUR/jour, plafonnée à ${v(f.penalitePlafond)} EUR`
      : `${VIDE} EUR/jour, plafonnée à ${VIDE} EUR`;

  return [
    { k: "titre", t: "CONTRAT-CADRE DE SOUS-TRAITANCE — TRAVAUX DE CONSTRUCTION — BELGIQUE" },
    { k: "soustitre", t: `Référence : ${v(f.reference)}` },
    h("ENTRE LES SOUSSIGNÉS"),
    p("1. L’ENTREPRENEUR PRINCIPAL / DONNEUR D’ORDRE"),
    p(
      `${v(e.denomination)}, ${v(e.formeJuridique)}, BCE/TVA : ${v(e.bceTva)}. ` +
        `Siège : ${v(e.adresse)}, ${v(e.pays)}. ` +
        `Représentée par : ${v(e.representant)}, ${v(e.qualite)}. Ci-après « ${EP} ».`,
    ),
    p("2. LE SOUS-TRAITANT"),
    { k: "ligne", label: "Dénomination", valeur: v(s.denomination) },
    { k: "ligne", label: "Forme juridique", valeur: v(s.formeJuridique) },
    { k: "ligne", label: "BCE/TVA", valeur: v(s.bceTva) },
    { k: "ligne", label: "Siège", valeur: v(s.siege) },
    {
      k: "ligne",
      label: "Représentant et qualité",
      valeur: `${v(s.representant)}, ${v(s.qualite)}`,
    },
    { k: "ligne", label: "Téléphone / e-mail pour notifications", valeur: v(s.contact) },
    { k: "ligne", label: "Compte bancaire IBAN", valeur: v(s.iban) },
    p("Ci-après « le Sous-traitant »."),
    p("[EP] et le Sous-traitant sont individuellement une « Partie » et ensemble les « Parties »."),

    h("ARTICLE 1 – OBJET ET PORTÉE DU CONTRAT-CADRE"),
    p(
      "Le présent contrat fixe les conditions générales applicables aux travaux de construction, rénovation, parachèvement, démolition, installation ou autres prestations confiés par [EP] au Sous-traitant. Il ne constitue pas, à lui seul, une commande de travaux. Chaque intervention doit faire l’objet d’un bon de commande ou d’une fiche chantier signée par les Parties, précisant au minimum : le maître d’ouvrage, l’adresse du chantier, la description et les limites exactes des prestations, les plans et versions applicables, le prix, le régime TVA, les délais, les étapes de réception et les éventuelles exigences du marché principal.",
    ),
    p(
      "En cas de contradiction, l’ordre de priorité est : (1) avenant signé postérieur, (2) bon de commande/fiche chantier signé, (3) plans et prescriptions expressément identifiés, (4) présent contrat. Les conditions générales du Sous-traitant ne s’appliquent que si [EP] les accepte expressément par écrit.",
    ),

    h("ARTICLE 2 – ABSENCE DE COMMANDE IMPLICITE ET MODIFICATIONS"),
    p(
      "Aucun travail supplémentaire, changement de matériau, adaptation de méthode, prolongation de délai ou dépassement de quantité ne peut être facturé sans demande ou accord écrit préalable d’[EP] précisant son incidence sur le prix et le planning. Une instruction orale doit être confirmée par écrit avant exécution, sauf mesure urgente strictement nécessaire à la sécurité; dans ce cas, le Sous-traitant avertit immédiatement [EP] et documente les faits. Le silence d’[EP] ne vaut pas acceptation d’un supplément.",
    ),

    h("ARTICLE 3 – OBLIGATIONS DU SOUS-TRAITANT"),
    p("Le Sous-traitant s’engage à :"),
    li(
      "exécuter les travaux avec diligence, selon les règles de l’art, les normes applicables, les plans et prescriptions communiqués, ainsi que les instructions écrites d’[EP] compatibles avec la sécurité et la réglementation;",
    ),
    li(
      "vérifier avant démarrage les dimensions, supports, accès, interfaces et documents utiles; signaler par écrit, avant d’exécuter, toute erreur, incohérence, omission ou condition de chantier susceptible d’affecter la qualité, le coût, la sécurité ou le délai;",
    ),
    li(
      "fournir, sauf mention contraire sur la fiche chantier, la main-d’œuvre, l’encadrement, les outils, équipements, consommables et moyens nécessaires à ses prestations;",
    ),
    li(
      "affecter du personnel qualifié, légalement occupé, autorisé à travailler en Belgique et correctement déclaré; respecter les obligations sociales, fiscales, salariales, de détachement, Limosa, Dimona, Checkinatwork et autres formalités applicables selon le cas;",
    ),
    li(
      "respecter les règles de sécurité, le plan de sécurité et de santé, les consignes du coordinateur et du chantier, les règles environnementales, de tri et d’évacuation des déchets;",
    ),
    li(
      "protéger les ouvrages existants, les parties communes, les biens des tiers et les travaux déjà exécutés; réparer à ses frais les dommages imputables à son fait, à son personnel ou à ses sous-traitants;",
    ),
    li(
      "maintenir le chantier propre et évacuer les déchets issus de ses prestations conformément aux règles applicables;",
    ),
    li(
      "remettre sur demande les fiches techniques, certificats, attestations, rapports de contrôle, notices, garanties fournisseurs et documents « as built » relatifs à ses travaux.",
    ),

    h("ARTICLE 4 – AUTORISATIONS, AGRÉATIONS ET SOUS-SOUS-TRAITANCE"),
    p(
      "Le Sous-traitant garantit disposer des inscriptions, accès à la profession, agréments, compétences et autorisations légalement requis pour les prestations commandées. Il remet les preuves à première demande. Il ne peut céder le contrat ni confier tout ou partie des travaux à un tiers sans l’accord écrit préalable d’[EP]. Cet accord ne le libère d’aucune obligation; il demeure responsable des actes et omissions de ses intervenants comme des siens, sous réserve des règles impératives.",
    ),

    h("ARTICLE 5 – CONTRÔLES, NON-CONFORMITÉS ET REPRISES"),
    p(
      "[EP] peut contrôler l’avancement et la conformité des travaux, sans que ce contrôle ne transfère la responsabilité du Sous-traitant à [EP]. Le Sous-traitant avertit [EP] dès qu’une étape doit être contrôlée ou risque d’être masquée. Toute non-conformité est consignée par écrit. Le Sous-traitant propose sans délai un plan de correction et, lorsque la non-conformité lui est imputable, reprend les travaux à ses frais dans le délai raisonnable fixé par [EP]. En cas d’urgence, de refus ou d’inaction après mise en demeure écrite et délai raisonnable, [EP] peut faire exécuter les corrections par un tiers aux frais du Sous-traitant, dans la mesure permise par la loi, et réclamer le dommage prouvé.",
    ),

    h("ARTICLE 6 – DÉLAIS ET RETARDS"),
    p(
      `Les dates de démarrage, jalons et date d’achèvement figurent sur la fiche chantier. Le Sous-traitant informe immédiatement [EP], par écrit, de tout événement pouvant retarder les travaux, en indiquant la cause, la durée estimée et les mesures de mitigation. Une prolongation n’est accordée que pour la durée de l’impact effectivement justifié et non imputable au Sous-traitant, après accord écrit d’[EP], sans préjudice des règles impératives. Une pénalité de retard ne s’applique que si son montant ou sa formule est expressément renseigné dans la fiche chantier et sous réserve du contrôle judiciaire de sa validité et de sa proportionnalité : ${penalite}. À défaut de stipulation complétée, aucun montant forfaitaire de pénalité n’est convenu; le dommage réellement subi peut être réclamé conformément au droit applicable.`,
    ),

    h("ARTICLE 7 – PRIX, FACTURATION ET PAIEMENT"),
    p(
      "Le prix convenu est celui figurant sur la fiche chantier. Sauf stipulation contraire, il couvre l’ensemble des moyens nécessaires aux prestations décrites, les frais, déplacements, manutentions, protections et nettoyage liés à celles-ci. Les travaux supplémentaires sont soumis à l’article 2.",
    ),
    p(
      `Les factures doivent identifier [EP], le chantier, le bon de commande, la période et les prestations réalisées, et joindre les états d’avancement et pièces justificatives convenus. La facture est payable dans le délai légal applicable ou, si la loi le permet, dans le délai expressément convenu sur la fiche chantier : ${v(f.delaiPaiementJours)} jours à compter de la réception d’une facture correcte et des pièces requises. Toute contestation motivée est notifiée dans un délai raisonnable; la partie non contestée demeure payable à l’échéance. Aucune clause ne permet de déroger aux règles impératives en matière de délais de paiement, marchés publics, insolvabilité ou sous-traitance.`,
    ),
    p(
      "[EP] peut compenser les sommes certaines, liquides et exigibles réciproques dans les limites autorisées par la loi. Toute retenue de garantie, retenue de paiement ou compensation liée à une réserve doit être prévue clairement dans la fiche chantier et rester conforme au droit impératif.",
    ),
    p(
      "Toute facture du Sous-traitant sera payée exclusivement par virement bancaire. Aucun paiement en espèces ne sera accepté pour l’exécution du présent contrat.",
    ),

    h("ARTICLE 8 – TVA, FACTURATION ET OBLIGATIONS FISCALES"),
    p(
      "Chaque Partie assume ses obligations fiscales et de facturation. Le Sous-traitant vérifie le régime TVA applicable à l’opération et mentionne sur la facture les mentions légalement requises. Lorsque le mécanisme d’autoliquidation est applicable, la facture comporte la mention légale appropriée et les Parties coopèrent pour vérifier les conditions. Le Sous-traitant fournit les informations nécessaires à la vérification de son statut et informe immédiatement [EP] de tout changement. Le présent contrat ne garantit pas, à lui seul, l’application d’un régime TVA déterminé.",
    ),

    h("ARTICLE 9 – DETTES SOCIALES, FISCALES ET VÉRIFICATIONS LÉGALES"),
    p(
      "Avant le début des travaux et pendant leur exécution, le Sous-traitant fournit les attestations et informations raisonnablement nécessaires à [EP] pour vérifier les obligations légales pertinentes, notamment les règles de retenue sur facture en cas de dettes fiscales ou sociales, les obligations de déclaration et les interdictions de contracter. [EP] peut suspendre le démarrage ou le paiement dans la mesure nécessaire pour respecter une obligation légale ou une notification officielle, après en avoir informé le Sous-traitant. Toute retenue légalement obligatoire est effectuée et versée à l’autorité compétente selon la procédure applicable. Cette clause n’exclut ni ne limite les responsabilités que la loi impose à [EP].",
    ),

    h("ARTICLE 10 – SÉCURITÉ ET BIEN-ÊTRE AU TRAVAIL"),
    p(
      "Le Sous-traitant respecte le Code du bien-être au travail, la législation sur les chantiers temporaires ou mobiles et les instructions de sécurité applicables. Il fournit les EPI, formations, habilitations, contrôles et équipements requis. Il signale immédiatement tout accident, incident, danger ou arrêt de travail et prend les mesures conservatoires nécessaires. [EP] peut faire arrêter une activité présentant un danger ou une non-conformité manifeste, sans que cela dispense le Sous-traitant de ses obligations. La répartition contractuelle des tâches de coordination et de sécurité doit être précisée sur la fiche chantier et ne peut supprimer les responsabilités légales de chaque intervenant.",
    ),

    h("ARTICLE 11 – ASSURANCES"),
    p(
      "Avant toute intervention, le Sous-traitant remet une attestation d’assurance responsabilité civile exploitation et après livraison, couvrant les activités commandées, avec limites de garantie adaptées au chantier. Si les travaux relèvent d’une assurance obligatoire de responsabilité décennale, il remet la preuve de couverture exigée par la loi avant le début des travaux. Les montants, franchises et périodes de couverture sont annexés à la fiche chantier. Le Sous-traitant avertit [EP] sans délai de toute suspension, résiliation ou modification substantielle de ses polices. L’assurance ne limite pas la responsabilité légale ou contractuelle du Sous-traitant.",
    ),

    h("ARTICLE 12 – DOMMAGES, RESPONSABILITÉ ET INDEMNISATION"),
    p(
      "Le Sous-traitant répond, dans les limites prévues par le droit applicable, des dommages directs causés par ses manquements contractuels, ses fautes, celles de son personnel et de ses intervenants, ainsi que des défauts et non-conformités imputables à ses prestations. Il indemnise [EP] des réclamations de tiers, frais raisonnables de défense et coûts de remise en état dans la mesure où ils résultent de ces manquements et sont légalement récupérables. Aucune stipulation ne supprime une responsabilité impérative, notamment en cas de dol, faute intentionnelle ou autre hypothèse pour laquelle une exclusion est interdite. La répartition des responsabilités tient compte des fautes respectives et des règles légales applicables.",
    ),

    h("ARTICLE 13 – RÉCEPTION ET GARANTIES"),
    p(
      `La fin matérielle des travaux ne vaut pas automatiquement réception. Les Parties établissent, lorsque cela est pertinent, un procès-verbal de réception provisoire mentionnant les réserves, responsables et délais de levée, puis un procès-verbal de réception définitive selon la fiche chantier et le marché principal. Le Sous-traitant corrige les réserves qui lui sont imputables dans le délai convenu. La réception ou le paiement ne couvre pas les défauts non apparents ni ne supprime les garanties légales applicables, dont la responsabilité décennale lorsque ses conditions sont réunies. Les garanties contractuelles particulières sont indiquées ici : ${v(d.garantiesContractuelles)}`,
    ),

    h("ARTICLE 14 – SUSPENSION ET RÉSILIATION"),
    p(
      "En cas de manquement important, la Partie lésée adresse une mise en demeure écrite décrivant le manquement et accordant un délai raisonnable pour y remédier, sauf urgence, impossibilité de remède ou autre cas permettant légalement une résolution immédiate. À défaut de remède, elle peut mettre fin au contrat ou à la commande concernée, sans préjudice des dommages prouvés et des règles impératives. [EP] peut suspendre temporairement les travaux pour des motifs de sécurité, de coordination, d’instruction du maître d’ouvrage ou de force majeure, en informant le Sous-traitant et en documentant les conséquences sur les coûts et délais. Les travaux correctement exécutés et non contestés sont décomptés selon le contrat et la loi.",
    ),

    h("ARTICLE 15 – FORCE MAJEURE ET CIRCONSTANCES EXCEPTIONNELLES"),
    p(
      "La Partie qui invoque un événement répondant aux critères légaux de force majeure en informe l’autre Partie sans délai, fournit les justificatifs disponibles et prend les mesures raisonnables pour limiter ses conséquences. Les difficultés ordinaires d’approvisionnement, de personnel ou de trésorerie ne constituent pas automatiquement un cas de force majeure. Les Parties se concertent sur les mesures de continuité, l’adaptation des délais et, si nécessaire, la fin de la commande conformément au droit applicable.",
    ),

    h("ARTICLE 16 – CONFIDENTIALITÉ, PHOTOS ET DONNÉES"),
    p(
      "Le Sous-traitant garde confidentiels les plans, prix, données commerciales, informations du maître d’ouvrage et informations de chantier reçus dans le cadre du contrat. Il ne publie aucune photographie, référence ou information sur le chantier sans autorisation écrite préalable d’[EP] et, le cas échéant, du maître d’ouvrage. Chaque Partie respecte la réglementation applicable en matière de protection des données.",
    ),

    h("ARTICLE 17 – NOTIFICATIONS ET PREUVES"),
    p(
      "Les commandes, avenants, réserves, mises en demeure et demandes de supplément sont adressés aux coordonnées indiquées en tête du contrat, par e-mail permettant d’en conserver la preuve et, lorsqu’une mise en demeure formelle ou la loi l’exige, par recommandé ou tout autre mode légalement valable. Chaque Partie conserve les commandes, plans datés, rapports, photos, feuilles de présence, procès-verbaux et factures utiles à la preuve de l’exécution.",
    ),

    h("ARTICLE 18 – DROIT APPLICABLE ET LITIGES"),
    p(
      "Le contrat est régi par le droit belge. Les Parties recherchent d’abord une solution amiable documentée. À défaut, le litige relève des juridictions matériellement et territorialement compétentes conformément aux règles impératives belges; aucune clause attributive ne déroge aux règles impératives de compétence.",
    ),

    h("ARTICLE 19 – DISPOSITIONS FINALES"),
    p(
      "Toute modification doit être écrite et acceptée par les Parties. Si une clause est invalide, les autres restent applicables dans la mesure permise par la loi; les Parties remplaceront la clause concernée par une stipulation licite se rapprochant de son objectif économique. Le présent contrat et ses fiches chantier constituent l’accord des Parties pour leur objet, sous réserve des documents du marché principal expressément incorporés et communiqués au Sous-traitant avant acceptation.",
    ),

    h("ANNEXE 1 – FICHE DE COMMANDE / CHANTIER"),
    { k: "ligne", label: "Référence de commande", valeur: v(f.reference) },
    { k: "ligne", label: "Maître d’ouvrage / client final", valeur: v(f.maitreOuvrage) },
    { k: "ligne", label: "Adresse complète du chantier", valeur: v(f.adresseChantier) },
    { k: "ligne", label: "Nature et limites exactes des travaux", valeur: v(f.natureTravaux) },
    {
      k: "ligne",
      label: "Documents contractuels et versions des plans",
      valeur: v(f.documentsPlans),
    },
    { k: "ligne", label: "Date de début / jalons / date de fin", valeur: v(f.dates) },
    { k: "ligne", label: "Prix HTVA et méthode (forfait / métrés / régie)", valeur: v(f.prix) },
    { k: "ligne", label: "TVA et mention de facturation applicable", valeur: v(f.tva) },
    { k: "ligne", label: "États d’avancement et pièces à joindre", valeur: v(f.etatsAvancement) },
    {
      k: "ligne",
      label: "Délai de paiement convenu, sous réserve de la loi",
      valeur: f.delaiPaiementJours.trim() ? `${f.delaiPaiementJours.trim()} jours` : VIDE,
    },
    { k: "ligne", label: "Pénalité de retard (si convenue) et plafond", valeur: penalite },
    { k: "ligne", label: "Assurances requises et montants", valeur: v(f.assurances) },
    { k: "ligne", label: "Consignes sécurité / coordinateur / accès", valeur: v(f.securite) },
    { k: "ligne", label: "Déchets, stockage, protections et nettoyage", valeur: v(f.dechets) },
    { k: "ligne", label: "Réception, réserves et garantie contractuelle", valeur: v(f.reception) },
    { k: "ligne", label: "Personnes de contact / e-mails", valeur: v(f.contacts) },

    h("ANNEXE 2 – LISTE DE CONTRÔLE AVANT DÉMARRAGE"),
    { k: "check", t: "Bon de commande et périmètre signés par les deux Parties." },
    { k: "check", t: "Plans, métrés et version des documents identifiés." },
    { k: "check", t: "Prix, TVA, délai de paiement et délais de chantier confirmés." },
    { k: "check", t: "Vérification du statut BCE/TVA et des retenues légalement applicables." },
    { k: "check", t: "Attestations d’assurance reçues et validées." },
    { k: "check", t: "Documents sociaux et autorisations du personnel vérifiés selon le cas." },
    {
      k: "check",
      t: "Limosa / Checkinatwork / déclarations obligatoires vérifiées selon le cas.",
    },
    { k: "check", t: "Consignes de sécurité, coordination et accès chantier communiqués." },
    { k: "check", t: "Autorisation préalable de sous-traitance ultérieure obtenue si nécessaire." },
    { k: "check", t: "Répartition des protections, déchets, stockage et nettoyage convenue." },

    h("RÉFÉRENCES JURIDIQUES"),
    li("Livre 5 du Code civil (obligations et contrats), entré en vigueur le 1er janvier 2023."),
    li(
      "Ancien Code civil, notamment les articles 1792 et 2270 lorsque la responsabilité décennale est applicable, ainsi que les dispositions pertinentes relatives au contrat d’entreprise, sous réserve des réformes législatives et du régime applicable à la date du contrat.",
    ),
    li("Loi du 20 mars 1991 organisant l’agréation d’entrepreneurs de travaux, si applicable."),
    li(
      "Loi du 17 juin 2016 relative aux marchés publics et arrêté royal du 14 janvier 2013 établissant les règles générales d’exécution des marchés publics, uniquement si le chantier relève des marchés publics.",
    ),
    li(
      "Code du bien-être au travail et réglementation relative aux chantiers temporaires ou mobiles.",
    ),
    li(
      "Réglementation TVA belge, notamment l’autoliquidation pour travaux immobiliers lorsque les conditions sont remplies.",
    ),
    li(
      "Réglementation belge relative à la responsabilité solidaire pour les dettes sociales/fiscales et au paiement de la rémunération dans le secteur de la construction.",
    ),
    li("Règles régionales applicables aux déchets, permis, environnement et sécurité incendie."),
  ];
}

/** Phrase « Fait à … le … » de la zone de signature. */
export function faitA(lieu: string | null | undefined, date: string | null | undefined) {
  const d = date ? new Date(date).toLocaleDateString("fr-BE") : "……/……/……";
  return `Fait à ${v(lieu)}, le ${d}, par signature électronique.`;
}

/** Texte brut canonique (base de l'empreinte SHA-256). */
export function texteContrat(blocs: Bloc[]): string {
  return blocs
    .map((b) => (b.k === "ligne" ? `${b.label} : ${b.valeur}` : b.t))
    .join("\n")
    .normalize("NFC");
}

export async function sha256Hex(texte: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texte));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Empreinte du document tel qu'envoyé (sans les corrections du sous-traitant). */
export const empreinteEnvoi = (d: DonneesContrat) => sha256Hex(texteContrat(rendreContrat(d)));

/** Empreinte du document final signé (corrections, lieu et date compris). */
export const empreinteSignee = (
  d: DonneesContrat,
  champs: Partial<ChampsSousTraitant>,
  lieu: string,
  date: string,
) => sha256Hex(`${texteContrat(rendreContrat(appliquerChamps(d, champs)))}\n${faitA(lieu, date)}`);

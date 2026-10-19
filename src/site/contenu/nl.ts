/* Contenu éditorial du site vitrine (néerlandais), hors i18next. */
import type { InterfaceSite, PageSite, Source } from "../types";

const C = "2026-10-19";
const MAJ = "2026-10-19";

const S: Record<string, Source> = {
  rszInhouding: {
    titre: "RSZ — Inhouding op factuur: raadpleging, voorbereiding en betaling",
    url: "https://www.socialsecurity.be/site_nl/employer/applics/30bis/general/invoice.htm",
    consulteLe: C,
  },
  check: {
    titre: "RSZ / FOD Financiën — Check inhoudingsplicht",
    url: "https://www.checkinhoudingsplicht.be",
    consulteLe: C,
  },
  btw6: {
    titre: "FOD Financiën — Verbouwen: btw-tarief",
    url: "https://fin.belgium.be/nl/particulieren/woning/bouwen-verbouwen/verbouwen/verbouwen-btw-tarief",
    consulteLe: C,
  },
  caw: {
    titre: "Sociale zekerheid — Checkinatwork: werken in onroerende staat",
    url: "https://www.socialsecurity.be/site_nl/employer/applics/checkinatwork/general/construction-works.htm",
    consulteLe: C,
  },
  limosa: {
    titre: "Sociale zekerheid — Limosa: wie moet gemeld worden?",
    url: "https://www.socialsecurity.be/site_nl/employer/applics/meldingsplicht/wie_melden.htm",
    consulteLe: C,
  },
  verlegging: {
    titre: "Baker Tilly — Btw-verlegging bij werk in onroerende staat: nieuwe factuurvermelding",
    url: "https://bakertilly.be/nl/news/btw-verlegging-bij-werk-in-onroerende-staat-nieuwe-factuurvermelding-voor-belgische-aannemers/",
    consulteLe: C,
  },
};

const DISCLAIMER =
  "Algemene informatie, bijgewerkt op 19/10/2026 op basis van de vermelde officiële bronnen. Ze vervangt niet het advies van uw boekhouder of sociaal secretariaat: controleer altijd de geldende regel voor u ze toepast.";

export const interfaceNl: InterfaceSite = {
  langueNom: "Nederlands",
  nav: {
    fonctions: "Functies",
    tarifs: "Prijzen",
    guides: "Gidsen",
    faq: "FAQ",
    connexion: "Aanmelden",
  },
  demo: "Demo aanvragen",
  autreLangue: "Français",
  piedTexte:
    "ZidarPro helpt Belgische bouwbedrijven om in orde te werken met hun onderaannemers: controle van de inhoudingsplicht, contracten, prestaties, inhoudingen en conformiteitsbewijzen.",
  piedFonctions: "Functies",
  piedRessources: "Hulpmiddelen",
  piedLegal: "Informatie",
  mentionsLegales: "Wettelijke vermeldingen",
  majLe: "Bijgewerkt op",
  sources: "Officiële bronnen",
  consulteLe: "geraadpleegd op",
  telecharger: "Model downloaden (pdf)",
  reponse: "Kort",
  ariane: "Kruimelpad",
  accueil: "Home",
  ouvrirApp: "Applicatie openen",
  formulaire: {
    titre: "Uw demo-aanvraag",
    nom: "Naam en voornaam",
    societe: "Bedrijf",
    email: "Professioneel e-mailadres",
    telephone: "Telefoon (optioneel)",
    message: "Uw activiteit en behoeften (optioneel)",
    envoyer: "E-mail voor de aanvraag opstellen",
    note: "De knop opent uw mailprogramma met een vooraf ingevulde e-mail: er wordt niets op deze site opgeslagen.",
    indisponible:
      "Het formulier wordt binnenkort geactiveerd. Neem intussen contact met ons op via het gebruikelijke kanaal.",
    sujet: "Demo-aanvraag ZidarPro",
  },
  illustration: "Illustratie van de interface (fictieve gegevens)",
  legal: {
    enAttente:
      "De gegevens van de uitgever (benaming, adres, ondernemingsnummer, contact) worden hier binnenkort gepubliceerd.",
    editeur: "Uitgever",
    adresse: "Adres",
    bce: "Ondernemingsnummer",
    contact: "Contact",
  },
  illus: {
    verification: {
      titre: "Betaling — Électricité Lambert SRL",
      lignes: [
        { libelle: "Controle inhoudingsplicht van de dag", valeur: "19/10 om 09:42", etat: "ok" },
        { libelle: "Schermafdruk van de raadpleging", valeur: "Opgeslagen", etat: "ok" },
        { libelle: "Sociale schuld (RSZ)", valeur: "Geen", etat: "ok" },
        { libelle: "Fiscale schuld (FOD Financiën)", valeur: "Geen", etat: "ok" },
        { libelle: "Te betalen bedrag", valeur: "12 100,00 €", etat: "neutre" },
      ],
    },
    retenue: {
      titre: "Betaling — Dakwerken Peeters BV",
      lignes: [
        { libelle: "Factuur excl. btw", valeur: "10 000,00 €", etat: "neutre" },
        { libelle: "Vastgestelde RSZ-schuld", valeur: "3 000,00 €", etat: "alerte" },
        { libelle: "Inhouding RSZ (begrensd tot de schuld)", valeur: "3 000,00 €", etat: "alerte" },
        { libelle: "Inhouding FOD Financiën", valeur: "0,00 €", etat: "neutre" },
        { libelle: "Te betalen aan de onderaannemer", valeur: "7 000,00 €", etat: "ok" },
      ],
    },
    conformite: {
      titre: "Conformiteit — Nowak Bud Sp. z o.o.",
      lignes: [
        {
          libelle: "Attest inhoudingsplicht (30bis)",
          valeur: "Vervalt binnen 18 dagen",
          etat: "alerte",
        },
        { libelle: "Btw-attest", valeur: "Geldig", etat: "ok" },
        { libelle: "IBAN gevalideerd", valeur: "Ja", etat: "ok" },
        { libelle: "Contract online ondertekend", valeur: "Ja", etat: "ok" },
      ],
    },
    devis: {
      titre: "Offerte D-2026-014 — renovatie badkamer",
      lignes: [
        { libelle: "Taal van de klant", valeur: "Nederlands", etat: "neutre" },
        { libelle: "Btw", valeur: "6 %", etat: "neutre" },
        { libelle: "Wettelijke vermelding 6 % btw", valeur: "Afgedrukt", etat: "ok" },
        { libelle: "Totaal incl. btw", valeur: "9 540,00 €", etat: "neutre" },
      ],
    },
    chantier: {
      titre: "Werf — Renovatie Hoogstraat 12",
      lignes: [
        { libelle: "Ingevoerde prestaties", valeur: "30", etat: "neutre" },
        { libelle: "Uren onderaanneming", valeur: "270 u", etat: "neutre" },
        { libelle: "Betaald excl. btw", valeur: "5 500,00 €", etat: "neutre" },
        { libelle: "Gestorte inhoudingen 30bis", valeur: "825,00 €", etat: "ok" },
      ],
    },
  },
};

export const pagesNl: PageSite[] = [
  {
    cle: "accueil",
    type: "accueil",
    chemin: "",
    titre: "ZidarPro — Onderaanneming en inhoudingsplicht in orde",
    description:
      "Belgische bouwsoftware: controle inhoudingsplicht voor elke betaling, online ondertekende contracten, prestaties, inhoudingen en conformiteitsbewijzen.",
    h1: "Uw onderaannemers in orde, elke betaling bewezen",
    chapo:
      "ZidarPro controleert de inhoudingsplicht voor elke betaling, berekent de inhoudingen, laat uw contracten online ondertekenen en bewaart alle conformiteitsbewijzen op één plek.",
    majLe: MAJ,
    blocs: [
      { type: "cta" },
      { type: "illustration", variante: "verification" },
      { type: "h2", texte: "Het risico dat ZidarPro u bespaart", id: "risico" },
      {
        type: "p",
        texte:
          "Betaalt u een onderaannemer met sociale of fiscale schulden zonder de verplichte inhouding, dan riskeert u een administratieve geldboete en hoofdelijke aansprakelijkheid voor zijn schulden. U moet controleren bij de ondertekening van het contract en voor elke betaling ([RSZ](https://www.socialsecurity.be/site_nl/employer/applics/30bis/general/invoice.htm)).",
      },
      { type: "h2", texte: "De volledige cyclus van de onderaanneming", id: "functies" },
      {
        type: "cartes",
        items: [
          {
            titre: "Controle inhoudingsplicht",
            texte:
              "Controle van de dag verplicht voor elke betaling, schermafdruk bewaard, waarschuwing bij schulden.",
            lien: "/nl/functies/controle-inhoudingsplicht",
          },
          {
            titre: "Onderaannemers en conformiteit",
            texte:
              "Attesten, gevalideerd IBAN, ondertekend contract: status van elke onderaannemer en automatische blokkering.",
            lien: "/nl/functies/onderaannemers-conformiteit",
          },
          {
            titre: "Offertes en btw-verlegging",
            texte:
              "Offertes in het Nederlands, Frans of Engels met de wettelijke vermeldingen voor 6 % btw en verlegging van heffing.",
            lien: "/nl/functies/offertes-btw-verlegging",
          },
          {
            titre: "Werfbeheer",
            texte:
              "Werven, dagboek van de prestaties van onderaannemers, totalen van uren en bedragen, exports.",
            lien: "/nl/functies/werfbeheer",
          },
        ],
      },
      { type: "h2", texte: "Hoe het werkt", id: "werking" },
      {
        type: "etapes",
        items: [
          {
            titre: "Voer uw onderaannemers in",
            texte: "Ondernemingsnummer, IBAN, attesten: ZidarPro berekent hun conformiteitsstatus.",
          },
          {
            titre: "Laat het contract online ondertekenen",
            texte:
              "Een beveiligde link, een handtekening op het scherm, een audittrail en een ondertekende pdf voor beide partijen.",
          },
          {
            titre: "Betaal in orde",
            texte:
              "Voor elke betaling: controle van de dag, berekende en begrensde inhouding, bedrag voor de onderaannemer, de RSZ en de FOD Financiën.",
          },
          {
            titre: "Bewaar de bewijzen",
            texte:
              "Register van inhoudingen, conformiteitsdossier in pdf per onderaannemer en export voor uw boekhouder.",
          },
        ],
      },
      { type: "h2", texte: "Voor Belgische kmo's in de bouw" },
      {
        type: "liste",
        items: [
          "Algemene en gespecialiseerde aannemers die met onderaannemers werken.",
          "Interface in het Nederlands, Frans, Engels, Roemeens en Pools; documenten voor uw klanten in het Nederlands, Frans of Engels.",
          "Belgische formaten: bedragen, datums, btw- en ondernemingsnummers.",
        ],
      },
      { type: "h2", texte: "Praktische gidsen" },
      {
        type: "cartes",
        items: [
          {
            titre: "Een onderaannemer controleren",
            texte: "De controles voor de ondertekening en voor elke betaling.",
            lien: "/nl/gidsen/onderaannemer-controleren",
          },
          {
            titre: "Factuur met 6 % btw",
            texte: "Voorwaarden en officiële vermelding op de factuur.",
            lien: "/nl/gidsen/factuur-btw-6-procent",
          },
          {
            titre: "Inhoudingsplicht",
            texte: "Percentages, plafond, betaling aan de RSZ en de FOD Financiën, sancties.",
            lien: "/nl/gidsen/inhoudingsplicht",
          },
        ],
      },
      { type: "cta", texte: "Ontdek ZidarPro op uw eigen dossiers in 30 minuten." },
    ],
  },
  {
    cle: "f-30bis",
    type: "fonction",
    chemin: "functies/controle-inhoudingsplicht",
    titre: "Controle inhoudingsplicht voor elke betaling | ZidarPro",
    description:
      "Controle van de inhoudingsplicht op de betaaldag, schermafdruk bewaard, inhouding RSZ en FOD Financiën berekend en begrensd, register van inhoudingen.",
    h1: "Controle van de inhoudingsplicht voor elke betaling",
    chapo:
      "ZidarPro registreert een betaling aan een onderaannemer pas na een controle van de inhoudingsplicht op dezelfde dag.",
    majLe: MAJ,
    parents: ["accueil"],
    blocs: [
      { type: "illustration", variante: "retenue" },
      { type: "h2", texte: "Wat ZidarPro doet" },
      {
        type: "liste",
        items: [
          "Rechtstreekse link naar de officiële dienst Check inhoudingsplicht, ondernemingsnummer vooraf ingevuld.",
          "Resultaat geregistreerd en gedateerd (Brusselse tijd), met de schermafdruk van de raadpleging, achteraf niet meer te wijzigen.",
          "Betaling geweigerd zonder controle van de dag voor deze onderaannemer.",
          "Bij schulden: sociale (RSZ) en fiscale (FOD Financiën) inhouding berekend op het bedrag exclusief btw, begrensd tot de meegedeelde schuld en het bedrag van de betaling.",
          "Bedragen voor de onderaannemer, de RSZ en de FOD Financiën getoond bij de betaling.",
          "Register van inhoudingen (csv en pdf) en export voor uw boekhouder.",
        ],
      },
      {
        type: "avertissement",
        texte:
          "De inhoudingspercentages zijn gedateerde parameters, als indicatief voorgesteld: laat ze valideren door uw boekhouder. Het door de RSZ aangekondigde RSVZ-luik (zelfstandigen) wordt nog niet door ZidarPro beheerd.",
      },
      {
        type: "p",
        texte:
          "Lees onze gidsen [Een onderaannemer controleren](/nl/gidsen/onderaannemer-controleren) en [Inhoudingsplicht](/nl/gidsen/inhoudingsplicht).",
      },
      { type: "cta" },
    ],
  },
  {
    cle: "f-devis",
    type: "fonction",
    chemin: "functies/offertes-btw-verlegging",
    titre: "Offertes, 6 % btw en btw-verlegging | ZidarPro",
    description:
      "Offertes in het Nederlands, Frans of Engels met de volledige wettelijke vermeldingen: 6 % btw bij renovatie en verlegging van heffing (medecontractant).",
    h1: "Offertes met 6 % btw en btw-verlegging",
    chapo:
      "Maak offertes in de taal van uw klant, met de volledige wettelijke vermeldingen voor 6 % btw en verlegging van heffing.",
    majLe: MAJ,
    parents: ["accueil"],
    blocs: [
      { type: "illustration", variante: "devis" },
      { type: "h2", texte: "Wat ZidarPro doet" },
      {
        type: "liste",
        items: [
          "Offertes in pdf in het Nederlands, Frans of Engels, volgens de taal van uw klant.",
          "6 % btw: de officiële vermelding van de FOD Financiën wordt op het document gedrukt.",
          "Verlegging van heffing (medecontractant): de volledige vermelding die sinds 1 januari 2023 vereist is, wordt op het document gedrukt.",
          "Meerdere btw-tarieven per offerte, totalen per tarief.",
          "Belgische formaten: bedragen, datums, btw- en ondernemingsnummers.",
        ],
      },
      {
        type: "p",
        texte:
          "De voorwaarden voor 6 % btw staan in onze gids [Factuur met 6 % btw](/nl/gidsen/factuur-btw-6-procent).",
      },
      { type: "cta" },
    ],
  },
  {
    cle: "f-chantiers",
    type: "fonction",
    chemin: "functies/werfbeheer",
    titre: "Werfbeheer en prestaties van onderaannemers | ZidarPro",
    description:
      "Werven, dagboek van de prestaties van onderaannemers, uren en arbeiders, totalen per onderaannemer, exports in csv en pdf van het werfdagboek.",
    h1: "Werfbeheer",
    chapo:
      "Volg uw werven en wat elke onderaannemer er werkelijk gepresteerd heeft, met de betaalde en ingehouden bedragen.",
    majLe: MAJ,
    parents: ["accueil"],
    blocs: [
      { type: "illustration", variante: "chantier" },
      { type: "h2", texte: "Wat ZidarPro doet" },
      {
        type: "liste",
        items: [
          "Werffiche: klant, adres, budget, vordering, gekoppelde onderaannemingscontracten.",
          "Dagboek van de prestaties: datum, uren, arbeiders (naam, functie, uren), vakje Checkinatwork, validatie door een beheerder.",
          "Een prestatie rechtstreeks vanuit de werf invoeren, met blokkering als de onderaannemer niet in orde is.",
          "Totalen per onderaannemer: uren, forfait, betaald exclusief btw, inhoudingen, gestort, nog te betalen.",
          "Export van het werfdagboek in csv en pdf.",
        ],
      },
      {
        type: "p",
        texte:
          "Voor de registratie van aanwezigheden: zie de vraag over Checkinatwork in onze [FAQ](/nl/veelgestelde-vragen).",
      },
      { type: "cta" },
    ],
  },
  {
    cle: "f-conformite",
    type: "fonction",
    chemin: "functies/onderaannemers-conformiteit",
    titre: "Onderaannemers en conformiteit | ZidarPro",
    description:
      "Conformiteit van elke onderaannemer: attesten inhoudingsplicht en btw, gevalideerd IBAN, online ondertekend contract, waarschuwingen en blokkering.",
    h1: "Onderaannemers en conformiteit",
    chapo:
      "Een duidelijke status voor elke onderaannemer, waarschuwingen voor de vervaldag van attesten en een bewijsdossier dat klaar is om voor te leggen.",
    majLe: MAJ,
    parents: ["accueil"],
    blocs: [
      { type: "illustration", variante: "conformite" },
      { type: "h2", texte: "Wat ZidarPro doet" },
      {
        type: "liste",
        items: [
          "Vier vereisten opgevolgd: attest inhoudingsplicht (30bis), btw-attest, gevalideerd IBAN, onderaannemingscontract.",
          "Waarschuwingen 30 dagen voor de vervaldag van een attest, op het dashboard.",
          "Toewijzing aan een werf geblokkeerd als het 30bis-attest niet geldig is, behalve met een gemotiveerde afwijking (maximaal 30 dagen, herroepbaar).",
          "Onderaannemingscontract online ondertekend via een beveiligde link: handtekening op het scherm, audittrail (tijdstempel, vingerafdruk van het document) en ondertekende pdf.",
          "Conformiteitsdossier in pdf per onderaannemer: attesten, controles, contracten, betalingen en inhoudingen.",
          "Documenten bewaard als bewijs: nooit verwijderd, alleen ongeldig verklaard met een reden.",
        ],
      },
      {
        type: "avertissement",
        texte:
          "Het meegeleverde contractmodel is een algemeen model dat u door uw jurist moet laten valideren.",
      },
      { type: "cta" },
    ],
  },
  {
    cle: "tarifs",
    type: "tarifs",
    chemin: "prijzen",
    titre: "Prijzen ZidarPro — op aanvraag",
    description:
      "Prijzen van ZidarPro op aanvraag, volgens de grootte van uw bedrijf en het aantal onderaannemers. Vraag een gepersonaliseerde demo aan.",
    h1: "Prijzen",
    chapo:
      "Onze prijzen worden op aanvraag opgesteld, volgens de grootte van uw bedrijf en het aantal onderaannemers dat u beheert.",
    majLe: MAJ,
    parents: ["accueil"],
    blocs: [
      { type: "h2", texte: "Prijzen op aanvraag" },
      {
        type: "liste",
        items: [
          "Demonstratie op uw eigen dossiers: inhoudingsplicht, contracten, inhoudingen.",
          "Voorstel aangepast aan uw activiteit.",
          "Interface in 5 talen en documenten NL / FR / EN inbegrepen.",
        ],
      },
      { type: "cta" },
    ],
  },
  {
    cle: "faq",
    type: "faq",
    chemin: "veelgestelde-vragen",
    titre: "FAQ inhoudingsplicht, Checkinatwork, Limosa | ZidarPro",
    description:
      "Korte antwoorden met bronnen: inhoudingsplicht, Checkinatwork, Limosa, verlegging van heffing en berekening van de inhoudingen.",
    h1: "Veelgestelde vragen",
    chapo: "Korte antwoorden, met een link naar de officiële bron.",
    majLe: MAJ,
    parents: ["accueil"],
    blocs: [
      { type: "h2", texte: "Inhoudingsplicht (30bis)" },
      {
        type: "faq",
        items: [
          {
            q: "Wanneer moet ik de inhoudingsplicht van een onderaannemer controleren?",
            r: "Bij de ondertekening van het contract en voor elke betaling van een factuur, via de dienst Check inhoudingsplicht (RSZ / FOD Financiën). Zie onze gids [Een onderaannemer controleren](/nl/gidsen/onderaannemer-controleren).",
          },
          {
            q: "Wie is betrokken?",
            r: "Opdrachtgevers, aannemers en onderaannemers die onder meer werken in onroerende staat uitvoeren. Particulieren die werken laten uitvoeren voor strikt privédoeleinden vallen er niet onder (bron: RSZ).",
          },
          {
            q: "Wat riskeert u als u niet inhoudt?",
            r: "Een administratieve geldboete en hoofdelijke aansprakelijkheid voor de fiscale en sociale schulden van de medecontractant (bron: RSZ).",
          },
        ],
      },
      { type: "h2", texte: "Inhoudingen" },
      {
        type: "faq",
        items: [
          {
            q: "Wat zijn de inhoudingspercentages?",
            r: "Volgens de RSZ: 15 % voor het fiscale luik (FOD Financiën), 35 % voor het sociale luik (RSZ en/of fondsen), 15 % voor het RSVZ, berekend op het bedrag exclusief btw, met een plafond van 50 %. Details in onze gids [Inhoudingsplicht](/nl/gidsen/inhoudingsplicht).",
          },
          {
            q: "Hoe stort u de inhouding?",
            r: "Tegelijk met de betaling van de factuur: sociaal luik op de rekening die de RSZ aangeeft, met de gestructureerde mededeling die bij de voorbereiding wordt aangemaakt; fiscaal luik na het attest van de FOD Financiën (bron: RSZ).",
          },
        ],
      },
      { type: "h2", texte: "Checkinatwork" },
      {
        type: "faq",
        items: [
          {
            q: "Vanaf welk bedrag moeten aanwezigheden geregistreerd worden?",
            r: "Voor werken in onroerende staat die na 29/02/2016 begonnen zijn, zodra het totaalbedrag 500 000 euro exclusief btw bereikt, bij de start of tijdens de werken (bron: sociale zekerheid, Checkinatwork).",
          },
          {
            q: "Wanneer registreert u de aanwezigheid?",
            r: "Voordat de persoon begint te werken op de werf. De aangevende aannemer zorgt ervoor dat de aanwezigheden geregistreerd worden (bron: sociale zekerheid, Checkinatwork).",
          },
        ],
      },
      { type: "h2", texte: "Limosa" },
      {
        type: "faq",
        items: [
          {
            q: "Wie moet een Limosa-melding krijgen?",
            r: "Werknemers die tijdelijk of gedeeltelijk in België komen werken en in principe niet aan de Belgische sociale zekerheid onderworpen zijn; en zelfstandigen die tijdelijk een activiteit komen uitoefenen in een risicosector, waaronder de bouw. Er bestaan uitzonderingen, onder meer voor korte opdrachten (bron: sociale zekerheid, Limosa).",
          },
        ],
      },
      { type: "h2", texte: "Verlegging van heffing (btw)" },
      {
        type: "faq",
        items: [
          {
            q: "Wat is btw-verlegging in de bouw?",
            r: "Voor bepaalde werken in onroerende staat rekent de aannemer geen btw aan; de btw is verschuldigd door zijn klant (de medecontractant), wanneer die een belastingplichtige is die periodieke btw-aangiften indient.",
          },
          {
            q: "Welke vermelding moet op de factuur?",
            r: "Sinds 1 januari 2023 volstaat de korte vermelding niet meer: de factuur moet de volledige vermelding bevatten die het koninklijk besluit van 26 oktober 2022 voorschrijft (vermoeden van erkenning door de klant, behalve bij schriftelijke betwisting binnen een maand). ZidarPro drukt ze op uw offertes. Laat de tekst valideren door uw boekhouder.",
          },
        ],
      },
      { type: "h2", texte: "ZidarPro" },
      {
        type: "faq",
        items: [
          {
            q: "Vervangt ZidarPro mijn boekhouder of sociaal secretariaat?",
            r: "Nee. ZidarPro organiseert de controles, berekeningen en bewijzen; percentages en regels moet uw boekhouder of sociaal secretariaat valideren.",
          },
          {
            q: "Hoe kan ik ZidarPro uitproberen?",
            r: "Via een demo-aanvraag: we tonen ZidarPro op uw eigen dossiers. [Demo aanvragen](/nl/demo-aanvragen).",
          },
        ],
      },
      { type: "sources", items: [S.rszInhouding, S.caw, S.limosa, S.verlegging] },
      { type: "cta" },
    ],
  },
  {
    cle: "guides",
    type: "guides",
    chemin: "gidsen",
    titre: "Praktische bouwgidsen: inhoudingsplicht, 6 % btw | ZidarPro",
    description:
      "Praktische gidsen met bronnen voor Belgische bouwbedrijven: een onderaannemer controleren, factuur met 6 % btw, inhoudingsplicht.",
    h1: "Praktische gidsen",
    chapo:
      "Rechtstreekse antwoorden, duidelijke stappen, een model om te downloaden en de officiële bronnen.",
    majLe: MAJ,
    parents: ["accueil"],
    blocs: [
      {
        type: "cartes",
        items: [
          {
            titre: "Een onderaannemer controleren",
            texte:
              "De controles voor de ondertekening en voor elke betaling, en de bewijzen om te bewaren.",
            lien: "/nl/gidsen/onderaannemer-controleren",
          },
          {
            titre: "Factuur met 6 % btw",
            texte: "De voorwaarden en de officiële vermelding op de factuur.",
            lien: "/nl/gidsen/factuur-btw-6-procent",
          },
          {
            titre: "Inhoudingsplicht",
            texte: "Percentages, plafond, beperking, betaling en sancties.",
            lien: "/nl/gidsen/inhoudingsplicht",
          },
        ],
      },
    ],
  },
  {
    cle: "g-verifier",
    type: "guide",
    chemin: "gidsen/onderaannemer-controleren",
    titre: "Een onderaannemer controleren: stappen en bewijzen",
    description:
      "Een onderaannemer controleren in België: inhoudingsplicht voor elke betaling, bewijzen om te bewaren, Checkinatwork en Limosa. Checklist in pdf.",
    h1: "Een onderaannemer controleren: de controles voor ondertekening en betaling",
    majLe: MAJ,
    parents: ["accueil", "guides"],
    blocs: [
      {
        type: "reponse",
        titre: "Kort",
        texte:
          "Raadpleeg voor de ondertekening van het contract en voor elke betaling de officiële dienst Check inhoudingsplicht met het ondernemingsnummer van de onderaannemer. Geeft die een inhoudingsplicht aan, houd dan het voorziene percentage in op het bedrag exclusief btw en stort het aan de RSZ en/of de FOD Financiën, tegelijk met de betaling. Bewaar een gedateerd bewijs van elke raadpleging.",
      },
      { type: "h2", texte: "De stappen" },
      {
        type: "etapes",
        items: [
          {
            titre: "Vraag het ondernemingsnummer (KBO)",
            texte:
              "Dat is de sleutel voor alle raadplegingen. Controleer of het overeenkomt met het bedrijf dat factureert.",
          },
          {
            titre: "Raadpleeg de inhoudingsplicht bij de ondertekening",
            texte:
              "Op [Check inhoudingsplicht](https://www.checkinhoudingsplicht.be). Voor een groot aantal bedrijven biedt de RSZ de webdienst Billretainment aan.",
          },
          {
            titre: "Raadpleeg opnieuw voor elke betaling",
            texte:
              "De situatie verandert: de gegevens worden elke maand bijgewerkt, op de vrijdag na de laatste donderdag van de maand (bron: RSZ). Een oude raadpleging dekt geen nieuwe betaling.",
          },
          {
            titre: "Bewaar een gedateerd bewijs",
            texte:
              "Datum, uur, resultaat en schermafdruk of attest van de raadpleging, gekoppeld aan de betreffende betaling.",
          },
          {
            titre: "Is er een inhoudingsplicht, pas ze toe",
            texte:
              "Bereken de inhouding op het bedrag exclusief btw en stort ze tegelijk met de betaling. Zie de gids [Inhoudingsplicht](/nl/gidsen/inhoudingsplicht).",
          },
          {
            titre: "Controleer de andere verplichtingen van de werf",
            texte:
              "Registratie van aanwezigheden (Checkinatwork) als de werf 500 000 euro exclusief btw bereikt, en Limosa-melding voor een onderaannemer of werknemers uit het buitenland (zie de [FAQ](/nl/veelgestelde-vragen)).",
          },
        ],
      },
      {
        type: "modele",
        fichier: "/modeles/nl/checklist-controle-onderaannemer.pdf",
        libelle: "Checklist: een onderaannemer controleren",
        description: "Eén pagina om af te drukken of bij elk betalingsdossier te voegen.",
      },
      { type: "h2", texte: "Met ZidarPro" },
      {
        type: "p",
        texte:
          "ZidarPro vereist de controle van de dag voor een betaling wordt geregistreerd, bewaart de schermafdruk en berekent de inhouding. Zie [Controle inhoudingsplicht](/nl/functies/controle-inhoudingsplicht).",
      },
      { type: "avertissement", texte: DISCLAIMER },
      { type: "sources", items: [S.rszInhouding, S.check, S.caw, S.limosa] },
      { type: "cta" },
    ],
  },
  {
    cle: "g-tva6",
    type: "guide",
    chemin: "gidsen/factuur-btw-6-procent",
    titre: "Factuur met 6 % btw: voorwaarden en vermelding",
    description:
      "6 % btw voor de renovatie van een woning ouder dan 10 jaar: voorwaarden, aard van de werken en officiële vermelding op de factuur. Model in pdf.",
    h1: "Factuur met 6 % btw: voorwaarden en wettelijke vermelding",
    majLe: MAJ,
    parents: ["accueil", "guides"],
    blocs: [
      {
        type: "reponse",
        titre: "Kort",
        texte:
          "Het btw-tarief van 6 % kan gelden voor de renovatie van een privéwoning waarvan de eerste ingebruikneming minstens tien jaar oud is, voor werken die verstrekt en gefactureerd worden aan een eindverbruiker. Sinds 2022 moet de klant geen attest meer ondertekenen: de factuur moet de elementen bevatten die het verlaagde tarief rechtvaardigen en de officiële vermelding van de FOD Financiën.",
      },
      { type: "h2", texte: "De voorwaarden" },
      {
        type: "liste",
        items: [
          "Ouderdom: eerste ingebruikneming in een kalenderjaar dat ten minste tien jaar voorafgaat aan de datum van de eerste factuur voor de werken.",
          "Gebruik: na de werken wordt de woning uitsluitend of hoofdzakelijk als privéwoning gebruikt.",
          "Klant: de werken worden verstrekt en gefactureerd aan een eindverbruiker.",
          "Aard: verbouwing, renovatie, verbetering, herstelling of onderhoud (behalve reiniging) van de woning.",
        ],
      },
      {
        type: "p",
        texte:
          "Let op: zijn de werken te ingrijpend (uitbreiding van de oppervlakte, toevoeging van dragende muren…), dan kan het om nieuwbouw gaan, waarop 21 % van toepassing is (bron: FOD Financiën).",
      },
      { type: "h2", texte: "De stappen" },
      {
        type: "etapes",
        items: [
          {
            titre: "Controleer de voorwaarden met uw klant",
            texte: "Ouderdom van de woning, privégebruik na de werken, klant als eindverbruiker.",
          },
          {
            titre: "Beschrijf de werken op de factuur",
            texte:
              "De factuur vermeldt alle elementen die de toepassing van het tarief van 6 % rechtvaardigen.",
          },
          {
            titre: "Neem de officiële vermelding over",
            texte: "De exacte tekst staat hieronder en in het model om te downloaden.",
          },
          {
            titre: "Bij betwisting",
            texte:
              "De klant heeft een maand vanaf de ontvangst van de factuur om schriftelijk te betwisten; u bezorgt dan een verbeterde factuur.",
          },
        ],
      },
      { type: "h2", texte: "De officiële vermelding (FOD Financiën)" },
      {
        type: "p",
        texte:
          "„Btw-tarief: Bij gebrek aan schriftelijke betwisting binnen een termijn van één maand vanaf de ontvangst van de factuur, wordt de klant geacht te erkennen dat: (1) de werken worden verricht aan een woning waarvan de eerste ingebruikneming heeft plaatsgevonden in een kalenderjaar dat ten minste tien jaar voorafgaat aan de datum van de eerste factuur met betrekking tot die werken, (2) de woning, na uitvoering van die werken, uitsluitend of hoofdzakelijk als privéwoning wordt gebruikt en (3) de werken worden verstrekt en gefactureerd aan een eindverbruiker. Wanneer minstens één van die voorwaarden niet is voldaan, zal het normale btw-tarief van 21 % van toepassing zijn en is de afnemer ten aanzien van die voorwaarden aansprakelijk voor de betaling van de verschuldigde belasting, interesten en geldboeten.”",
      },
      {
        type: "modele",
        fichier: "/modeles/nl/model-factuur-btw-6.pdf",
        libelle: "Model van factuur met 6 % btw",
        description: "Structuur van de factuur en officiële vermelding om over te nemen.",
      },
      { type: "h2", texte: "Met ZidarPro" },
      {
        type: "p",
        texte:
          "ZidarPro drukt de officiële vermelding op uw offertes, in het Nederlands, Frans of Engels. Zie [Offertes en btw-verlegging](/nl/functies/offertes-btw-verlegging).",
      },
      { type: "avertissement", texte: DISCLAIMER },
      { type: "sources", items: [S.btw6] },
      { type: "cta" },
    ],
  },
  {
    cle: "g-retenue",
    type: "guide",
    chemin: "gidsen/inhoudingsplicht",
    titre: "Inhoudingsplicht (30bis): percentages en betaling",
    description:
      "Inhoudingsplicht op factuur: wie is betrokken, percentages RSZ, FOD Financiën en RSVZ, plafond, beperking, betaling en sancties. Berekeningsfiche in pdf.",
    h1: "Inhoudingsplicht (30bis): percentages, betaling en sancties",
    majLe: MAJ,
    parents: ["accueil", "guides"],
    blocs: [
      {
        type: "reponse",
        titre: "Kort",
        texte:
          "Heeft uw medecontractant sociale of fiscale schulden, dan moet u een percentage van het bedrag exclusief btw van zijn factuur inhouden en rechtstreeks aan de RSZ en/of de FOD Financiën storten, tegelijk met de betaling. De controle gebeurt bij de ondertekening van het contract en voor elke betaling.",
      },
      { type: "h2", texte: "Wie is betrokken?" },
      {
        type: "p",
        texte:
          "Opdrachtgevers, aannemers en onderaannemers in de vastgoedsector (en ook bewaking en vleesbereiding). Particulieren die werken laten uitvoeren voor strikt privédoeleinden vallen er niet onder. Voor zelfstandigen geldt de uitbreiding naar sociale schulden enkel voor activiteiten in onroerende staat (bron: RSZ).",
      },
      { type: "h2", texte: "De percentages (bron: RSZ)" },
      {
        type: "tableau",
        entetes: ["Luik", "Instelling", "Percentage op het bedrag excl. btw"],
        lignes: [
          ["Fiscaal", "FOD Financiën", "15 %"],
          ["Sociaal", "RSZ en/of fondsen (OPOC / FSEG)", "35 %"],
          ["Sociaal (zelfstandigen)", "RSVZ", "15 %"],
          ["Plafond", "Totale inhouding", "50 %"],
        ],
      },
      { type: "h2", texte: "De stappen" },
      {
        type: "etapes",
        items: [
          {
            titre: "Raadpleeg voor elke betaling",
            texte:
              "Op [Check inhoudingsplicht](https://www.checkinhoudingsplicht.be): het resultaat toont of u moet inhouden en voor welk luik.",
          },
          {
            titre: "Bereken de inhouding",
            texte:
              "Pas het percentage van elk luik toe op het bedrag exclusief btw van de factuur, binnen het plafond.",
          },
          {
            titre: "Bereid de storting voor",
            texte:
              "Sociaal luik: voorbereiding in de online toepassing, die een unieke gestructureerde mededeling aanmaakt. Fiscaal luik: vraag eerst een attest aan de FOD Financiën, met de te gebruiken mededeling.",
          },
          {
            titre: "Stort tegelijk met de factuur",
            texte:
              "De onderaannemer ontvangt het factuurbedrag min de inhoudingen; de RSZ en de FOD Financiën ontvangen de inhoudingen.",
          },
          {
            titre: "Bewaar de bewijzen",
            texte: "Gedateerde raadpleging, berekening, betalingsbewijzen.",
          },
        ],
      },
      { type: "h2", texte: "Beperking van de inhouding" },
      {
        type: "p",
        texte:
          "Voor een factuur van meer dan 7 143 euro exclusief btw kan de inhouding beperkt worden tot het bedrag van de schuld, op basis van een attest dat het bedrijf met schulden (sociaal) of de aannemer (fiscaal, 20 dagen geldig) aanvraagt (bron: RSZ).",
      },
      { type: "h2", texte: "Sancties" },
      {
        type: "p",
        texte:
          "Bij niet-naleving: een administratieve geldboete en hoofdelijke aansprakelijkheid voor de fiscale en sociale schulden van de medecontractant (bron: RSZ).",
      },
      {
        type: "modele",
        fichier: "/modeles/nl/fiche-inhoudingsplicht.pdf",
        libelle: "Berekeningsfiche: inhoudingsplicht",
        description: "Berekeningstabel en lijst van bewijzen om bij elke betaling te bewaren.",
      },
      { type: "h2", texte: "Met ZidarPro" },
      {
        type: "p",
        texte:
          "ZidarPro berekent de inhoudingen voor RSZ en FOD Financiën, begrensd tot de meegedeelde schuld en het bedrag van de betaling, en houdt het register van inhoudingen bij. Zie [Controle inhoudingsplicht](/nl/functies/controle-inhoudingsplicht).",
      },
      { type: "avertissement", texte: DISCLAIMER },
      { type: "sources", items: [S.rszInhouding, S.check] },
      { type: "cta" },
    ],
  },
  {
    cle: "demo",
    type: "demo",
    chemin: "demo-aanvragen",
    titre: "Een demo van ZidarPro aanvragen",
    description:
      "Vraag een demonstratie van ZidarPro aan op uw eigen dossiers: inhoudingsplicht, onderaannemingscontracten, inhoudingen en conformiteitsbewijzen.",
    h1: "Demo aanvragen",
    chapo:
      "30 minuten om ZidarPro te zien op uw eigen dossiers: onderaannemers, inhoudingsplicht, contracten en inhoudingen.",
    majLe: MAJ,
    parents: ["accueil"],
    blocs: [{ type: "demo" }],
  },
  {
    cle: "legal",
    type: "legal",
    chemin: "wettelijke-vermeldingen",
    titre: "Wettelijke vermeldingen | ZidarPro",
    description: "Wettelijke vermeldingen van de site ZidarPro: uitgever, contact en hosting.",
    h1: "Wettelijke vermeldingen",
    majLe: MAJ,
    parents: ["accueil"],
    noindex: true,
    blocs: [],
  },
];

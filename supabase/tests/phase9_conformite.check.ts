// Test de la migration « conformité » (PR D) sur PostgreSQL en mémoire (PGlite), environnement
// Supabase simulé (auth, droits par défaut, storage). Vérifie statuts calculés, documents et
// dérogations immuables, IBAN validé, blocage d'affectation, plafond total des retenues.
// Prérequis (une fois) : bun add -d @electric-sql/pglite
// Lancer : bun supabase/tests/phase9_conformite.check.ts

import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { initSupabaseSimule } from "./supabase_simule";
import { ajouterJours, statutDocument } from "../../src/lib/conformite";

const MIG = process.argv[2] ?? join(import.meta.dir, "..", "migrations");
const MIGRATION_D = "20261015090000_phase9_conformite.sql";
const db = new PGlite();
await initSupabaseSimule(db);
for (const f of readdirSync(MIG)
  .filter((f) => f.endsWith(".sql"))
  .sort()) {
  try {
    await db.exec(readFileSync(join(MIG, f), "utf8"));
  } catch (e) {
    console.log("migration ERREUR", f, (e as Error).message);
    process.exit(1);
  }
}
console.log("migrations ok");

let fails = 0;
const ok = (cond: boolean, label: string) => {
  console.log(`${cond ? "✓" : "✗"} ${label}`);
  if (!cond) fails++;
};
async function expectError(sql: string, code: string, label: string) {
  try {
    await db.exec(sql);
    ok(false, `${label} (aucune erreur)`);
  } catch (e) {
    const m = (e as Error).message;
    ok(m.includes(code), `${label} → ${m}`);
  }
}
const as = (uid: string) =>
  db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub', '${uid}', false); SET ROLE authenticated;`,
  );
const val = async <T>(sql: string) => (await db.query<{ v: T }>(sql)).rows[0]?.v;

try {
  await db.exec(readFileSync(join(MIG, MIGRATION_D), "utf8"));
  ok(true, "migration rejouée une seconde fois sans erreur (idempotente)");
} catch (e) {
  ok(false, `migration non idempotente → ${(e as Error).message}`);
}

// --- Statut d'un document (bornes) ---------------------------------------------------
const J = "public.aujourdhui_bruxelles()";
const st = (exp: string, inv = "NULL") =>
  val<string>(`SELECT public.statut_document_conformite(${exp}, ${inv}, ${J}) AS v`);
ok((await st(`${J} - 1`)) === "expire", "J−1 : expiré");
ok((await st(J)) === "expire_bientot", "J0 : expire bientôt");
ok((await st(`${J} + 30`)) === "expire_bientot", "J+30 : expire bientôt");
ok((await st(`${J} + 31`)) === "valide", "J+31 : valide");
ok((await st("NULL")) === "valide", "sans date d'expiration : valide");
ok((await st(`${J} + 100`, "now()")) === "invalide", "invalidé : invalide");

// --- Données ----------------------------------------------------------------------------
const U1 = "11111111-1111-1111-1111-111111111111"; // admin société A
const U2 = "22222222-2222-2222-2222-222222222222"; // admin société B
const U3 = "33333333-3333-3333-3333-333333333333"; // ouvrier société A
await db.exec(`
  INSERT INTO auth.users VALUES ('${U1}', 'a@a.be', '{"company_name":"Société A"}'),
                                ('${U2}', 'b@b.be', '{"company_name":"Société B"}'),
                                ('${U3}', 'o@a.be', '{"company_name":"Autre"}');`);
const C1 = await val<string>(`SELECT company_id AS v FROM public.profiles WHERE id = '${U1}'`);
await db.exec(
  `UPDATE public.profiles SET company_id = '${C1}', role = 'ouvrier' WHERE id = '${U3}'`,
);

const ST = "aaaaaaaa-0000-0000-0000-0000000000a1";
const CH = "aaaaaaaa-0000-0000-0000-000000000001";
await as(U1);
await db.exec(`
  INSERT INTO public.chantiers (id, company_id, name) VALUES ('${CH}', '${C1}', 'Chantier A');
  INSERT INTO public.sous_traitants (id, company_id, raison_sociale, iban)
  VALUES ('${ST}', '${C1}', 'ST A', 'BE68539007547034');`);

const conf = async () =>
  (
    await db.query<{
      attestation_30bis: string;
      attestation_tva: string;
      iban: string;
      contrat: string;
      bloque: boolean;
    }>(`SELECT * FROM public.conformite_sous_traitants() WHERE sous_traitant_id = '${ST}'`)
  ).rows[0];
let c = await conf();
ok(
  c.attestation_30bis === "manquant" &&
    c.attestation_tva === "manquant" &&
    c.iban === "manquant" &&
    c.contrat === "manquant" &&
    c.bloque === true,
  "sans document : tout manquant, sous-traitant bloqué",
);

// --- Blocage d'affectation ------------------------------------------------------------------
const contrat = (id: string, chantier: string) =>
  `INSERT INTO public.sous_traitant_contrats (id, company_id, sous_traitant_id, chantier_id, descriptif_prestations, montant_forfait_ht)
   VALUES ('${id}', '${C1}', '${ST}', ${chantier}, 'Travaux', 1000)`;
await expectError(
  contrat("aaaaaaaa-0000-0000-0000-0000000000c0", `'${CH}'`),
  "conformite_30bis_bloquante",
  "contrat rattaché à un chantier refusé sans attestation 30bis",
);
const CT = "aaaaaaaa-0000-0000-0000-0000000000c1";
await db.exec(contrat(CT, "NULL"));
ok(true, "contrat sans chantier accepté (pas d'affectation)");
await expectError(
  `UPDATE public.sous_traitant_contrats SET chantier_id = '${CH}' WHERE id = '${CT}'`,
  "conformite_30bis_bloquante",
  "rattachement ultérieur au chantier refusé",
);

// --- Documents ------------------------------------------------------------------------------
await expectError(
  `INSERT INTO public.documents_conformite (company_id, sous_traitant_id, type_document) VALUES ('${C1}', '${ST}', 'attestation_30bis')`,
  "documents_conformite_expiration_chk",
  "attestation 30bis sans date d'expiration refusée",
);
await expectError(
  `INSERT INTO public.documents_conformite (company_id, sous_traitant_id, type_document, date_expiration, fichier)
   VALUES ('${C1}', '${ST}', 'attestation_30bis', ${J} + 10, 'autre/conformite/x.pdf')`,
  "documents_conformite_fichier_chk",
  "fichier hors du dossier conformité de la société refusé",
);
const D1 = "aaaaaaaa-0000-0000-0000-0000000000d1";
const F1 = `${C1}/conformite/0f8fad5b-d9cb-469f-a165-70867728950e.pdf`;
await db.exec(`
  INSERT INTO public.documents_conformite (id, company_id, sous_traitant_id, type_document, date_emission, date_expiration, fichier)
  VALUES ('${D1}', '${C1}', '${ST}', 'attestation_30bis', ${J} - 10, ${J} + 20, '${F1}');
  INSERT INTO public.documents_conformite (company_id, sous_traitant_id, type_document)
  VALUES ('${C1}', '${ST}', 'attestation_tva');`);
c = await conf();
ok(
  c.attestation_30bis === "expire_bientot" && c.attestation_tva === "valide" && c.bloque === false,
  "attestation 30bis à 20 jours : expire bientôt, plus bloqué ; TVA sans date : valide",
);
await db.exec(`UPDATE public.sous_traitant_contrats SET chantier_id = '${CH}' WHERE id = '${CT}'`);
ok(true, "rattachement au chantier accepté avec attestation valide");
await db.exec(`
  INSERT INTO public.sous_traitant_prestations (company_id, contrat_id, chantier_id, date_prestation, heures)
  VALUES ('${C1}', '${CT}', '${CH}', ${J}, 8);`);
ok(true, "prestation sur chantier acceptée");

await expectError(
  `UPDATE public.documents_conformite SET date_expiration = ${J} + 300 WHERE id = '${D1}'`,
  "permission denied",
  "modification des dates d'un document refusée",
);
await expectError(
  `DELETE FROM public.documents_conformite WHERE id = '${D1}'`,
  "permission denied",
  "suppression d'un document refusée",
);
await as(U3);
await expectError(
  `UPDATE public.documents_conformite SET invalide_le = now(), motif_invalidation = 'faux' WHERE id = '${D1}'`,
  "action_reservee_gestionnaire",
  "invalidation refusée à un ouvrier",
);
await as(U1);
await expectError(
  `UPDATE public.documents_conformite SET invalide_le = now() WHERE id = '${D1}'`,
  "motif_invalidation_requis",
  "invalidation sans motif refusée",
);
await db.exec(
  `UPDATE public.documents_conformite SET invalide_le = now(), motif_invalidation = 'Attestation falsifiée' WHERE id = '${D1}'`,
);
c = await conf();
ok(c.attestation_30bis === "invalide" && c.bloque === true, "attestation invalidée : bloqué");
await expectError(
  `UPDATE public.documents_conformite SET motif_invalidation = 'x' WHERE id = '${D1}'`,
  "document_fige",
  "document invalidé figé",
);
// Contrat déjà rattaché : modification sans changer de chantier permise malgré le blocage.
await db.exec(
  `UPDATE public.sous_traitant_contrats SET bon_commande_ref = 'BC-9' WHERE id = '${CT}'`,
);
ok(true, "modification d'un contrat sans changer de chantier permise malgré le blocage");
await expectError(
  `INSERT INTO public.sous_traitant_prestations (company_id, contrat_id, chantier_id, date_prestation, heures)
   VALUES ('${C1}', '${CT}', '${CH}', ${J}, 8)`,
  "conformite_30bis_bloquante",
  "nouvelle prestation sur chantier refusée (attestation invalide)",
);

// Attestation expirée → bloqué
await db.exec(`
  INSERT INTO public.documents_conformite (company_id, sous_traitant_id, type_document, date_expiration)
  VALUES ('${C1}', '${ST}', 'attestation_30bis', ${J} - 1);`);
ok((await conf()).attestation_30bis === "expire", "attestation expirée : statut expiré");

// --- Dérogations ----------------------------------------------------------------------------
await as(U3);
await expectError(
  `INSERT INTO public.derogations_conformite (company_id, sous_traitant_id, motif, expire_le)
   VALUES ('${C1}', '${ST}', 'urgence', now() + interval '5 days')`,
  "action_reservee_gestionnaire",
  "dérogation refusée à un ouvrier",
);
await as(U1);
await expectError(
  `INSERT INTO public.derogations_conformite (company_id, sous_traitant_id, motif, expire_le)
   VALUES ('${C1}', '${ST}', 'urgence', now() + interval '31 days')`,
  "derogation_duree_invalide",
  "dérogation de plus de 30 jours refusée",
);
await expectError(
  `INSERT INTO public.derogations_conformite (company_id, sous_traitant_id, motif, expire_le)
   VALUES ('${C1}', '${ST}', ' ', now() + interval '5 days')`,
  "derogations_conformite_motif_check",
  "dérogation sans justification refusée",
);
const DG = "aaaaaaaa-0000-0000-0000-0000000000e1";
await db.exec(`
  INSERT INTO public.derogations_conformite (id, company_id, sous_traitant_id, motif, expire_le, accordee_par)
  VALUES ('${DG}', '${C1}', '${ST}', 'Attestation demandée, chantier urgent', now() + interval '10 days', '${U3}');`);
ok(
  (await val<string>(
    `SELECT accordee_par::text AS v FROM public.derogations_conformite WHERE id = '${DG}'`,
  )) === U1,
  "dérogation : auteur imposé (utilisateur connecté)",
);
ok((await conf()).bloque === false, "dérogation active : plus bloqué");
await db.exec(`
  INSERT INTO public.sous_traitant_prestations (company_id, contrat_id, chantier_id, date_prestation, heures)
  VALUES ('${C1}', '${CT}', '${CH}', ${J}, 4);`);
ok(true, "prestation acceptée sous dérogation");
await expectError(
  `UPDATE public.derogations_conformite SET motif = 'autre' WHERE id = '${DG}'`,
  "permission denied",
  "modification du motif d'une dérogation refusée",
);
await db.exec(`UPDATE public.derogations_conformite SET revoquee_le = now() WHERE id = '${DG}'`);
ok((await conf()).bloque === true, "dérogation révoquée : de nouveau bloqué");
await expectError(
  `UPDATE public.derogations_conformite SET revoquee_le = now() WHERE id = '${DG}'`,
  "derogation_figee",
  "dérogation révoquée figée",
);
await expectError(
  `DELETE FROM public.derogations_conformite WHERE id = '${DG}'`,
  "permission denied",
  "suppression d'une dérogation refusée",
);

// --- IBAN -----------------------------------------------------------------------------------
await as(U3);
await expectError(
  `UPDATE public.sous_traitants SET iban_valide_le = now() WHERE id = '${ST}'`,
  "action_reservee_gestionnaire",
  "validation d'IBAN refusée à un ouvrier",
);
await as(U1);
await db.exec(`UPDATE public.sous_traitants SET iban_valide_le = now() WHERE id = '${ST}'`);
ok((await conf()).iban === "valide", "IBAN validé par un gestionnaire");
ok(
  (await val<string>(
    `SELECT iban_valide_par::text AS v FROM public.sous_traitants WHERE id = '${ST}'`,
  )) === U1,
  "IBAN : auteur de la validation enregistré",
);
await db.exec(`UPDATE public.sous_traitants SET iban = 'BE71096123456769' WHERE id = '${ST}'`);
ok((await conf()).iban === "manquant", "IBAN modifié : validation annulée");
await db.exec(`UPDATE public.sous_traitants SET iban = NULL WHERE id = '${ST}'`);
await expectError(
  `UPDATE public.sous_traitants SET iban_valide_le = now() WHERE id = '${ST}'`,
  "iban_absent",
  "validation impossible sans IBAN",
);

// --- Contrat envoyé en signature ------------------------------------------------------------
await db.exec(`
  INSERT INTO public.contrat_signatures (company_id, contrat_id, donnees, document_hash,
    entreprise_signataire_nom, entreprise_signataire_qualite, entreprise_signature)
  VALUES ('${C1}', '${CT}', '{}', '${"a".repeat(64)}', 'J', 'G', 'data:image/png;base64,AA');`);
ok((await conf()).contrat === "valide", "contrat envoyé en signature (lien actif) : valide");

// --- Storage : fichier cité non supprimable -------------------------------------------------
await db.exec(`
  INSERT INTO storage.objects (bucket_id, name) VALUES ('documents', '${F1}'),
    ('documents', '${C1}/conformite/7c9e6679-7425-40de-944b-e07fc1f90ae7.pdf');
  DELETE FROM storage.objects WHERE name = '${F1}';
  DELETE FROM storage.objects WHERE name = '${C1}/conformite/7c9e6679-7425-40de-944b-e07fc1f90ae7.pdf';`);
ok(
  (await val<number>(`SELECT count(*)::int AS v FROM storage.objects WHERE name = '${F1}'`)) === 1,
  "fichier d'un document de conformité non supprimable",
);
ok(
  (await val<number>(
    `SELECT count(*)::int AS v FROM storage.objects WHERE name LIKE '%7c9e6679%'`,
  )) === 0,
  "fichier de conformité orphelin supprimable",
);

// --- Isolation ------------------------------------------------------------------------------
await as(U2);
ok(
  (await val<number>(
    `SELECT (SELECT count(*) FROM public.documents_conformite) + (SELECT count(*) FROM public.derogations_conformite)
            + (SELECT count(*) FROM public.conformite_sous_traitants()) AS v`,
  )) === 0,
  "la société B ne voit rien de la société A",
);

// --- Plafond total des retenues (SPF réduit d'abord) ---------------------------------------
await db.exec(`
  RESET ROLE;
  INSERT INTO public.parametres_30bis (date_debut, taux_retenue_onss, taux_retenue_spf, source)
  VALUES (${J}, 0.8, 0.5, 'test plafond total');`);
await as(U1);
const V = "aaaaaaaa-0000-0000-0000-0000000000f1";
await db.exec(`
  INSERT INTO public.verifications_30bis (id, company_id, sous_traitant_id, dette_sociale, dette_fiscale)
  VALUES ('${V}', '${C1}', '${ST}', true, true);`);
const paie = (onss: number, spf: number) =>
  `INSERT INTO public.achat_paiements (company_id, contrat_id, date_paiement, montant_ht, retenue_onss, retenue_spf, verification_30bis_id)
   VALUES ('${C1}', '${CT}', ${J}, 1000, ${onss}, ${spf}, '${V}')`;
await expectError(
  paie(800, 500),
  "retenue_30bis_incorrecte",
  "ONSS 80 % + SPF 50 % (130 %) refusé",
);
await db.exec(paie(800, 200));
ok(true, "total plafonné au HTVA : SPF réduit d'abord (800 + 200 = 1 000)");

// --- Parité du statut : src/lib/conformite.ts ↔ public.statut_document_conformite ----------
await db.exec("RESET ROLE");
const jour = await val<string>(`SELECT ${J}::text AS v`);
let ecarts = 0;
for (let d = -40; d <= 40; d++) {
  for (const inv of [null, "2026-01-01T00:00:00Z"]) {
    const exp = ajouterJours(jour, d);
    const sql = await val<string>(
      `SELECT public.statut_document_conformite('${exp}'::date, ${inv ? `'${inv}'::timestamptz` : "NULL"}, '${jour}'::date) AS v`,
    );
    if (sql !== statutDocument(exp, inv, jour)) ecarts++;
  }
}
ok(
  ecarts === 0 && statutDocument(null, null, jour) === "valide",
  "statut d'un document identique en base et dans l'application (162 cas)",
);

console.log(fails ? `\n✖ ${fails} échec(s)` : "\n✓ tous les tests passent");
process.exit(fails ? 1 : 0);

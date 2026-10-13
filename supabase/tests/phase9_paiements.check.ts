// Test de la migration « paiements plafonnés » (PR B) sur PostgreSQL en mémoire (PGlite).
// Rejoue toutes les migrations (schéma auth simulé, droits par défaut de Supabase), puis vérifie
// plafond des retenues, annulation, suppression le jour même, contrats signés, validations.
// Prérequis (une fois) : bun add -d @electric-sql/pglite
// Lancer : bun supabase/tests/phase9_paiements.check.ts

import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIG = process.argv[2] ?? join(import.meta.dir, "..", "migrations");
const db = new PGlite();

await db.exec(`
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO authenticated, anon;
  GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;
  GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
`);
const fichiers = readdirSync(MIG)
  .filter((f) => f.endsWith(".sql"))
  .sort();
for (const f of fichiers) {
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

// Migration rejouable (idempotente)
try {
  await db.exec(readFileSync(join(MIG, "20261014090000_phase9_paiements_plafond.sql"), "utf8"));
  ok(true, "migration rejouée une seconde fois sans erreur (idempotente)");
} catch (e) {
  ok(false, `migration non idempotente → ${(e as Error).message}`);
}

const U1 = "11111111-1111-1111-1111-111111111111";
const U3 = "33333333-3333-3333-3333-333333333333";
await db.exec(`
  INSERT INTO auth.users VALUES ('${U1}', 'a@a.be', '{"company_name":"Société A"}');`);
const C1 = await val<string>(`SELECT company_id AS v FROM public.profiles WHERE id = '${U1}'`);
// Un ouvrier de la même société
await db.exec(`
  INSERT INTO auth.users VALUES ('${U3}', 'o@a.be', '{"company_name":"Autre"}');
  UPDATE public.profiles SET company_id = '${C1}', role = 'ouvrier' WHERE id = '${U3}';`);

const ST = "aaaaaaaa-0000-0000-0000-0000000000a1";
const CT = "aaaaaaaa-0000-0000-0000-0000000000c1";
const today = "(now() AT TIME ZONE 'Europe/Brussels')::date";
await as(U1);
await db.exec(`
  INSERT INTO public.sous_traitants (id, company_id, raison_sociale) VALUES ('${ST}', '${C1}', 'ST A');
  INSERT INTO public.sous_traitant_contrats (id, company_id, sous_traitant_id, descriptif_prestations, montant_forfait_ht)
  VALUES ('${CT}', '${C1}', '${ST}', 'Gros œuvre', 50000);`);

// --- Montants de dette -------------------------------------------------------------
await expectError(
  `INSERT INTO public.verifications_30bis (company_id, sous_traitant_id, dette_sociale, dette_fiscale, montant_dette_onss)
   VALUES ('${C1}', '${ST}', false, false, 100)`,
  "verifications_30bis_montants_chk",
  "montant de dette refusé sans dette constatée",
);
const V1 = "aaaaaaaa-0000-0000-0000-0000000000f1";
await db.exec(`
  INSERT INTO public.verifications_30bis (id, company_id, sous_traitant_id, dette_sociale, dette_fiscale, montant_dette_onss, montant_dette_spf)
  VALUES ('${V1}', '${C1}', '${ST}', true, true, 3000, 10000);`);

const paie = (ht: number, onss: number, spf: number, v = V1) =>
  `INSERT INTO public.achat_paiements (company_id, contrat_id, date_paiement, montant_ht, retenue_onss, retenue_spf, verification_30bis_id)
   VALUES ('${C1}', '${CT}', ${today}, ${ht}, ${onss}, ${spf}, '${v}') RETURNING id`;

// 14 000 € HTVA : ONSS 35 % = 4 900 plafonné à 3 000 ; SPF 15 % = 2 100 (dette 10 000).
await expectError(
  paie(14000, 4900, 2100),
  "retenue_30bis_incorrecte",
  "retenue ONSS pleine refusée quand la dette ONSS est inférieure",
);
const P1 = (await db.query<{ id: string }>(paie(14000, 3000, 2100))).rows[0].id;
ok(!!P1, "retenue ONSS plafonnée à la dette (3 000 €) acceptée");

// Second paiement du jour sur la même vérification : ONSS restante = 0, SPF restante = 7 900.
await expectError(
  paie(60000, 0, 9000),
  "retenue_30bis_incorrecte",
  "SPF au-delà de la dette restante refusée",
);
const P2 = (await db.query<{ id: string }>(paie(60000, 0, 7900))).rows[0].id;
ok(!!P2, "second paiement : ONSS épuisée (0), SPF plafonnée à la dette restante (7 900 €)");

// Dette non saisie : pas de plafond (lignes antérieures à la PR B)
const V2 = "aaaaaaaa-0000-0000-0000-0000000000f2";
await db.exec(`
  INSERT INTO public.verifications_30bis (id, company_id, sous_traitant_id, dette_sociale, dette_fiscale)
  VALUES ('${V2}', '${C1}', '${ST}', true, false);`);
ok(
  !!(await db.query(paie(1000, 350, 0, V2))).rows.length,
  "dette non saisie : retenue pleine (35 %)",
);

// --- Annulation, suppression, modification ------------------------------------------
await expectError(
  `UPDATE public.achat_paiements SET annule_le = now() WHERE id = '${P2}'`,
  "motif_annulation_requis",
  "annulation sans motif refusée",
);
await expectError(
  `UPDATE public.achat_paiements SET annule_le = now(), motif_annulation = 'x', montant_ht = 1 WHERE id = '${P2}'`,
  "annulation_seulement",
  "annulation qui modifie aussi le montant refusée",
);
await db.exec(
  `UPDATE public.achat_paiements SET annule_le = now(), motif_annulation = 'Erreur de contrat' WHERE id = '${P2}'`,
);
ok(
  (await val<string>(
    `SELECT annule_par::text AS v FROM public.achat_paiements WHERE id = '${P2}'`,
  )) === U1,
  "annulation : auteur enregistré",
);
await expectError(
  `UPDATE public.achat_paiements SET motif_annulation = 'autre' WHERE id = '${P2}'`,
  "paiement_annule_fige",
  "paiement annulé figé",
);
// Le paiement annulé libère son plafond SPF : 7 900 € à nouveau disponibles.
ok(
  !!(await db.query(paie(60000, 0, 7900))).rows.length,
  "après annulation, la dette SPF restante est de nouveau disponible",
);
await expectError(
  `INSERT INTO public.achat_paiements (company_id, contrat_id, date_paiement, montant_ht, retenue_onss, retenue_spf, verification_30bis_id, annule_le, motif_annulation)
   VALUES ('${C1}', '${CT}', ${today}, 10, 5, 0, '${V1}', now(), 'x')`,
  "retenue_30bis_incorrecte",
  "insertion « déjà annulée » : contrôle 30bis appliqué quand même",
);
const P4 = (
  await db.query<{ id: string }>(
    `INSERT INTO public.achat_paiements (company_id, contrat_id, date_paiement, montant_ht, retenue_onss, retenue_spf, verification_30bis_id, annule_le, motif_annulation)
     VALUES ('${C1}', '${CT}', ${today}, 10, 0, 0, '${V1}', now(), 'x') RETURNING id`,
  )
).rows[0].id;
ok(
  (await val<boolean>(
    `SELECT annule_le IS NULL AS v FROM public.achat_paiements WHERE id = '${P4}'`,
  )) === true,
  "insertion : annulation pré-remplie ignorée",
);

// Paiement d'un jour passé : ni suppression ni modification, annulation possible
await db.exec(
  `RESET ROLE; UPDATE public.achat_paiements SET created_at = now() - interval '2 days' WHERE id = '${P1}'`,
);
await as(U1);
await expectError(
  `DELETE FROM public.achat_paiements WHERE id = '${P1}'`,
  "suppression_paiement_jour_meme",
  "suppression d'un paiement d'un jour passé refusée",
);
await expectError(
  `UPDATE public.achat_paiements SET reference = 'x' WHERE id = '${P1}'`,
  "modification_paiement_interdite",
  "modification d'un paiement d'un jour passé refusée",
);
// Dette SPF désormais épuisée (2 100 + 7 900 = 10 000) : retenue 0.
const P3 = (await db.query<{ id: string }>(paie(100, 0, 0))).rows[0].id;
await db.exec(`DELETE FROM public.achat_paiements WHERE id = '${P3}'`);
ok(
  (await val<number>(
    `SELECT count(*)::int AS v FROM public.achat_paiements WHERE id = '${P3}'`,
  )) === 0,
  "suppression le jour même autorisée",
);

// --- Contrat signé non modifiable ----------------------------------------------------
await db.exec(
  `UPDATE public.sous_traitant_contrats SET bon_commande_ref = 'BC-1' WHERE id = '${CT}'`,
);
ok(true, "contrat non signé modifiable");
await db.exec(`
  RESET ROLE;
  INSERT INTO public.contrat_signatures (company_id, contrat_id, donnees, document_hash,
    entreprise_signataire_nom, entreprise_signataire_qualite, entreprise_signature)
  VALUES ('${C1}', '${CT}', '{}', '${"a".repeat(64)}', 'J', 'G', 'data:image/png;base64,AA');
  UPDATE public.contrat_signatures SET statut = 'signe', signataire_nom = 'P', signature = 'data:image/png;base64,AA',
    signe_le = now(), signe_hash = '${"b".repeat(64)}';`);
await as(U1);
await expectError(
  `UPDATE public.sous_traitant_contrats SET bon_commande_ref = 'BC-2' WHERE id = '${CT}'`,
  "contrat_signe_non_modifiable",
  "contrat signé non modifiable",
);

// --- Validation des prestations -------------------------------------------------------
const PR = "aaaaaaaa-0000-0000-0000-0000000000b1";
await db.exec(`
  INSERT INTO public.sous_traitant_prestations (id, company_id, contrat_id, date_prestation, heures)
  VALUES ('${PR}', '${C1}', '${CT}', ${today}, 8);`);
await as(U3);
await expectError(
  `UPDATE public.sous_traitant_prestations SET valide_par = '${U3}', valide_le = now() WHERE id = '${PR}'`,
  "validation_reservee_gestionnaire",
  "validation d'une prestation refusée à un ouvrier",
);
await as(U1);
await db.exec(
  `UPDATE public.sous_traitant_prestations SET valide_par = '${U3}', valide_le = now() - interval '9 days' WHERE id = '${PR}'`,
);
const pr = (
  await db.query<{ par: string; recent: boolean }>(
    `SELECT valide_par::text AS par, valide_le > now() - interval '1 minute' AS recent FROM public.sous_traitant_prestations WHERE id = '${PR}'`,
  )
).rows[0];
ok(pr.par === U1 && pr.recent, "validation par un gérant : auteur et date imposés");

console.log(fails ? `\n✖ ${fails} échec(s)` : "\n✓ tous les tests passent");
process.exit(fails ? 1 : 0);

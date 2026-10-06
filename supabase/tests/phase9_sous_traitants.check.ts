// Test de la migration phase 9 sur PostgreSQL en mémoire (PGlite), sans Supabase ni réseau.
// Rejoue TOUTES les migrations dans l'ordre (schéma auth simulé), puis vérifie 30bis + RLS.
// Prérequis (une fois) : bun add -d @electric-sql/pglite
// Lancer : bun supabase/tests/phase9_sous_traitants.check.ts

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
`);

for (const f of readdirSync(MIG)
  .filter((f) => f.endsWith(".sql"))
  .sort()) {
  try {
    await db.exec(readFileSync(join(MIG, f), "utf8"));
    console.log("migration ok   ", f);
  } catch (e) {
    console.log("migration ERREUR", f, (e as Error).message);
    process.exit(1);
  }
}

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
const as = async (uid: string) =>
  db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub', '${uid}', false); SET ROLE authenticated;`,
  );

// Deux sociétés via le trigger d'inscription
const U1 = "11111111-1111-1111-1111-111111111111";
const U2 = "22222222-2222-2222-2222-222222222222";
await db.exec(`
  INSERT INTO auth.users VALUES ('${U1}', 'a@a.be', '{"company_name":"Société A"}'),
                                ('${U2}', 'b@b.be', '{"company_name":"Société B"}');`);
const comp = async (uid: string) =>
  (
    await db.query<{ company_id: string }>(
      `SELECT company_id FROM public.profiles WHERE id = '${uid}'`,
    )
  ).rows[0].company_id;
const C1 = await comp(U1);
const C2 = await comp(U2);

// --- Société A ---------------------------------------------------------------
await as(U1);
await db.exec(
  `INSERT INTO public.chantiers (id, company_id, name) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', '${C1}', 'Chantier A');`,
);
await db.exec(`
  INSERT INTO public.sous_traitants (id, company_id, raison_sociale, forme_juridique, numero_bce)
  VALUES ('aaaaaaaa-0000-0000-0000-0000000000a1', '${C1}', 'Plafonnage Martin SRL', 'srl', '0123.456.789'),
         ('aaaaaaaa-0000-0000-0000-0000000000a2', '${C1}', 'Toitures Dubois', 'independant', NULL);`);
await expectError(
  `INSERT INTO public.sous_traitants (company_id, raison_sociale, forme_juridique) VALUES ('${C1}', 'X', 'sprl')`,
  "check constraint",
  "forme juridique « sprl » refusée",
);
await expectError(
  `INSERT INTO public.sous_traitants (company_id, raison_sociale, numero_bce) VALUES ('${C1}', 'Doublon', '0123.456.789')`,
  "duplicate key",
  "numéro BCE en double refusé",
);
await db.exec(`
  INSERT INTO public.sous_traitant_contrats (id, company_id, sous_traitant_id, chantier_id, descriptif_prestations, type_prix, montant_forfait_ht)
  VALUES ('aaaaaaaa-0000-0000-0000-0000000000c1', '${C1}', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000001', 'Plafonnage RDC', 'forfait', 10000);`);
await expectError(
  `INSERT INTO public.sous_traitant_contrats (company_id, sous_traitant_id, descriptif_prestations, type_prix) VALUES ('${C1}', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'Horaire sans prix', 'horaire')`,
  "sous_traitant_contrats_prix_chk",
  "contrat horaire sans prix refusé",
);
await db.exec(`
  INSERT INTO public.sous_traitant_prestations (company_id, contrat_id, chantier_id, date_prestation, heures, ouvriers)
  VALUES ('${C1}', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000001', '2026-10-05', 16, '[{"nom":"J. Martin","fonction":"plafonneur","heures":8}]');`);

const today = "(now() AT TIME ZONE 'Europe/Brussels')::date";
// Paiement sans vérification
await expectError(
  `INSERT INTO public.achat_paiements (company_id, contrat_id, date_paiement, montant_ht) VALUES ('${C1}', 'aaaaaaaa-0000-0000-0000-0000000000c1', ${today}, 5000)`,
  "verification_30bis_requise",
  "paiement sans vérification 30bis refusé",
);
// Vérification avec dette sociale + fiscale
await db.exec(`
  INSERT INTO public.verifications_30bis (id, company_id, sous_traitant_id, dette_sociale, dette_fiscale)
  VALUES ('aaaaaaaa-0000-0000-0000-0000000000f1', '${C1}', 'aaaaaaaa-0000-0000-0000-0000000000a1', true, true);`);
await expectError(
  `INSERT INTO public.achat_paiements (company_id, contrat_id, date_paiement, montant_ht, verification_30bis_id) VALUES ('${C1}', 'aaaaaaaa-0000-0000-0000-0000000000c1', ${today}, 5000, 'aaaaaaaa-0000-0000-0000-0000000000f1')`,
  "retenue_30bis_incorrecte",
  "paiement complet malgré une dette refusé",
);
await db.exec(`
  INSERT INTO public.achat_paiements (company_id, contrat_id, date_paiement, montant_ht, retenue_onss, retenue_spf, verification_30bis_id)
  VALUES ('${C1}', 'aaaaaaaa-0000-0000-0000-0000000000c1', ${today}, 5000, 1750, 750, 'aaaaaaaa-0000-0000-0000-0000000000f1');`);
const verse = await db.query<{ montant_verse: string }>(
  `SELECT montant_verse FROM public.achat_paiements`,
);
ok(
  Number(verse.rows[0].montant_verse) === 2500,
  `paiement avec retenues 35 % + 15 % accepté, versé = ${verse.rows[0].montant_verse}`,
);
await expectError(
  `INSERT INTO public.achat_paiements (company_id, contrat_id, date_paiement, montant_ht, retenue_onss, retenue_spf, verification_30bis_id) VALUES ('${C1}', 'aaaaaaaa-0000-0000-0000-0000000000c1', ${today} + 1, 5000, 1750, 750, 'aaaaaaaa-0000-0000-0000-0000000000f1')`,
  "verification_30bis_pas_du_jour",
  "vérification d'un autre jour refusée",
);
// Vérification d'un autre sous-traitant
await db.exec(`
  INSERT INTO public.verifications_30bis (id, company_id, sous_traitant_id, dette_sociale, dette_fiscale)
  VALUES ('aaaaaaaa-0000-0000-0000-0000000000f2', '${C1}', 'aaaaaaaa-0000-0000-0000-0000000000a2', false, false);`);
await expectError(
  `INSERT INTO public.achat_paiements (company_id, contrat_id, date_paiement, montant_ht, verification_30bis_id) VALUES ('${C1}', 'aaaaaaaa-0000-0000-0000-0000000000c1', ${today}, 100, 'aaaaaaaa-0000-0000-0000-0000000000f2')`,
  "verification_30bis_autre_sous_traitant",
  "vérification d'un autre sous-traitant refusée",
);
// Preuve immuable
await db.exec(`UPDATE public.verifications_30bis SET dette_sociale = false`).then(
  () => ok(false, "modification d'une vérification 30bis refusée (aucune erreur)"),
  (e) =>
    ok(
      /permission denied/.test((e as Error).message),
      "modification d'une vérification 30bis refusée",
    ),
);

// --- Société B : isolation ------------------------------------------------------
await as(U2);
const seen = await db.query<{ n: number }>(`
  SELECT (SELECT count(*) FROM public.sous_traitants)
       + (SELECT count(*) FROM public.sous_traitant_contrats)
       + (SELECT count(*) FROM public.sous_traitant_prestations)
       + (SELECT count(*) FROM public.verifications_30bis)
       + (SELECT count(*) FROM public.achat_paiements) AS n`);
ok(Number(seen.rows[0].n) === 0, "la société B ne voit aucune donnée de la société A");
await expectError(
  `INSERT INTO public.sous_traitants (company_id, raison_sociale) VALUES ('${C1}', 'Intrus')`,
  "row-level security",
  "la société B ne peut pas écrire dans la société A",
);
await db.exec(
  `INSERT INTO public.sous_traitants (id, company_id, raison_sociale) VALUES ('bbbbbbbb-0000-0000-0000-0000000000b1', '${C2}', 'ST de B')`,
);
await expectError(
  `INSERT INTO public.sous_traitant_contrats (company_id, sous_traitant_id, chantier_id, descriptif_prestations, montant_forfait_ht) VALUES ('${C2}', 'bbbbbbbb-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-000000000001', 'Vol de chantier', 1)`,
  "foreign key",
  "contrat de B rattaché au chantier de A refusé (FK composite)",
);
const params = await db.query(`SELECT * FROM public.parametres_30bis`);
ok(params.rows.length === 1, "paramètres 30bis lisibles par un utilisateur connecté");

console.log(fails ? `\n✖ ${fails} échec(s)` : "\n✓ tous les tests passent");
process.exit(fails ? 1 : 0);

// Test de la migration « champs protégés du profil » sur PGlite (environnement Supabase simulé).
// Démontre la faille AVANT la migration (changement de société par le profil), puis vérifie
// qu'elle est fermée APRÈS, sans gêner la création de compte ni la modification du nom / langue.
// Données fictives uniquement.
// Prérequis (une fois) : bun add -d @electric-sql/pglite
// Lancer : bun supabase/tests/profils_champs_proteges.check.ts

import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { initSupabaseSimule } from "./supabase_simule";

const MIG = process.argv[2] ?? join(import.meta.dir, "..", "migrations");
const MIGRATION = "20261016090000_profils_champs_proteges.sql";

let fails = 0;
const ok = (cond: boolean, label: string) => {
  console.log(`${cond ? "✓" : "✗"} ${label}`);
  if (!cond) fails++;
};

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const C = "00000000-0000-0000-0000-00000000000c";

/** Base neuve : migrations jusqu'à (exclue) ou y compris la migration testée. */
async function base(avecMigration: boolean) {
  const db = new PGlite();
  await initSupabaseSimule(db);
  for (const f of readdirSync(MIG)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .filter((f) => avecMigration || f < MIGRATION))
    await db.exec(readFileSync(join(MIG, f), "utf8"));
  await db.exec(`INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
    ('${A}', 'a@example.invalid', '{"company_name": "Société A"}'),
    ('${B}', 'b@example.invalid', '{"company_name": "Société B"}')`);
  const societeB = (
    await db.query<{ company_id: string }>(
      `SELECT company_id FROM public.profiles WHERE id = '${B}'`,
    )
  ).rows[0].company_id;
  await db.exec(
    `INSERT INTO public.chantiers (company_id, name) VALUES ('${societeB}', 'Chantier de B')`,
  );
  return { db, societeB };
}
const commeUtilisateur = (db: PGlite, uid: string) =>
  db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uid}', false);`);
const tenter = async (db: PGlite, sql: string) => {
  try {
    await db.exec(sql);
    return "accepté";
  } catch (e) {
    return (e as Error).message;
  }
};
const chantiersVus = async (db: PGlite) =>
  (await db.query<{ name: string }>(`SELECT name FROM public.chantiers`)).rows.map((r) => r.name);

// ---- Avant la migration : la faille existe -------------------------------------------------
{
  const { db, societeB } = await base(false);
  await commeUtilisateur(db, A);
  const r = await tenter(
    db,
    `UPDATE public.profiles SET company_id = '${societeB}' WHERE id = '${A}'`,
  );
  ok(
    r === "accepté" && (await chantiersVus(db)).includes("Chantier de B"),
    "AVANT : A change de société par son profil et lit les chantiers de B (faille démontrée)",
  );
}

// ---- Après la migration --------------------------------------------------------------------
{
  const { db, societeB } = await base(true);
  await db.exec(readFileSync(join(MIG, MIGRATION), "utf8"));
  ok(true, "migration rejouée une seconde fois sans erreur (idempotente)");

  await commeUtilisateur(db, A);
  ok((await chantiersVus(db)).length === 0, "A ne voit aucun chantier de B");
  const r1 = await tenter(
    db,
    `UPDATE public.profiles SET company_id = '${societeB}' WHERE id = '${A}'`,
  );
  ok(r1.includes("profil_champ_protege"), `changer de société refusé → ${r1}`);
  ok((await chantiersVus(db)).length === 0, "A ne voit toujours aucun chantier de B");
  const r2 = await tenter(db, `UPDATE public.profiles SET role = 'gerant' WHERE id = '${A}'`);
  ok(r2.includes("profil_champ_protege"), `changer de rôle refusé → ${r2}`);
  const r3 = await tenter(
    db,
    `UPDATE public.profiles SET full_name = 'Nouveau nom', avatar_url = NULL, langue = 'nl' WHERE id = '${A}'`,
  );
  const lu = (
    await db.query<{ full_name: string; langue: string; role: string }>(
      `SELECT full_name, langue, role FROM public.profiles WHERE id = '${A}'`,
    )
  ).rows[0];
  ok(
    r3 === "accepté" && lu.full_name === "Nouveau nom" && lu.langue === "nl" && lu.role === "admin",
    "nom, avatar et langue toujours modifiables",
  );
  const r4 = await tenter(
    db,
    `INSERT INTO public.profiles (id, company_id, full_name, role) VALUES ('${A}', '${societeB}', 'x', 'admin')`,
  );
  ok(r4 !== "accepté", `insertion directe d'un profil refusée → ${r4}`);

  // Création de compte (handle_new_user, security definer) : inchangée.
  await db.exec(`RESET ROLE`);
  await db.exec(
    `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ('${C}', 'c@example.invalid', '{"company_name": "Société C"}')`,
  );
  const c = (
    await db.query<{ role: string; societe: string }>(
      `SELECT p.role, s.name AS societe FROM public.profiles p JOIN public.companies s ON s.id = p.company_id WHERE p.id = '${C}'`,
    )
  ).rows[0];
  ok(
    c?.role === "admin" && c.societe === "Société C",
    "création de compte : société et profil créés",
  );

  const anon = (
    await db.query<{ f: string }>(`
      SELECT p.proname AS f FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prokind = 'f' AND has_function_privilege('anon', p.oid, 'EXECUTE')
      ORDER BY 1`)
  ).rows.map((r) => r.f);
  ok(
    anon.join(",") === "contrat_a_signer,signer_contrat",
    `anon n'exécute toujours que la signature publique (${anon.join(", ")})`,
  );
}

console.log(fails ? `\n✖ ${fails} échec(s)` : "\n✓ tous les tests passent");
process.exit(fails ? 1 : 0);

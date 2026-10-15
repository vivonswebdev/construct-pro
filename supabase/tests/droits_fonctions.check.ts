// Test de la migration « droits des fonctions » sur PGlite (environnement Supabase simulé,
// droits par défaut sur les fonctions compris) : anon n'exécute aucune fonction de public sauf
// la signature publique ; authenticated garde l'accès (RLS, RPC).
// Prérequis (une fois) : bun add -d @electric-sql/pglite
// Lancer : bun supabase/tests/droits_fonctions.check.ts

import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { initSupabaseSimule } from "./supabase_simule";

const MIG = process.argv[2] ?? join(import.meta.dir, "..", "migrations");
const MIGRATION = "20261015140000_droits_fonctions_anon.sql";
const db = new PGlite();
await initSupabaseSimule(db);

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
const anonPeutExecuter = async () =>
  (
    await db.query<{ f: string }>(`
      SELECT p.proname AS f FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prokind = 'f'
        AND has_function_privilege('anon', p.oid, 'EXECUTE')
      ORDER BY 1`)
  ).rows.map((r) => r.f);

const fichiers = readdirSync(MIG)
  .filter((f) => f.endsWith(".sql"))
  .sort();
for (const f of fichiers.filter((f) => f < MIGRATION))
  await db.exec(readFileSync(join(MIG, f), "utf8"));
const avant = await anonPeutExecuter();
ok(
  avant.includes("conformite_sous_traitants") && avant.includes("est_gestionnaire"),
  `avant : anon exécute ${avant.length} fonctions (dont conformite_sous_traitants, est_gestionnaire)`,
);

for (const f of fichiers.filter((f) => f >= MIGRATION))
  await db.exec(readFileSync(join(MIG, f), "utf8"));
await db.exec(readFileSync(join(MIG, MIGRATION), "utf8"));
ok(true, "migration rejouée une seconde fois sans erreur (idempotente)");
const apres = await anonPeutExecuter();
ok(
  apres.join(",") === "contrat_a_signer,signer_contrat",
  `après : anon n'exécute que la signature publique (${apres.join(", ")})`,
);

// Appels réels
await db.exec(`SET ROLE anon;`);
await expectError(
  `SELECT * FROM public.conformite_sous_traitants()`,
  "permission denied for function",
  "anon : conformite_sous_traitants() refusée",
);
await expectError(
  `SELECT public.est_gestionnaire()`,
  "permission denied for function",
  "anon : est_gestionnaire() refusée",
);
await expectError(
  `SELECT public.get_user_company_id(gen_random_uuid())`,
  "permission denied for function",
  "anon : get_user_company_id() refusée",
);
await expectError(
  `SELECT public.contrat_a_signer('${"0".repeat(64)}')`,
  "lien_invalide",
  "anon : contrat_a_signer() toujours accessible (signature publique)",
);

// authenticated garde l'accès (RLS et RPC)
const U1 = "11111111-1111-1111-1111-111111111111";
await db.exec(`RESET ROLE;
  INSERT INTO auth.users VALUES ('${U1}', 'a@a.be', '{"company_name":"Société A"}');
  SELECT set_config('request.jwt.claim.sub', '${U1}', false); SET ROLE authenticated;`);
const g = await db.query<{ v: boolean }>(`SELECT public.est_gestionnaire() AS v`);
ok(g.rows[0].v === true, "authenticated : est_gestionnaire() fonctionne");
await db.exec(
  `INSERT INTO public.sous_traitants (company_id, raison_sociale) VALUES (public.get_user_company_id(auth.uid()), 'ST')`,
);
const n = await db.query<{ n: number }>(
  `SELECT count(*)::int AS n FROM public.conformite_sous_traitants()`,
);
ok(
  n.rows[0].n === 1,
  "authenticated : RLS (get_user_company_id) et conformite_sous_traitants() fonctionnent",
);

console.log(fails ? `\n✖ ${fails} échec(s)` : "\n✓ tous les tests passent");
process.exit(fails ? 1 : 0);

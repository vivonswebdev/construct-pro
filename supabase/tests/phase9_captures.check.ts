// Test de la migration « stockage documents / captures 30bis » (PR C) sur PGlite.
// Simule le schéma storage de Supabase (buckets, objects, foldername, RLS) et vérifie :
// bucket privé 5 Mo JPG/PNG/PDF, cloisonnement par société, capture liée non supprimable.
// Prérequis (une fois) : bun add -d @electric-sql/pglite
// Lancer : bun supabase/tests/phase9_captures.check.ts

import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { initSupabaseSimule } from "./supabase_simule";

const MIG = process.argv[2] ?? join(import.meta.dir, "..", "migrations");
const MIGRATION_C = "20261014120000_storage_documents_30bis.sql";
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
const compte = async (sql: string) => Number((await db.query<{ n: number }>(sql)).rows[0].n);

try {
  await db.exec(readFileSync(join(MIG, MIGRATION_C), "utf8"));
  ok(true, "migration rejouée une seconde fois sans erreur (idempotente)");
} catch (e) {
  ok(false, `migration non idempotente → ${(e as Error).message}`);
}

const b = (
  await db.query<{ public: boolean; file_size_limit: number; allowed_mime_types: string[] }>(
    `SELECT public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'documents'`,
  )
).rows[0];
ok(
  b?.public === false &&
    Number(b.file_size_limit) === 5 * 1024 * 1024 &&
    ["image/jpeg", "image/png", "application/pdf"].every((m) => b.allowed_mime_types.includes(m)) &&
    b.allowed_mime_types.length === 3,
  "bucket « documents » privé, 5 Mo, JPG / PNG / PDF",
);

const U1 = "11111111-1111-1111-1111-111111111111";
const U2 = "22222222-2222-2222-2222-222222222222";
await db.exec(`
  INSERT INTO auth.users VALUES ('${U1}', 'a@a.be', '{"company_name":"Société A"}'),
                                ('${U2}', 'b@b.be', '{"company_name":"Société B"}');`);
const comp = async (uid: string) =>
  (await db.query<{ c: string }>(`SELECT company_id AS c FROM public.profiles WHERE id = '${uid}'`))
    .rows[0].c;
const C1 = await comp(U1);
const C2 = await comp(U2);
const ST = "aaaaaaaa-0000-0000-0000-0000000000a1";
const F1 = `${C1}/30bis/0f8fad5b-d9cb-469f-a165-70867728950e.png`;
const F2 = `${C1}/30bis/7c9e6679-7425-40de-944b-e07fc1f90ae7.pdf`;
const DOC = `${C1}/conformite/attestation.pdf`;
const obj = (name: string) =>
  `INSERT INTO storage.objects (bucket_id, name) VALUES ('documents', '${name}')`;

await as(U1);
await db.exec(
  `INSERT INTO public.sous_traitants (id, company_id, raison_sociale) VALUES ('${ST}', '${C1}', 'ST A')`,
);
await db.exec(`${obj(F1)}; ${obj(F2)}; ${obj(DOC)};`);
ok(true, "dépôt dans le dossier de sa société accepté");
await expectError(
  obj(`${C2}/30bis/0f8fad5b-d9cb-469f-a165-70867728950e.png`),
  "row-level security",
  "dépôt dans le dossier d'une autre société refusé",
);
await expectError(obj("sans-dossier.png"), "row-level security", "dépôt hors dossier refusé");

// Capture liée à une vérification
await expectError(
  `INSERT INTO public.verifications_30bis (company_id, sous_traitant_id, dette_sociale, dette_fiscale, preuve_fichier)
   VALUES ('${C1}', '${ST}', false, false, '${C2}/30bis/0f8fad5b-d9cb-469f-a165-70867728950e.png')`,
  "verifications_30bis_preuve_chk",
  "capture d'un autre dossier refusée sur la vérification",
);
await db.exec(`
  INSERT INTO public.verifications_30bis (company_id, sous_traitant_id, dette_sociale, dette_fiscale, preuve_fichier)
  VALUES ('${C1}', '${ST}', false, false, '${F1}');`);
ok(true, "vérification enregistrée avec sa capture");

await db.exec(`DELETE FROM storage.objects WHERE name = '${F1}'`);
ok(
  (await compte(`SELECT count(*) AS n FROM storage.objects WHERE name = '${F1}'`)) === 1,
  "capture liée à une vérification : suppression sans effet (preuve conservée)",
);
await db.exec(`UPDATE storage.objects SET owner = '${U1}' WHERE name = '${F1}'`);
ok(
  (await compte(
    `SELECT count(*) AS n FROM storage.objects WHERE name = '${F1}' AND owner IS NOT NULL`,
  )) === 0,
  "capture 30bis : remplacement sans effet",
);
await db.exec(`DELETE FROM storage.objects WHERE name = '${F2}'`);
ok(
  (await compte(`SELECT count(*) AS n FROM storage.objects WHERE name = '${F2}'`)) === 0,
  "fichier 30bis orphelin (vérification non enregistrée) : suppression permise",
);
await db.exec(`DELETE FROM storage.objects WHERE name = '${DOC}'`);
ok(
  (await compte(`SELECT count(*) AS n FROM storage.objects WHERE name = '${DOC}'`)) === 0,
  "autre dossier de la société : suppression permise",
);

// Société B : ne voit rien de A
await as(U2);
ok(
  (await compte(`SELECT count(*) AS n FROM storage.objects`)) === 0,
  "la société B ne voit aucun fichier de la société A",
);
await db.exec(`DELETE FROM storage.objects WHERE name = '${F1}'`);
await db.exec("RESET ROLE");
ok(
  (await compte(`SELECT count(*) AS n FROM storage.objects WHERE name = '${F1}'`)) === 1,
  "la société B ne peut pas supprimer un fichier de A",
);

console.log(fails ? `\n✖ ${fails} échec(s)` : "\n✓ tous les tests passent");
process.exit(fails ? 1 : 0);

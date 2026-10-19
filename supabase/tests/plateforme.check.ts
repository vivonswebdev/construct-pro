// Tests des migrations « logos d'entreprise » et « démonstration et administrateur de la
// plateforme » sur PGlite (environnement Supabase simulé). Données fictives uniquement.
// Prérequis (une fois) : bun add -d @electric-sql/pglite
// Lancer : bun supabase/tests/plateforme.check.ts

import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { initSupabaseSimule } from "./supabase_simule";

const MIG = process.argv[2] ?? join(import.meta.dir, "..", "migrations");
const MIGRATIONS = [
  "20261016100000_logos_entreprise.sql",
  "20261016110000_demo_et_admin_plateforme.sql",
];

let fails = 0;
const ok = (cond: boolean, label: string) => {
  console.log(`${cond ? "✓" : "✗"} ${label}`);
  if (!cond) fails++;
};

const db = new PGlite();
await initSupabaseSimule(db);
for (const f of readdirSync(MIG)
  .filter((f) => f.endsWith(".sql"))
  .sort())
  await db.exec(readFileSync(join(MIG, f), "utf8"));
for (const f of MIGRATIONS) await db.exec(readFileSync(join(MIG, f), "utf8"));
// Les migrations postérieures (correctifs) sont réappliquées après la seconde exécution.
for (const f of readdirSync(MIG)
  .filter((f) => f.endsWith(".sql") && f > MIGRATIONS[MIGRATIONS.length - 1])
  .sort())
  await db.exec(readFileSync(join(MIG, f), "utf8"));
// Les migrations plus récentes (correctifs) sont rejouées après, comme en production.
for (const f of readdirSync(MIG)
  .filter((f) => f.endsWith(".sql") && f > MIGRATIONS[MIGRATIONS.length - 1])
  .sort())
  await db.exec(readFileSync(join(MIG, f), "utf8"));
ok(true, "migrations rejouées une seconde fois sans erreur (idempotentes)");

const ADM = "00000000-0000-0000-0000-0000000000a1"; // kaillaniyoussef@gmail.com, confirmé
const NC = "00000000-0000-0000-0000-0000000000a2"; // même adresse, NON confirmée
const X = "00000000-0000-0000-0000-0000000000a3"; // autre adresse, confirmée
const REEL = "00000000-0000-0000-0000-0000000000b1"; // client réel
const DEMO = "00000000-0000-0000-0000-0000000000c1"; // compte de test
const NOUV = "00000000-0000-0000-0000-0000000000d1"; // nouveau client

await db.exec(`INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at) VALUES
  ('${ADM}', 'kaillaniyoussef@gmail.com', '{"company_name": "Société de Youssef"}', now()),
  ('${NC}', 'KaillaniYoussef@Gmail.com', '{"company_name": "Imposteur"}', NULL),
  ('${X}', 'x@example.invalid', '{"company_name": "Société X"}', now()),
  ('${REEL}', 'client@example.invalid', '{"company_name": "Client réel SRL"}', now()),
  ('${DEMO}', 'demo@example.invalid', '{"company_name": "Société de démonstration"}', now())`);
const societe = async (uid: string) =>
  (await db.query<{ c: string }>(`SELECT company_id AS c FROM public.profiles WHERE id = '${uid}'`))
    .rows[0].c;
const sReel = await societe(REEL);
const sDemo = await societe(DEMO);
await db.exec(`INSERT INTO public.chantiers (company_id, name) VALUES
  ('${sReel}', 'Chantier du client réel'), ('${sDemo}', 'Villa Rénovation Namur')`);

const comme = (uid: string) =>
  db.exec(
    `RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uid}', false);`,
  );
const tenter = async (sql: string) => {
  try {
    await db.exec(sql);
    return "accepté";
  } catch (e) {
    return (e as Error).message;
  }
};
const val = async <T>(sql: string) => (await db.query<{ v: T }>(sql)).rows[0]?.v;
const chantiers = async () =>
  (await db.query<{ name: string }>(`SELECT name FROM public.chantiers ORDER BY name`)).rows.map(
    (r) => r.name,
  );

// ---- 1. Nouveau client : base vide, pas de peuplement de démonstration -----------------------
await db.exec(`RESET ROLE; INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
  VALUES ('${NOUV}', 'nouveau@example.invalid', '{"company_name": "Nouveau client"}', now())`);
const sNouv = await societe(NOUV);
await comme(NOUV);
ok(
  (await val<boolean>(`SELECT est_demo AS v FROM public.companies`)) === false,
  "nouveau compte : société non démo",
);
ok(
  (await val<string | null>(`SELECT public.seed_lock('${sNouv}') AS v`)) === null,
  "nouveau compte : seed_lock refuse le peuplement de démonstration",
);
ok((await chantiers()).length === 0, "nouveau compte : aucun chantier visible (base vide)");
const r1 = await tenter(`UPDATE public.companies SET est_demo = true WHERE id = '${sNouv}'`);
ok(r1.includes("est_demo_reserve_admin"), `un utilisateur ne peut pas se marquer démo → ${r1}`);
const r2 = await tenter(
  `UPDATE public.companies SET name = 'Nouveau client SRL' WHERE id = '${sNouv}'`,
);
ok(r2 === "accepté", "les autres champs de la société restent modifiables");

// ---- 2. Reconnaissance de l'administrateur ---------------------------------------------------
await comme(ADM);
ok(
  (await val<boolean>(`SELECT public.est_admin_plateforme() AS v`)) === true,
  "kaillaniyoussef@gmail.com (confirmé) : administrateur",
);
await comme(NC);
ok(
  (await val<boolean>(`SELECT public.est_admin_plateforme() AS v`)) === false,
  "même adresse NON confirmée : pas administrateur",
);
await comme(X);
ok(
  (await val<boolean>(`SELECT public.est_admin_plateforme() AS v`)) === false,
  "autre adresse : pas administrateur",
);
for (const sql of [
  `SELECT * FROM public.admin_comptes()`,
  `SELECT public.admin_definir_demo('${sDemo}', true)`,
]) {
  const r = await tenter(sql);
  ok(
    r.includes("acces_reserve_admin_plateforme"),
    `non-administrateur refusé : ${sql.slice(7, 40)}… → ${r}`,
  );
}
await db.exec(`RESET ROLE; SET ROLE anon; SELECT set_config('request.jwt.claim.sub', '', false);`);
const r3 = await tenter(`SELECT public.est_admin_plateforme()`);
ok(r3.includes("permission denied"), `anon ne peut pas appeler est_admin_plateforme → ${r3}`);

// ---- 3. Avant marquage : l'administrateur ne voit que sa propre société ----------------------
await comme(ADM);
ok(
  (await chantiers()).length === 0,
  "administrateur : aucun chantier d'une autre société par défaut",
);

// ---- 4. Marquage démo et lecture seule des données de démonstration ------------------------
await db.exec(`SELECT public.admin_definir_demo('${sDemo}', true)`);
ok(
  (await chantiers()).join() === "Villa Rénovation Namur",
  "administrateur : lit les chantiers de la société démo, pas ceux du client réel",
);
const lignes = (
  await db.query<{
    nom: string;
    est_demo: boolean;
    emails: string[] | null;
    nb_chantiers: number | null;
    nb_utilisateurs: number;
  }>(`SELECT nom, est_demo, emails, nb_chantiers, nb_utilisateurs FROM public.admin_comptes()`)
).rows;
const reel = lignes.find((l) => l.nom === "Client réel SRL");
const demo = lignes.find((l) => l.nom === "Société de démonstration");
ok(lignes.length === 6, `comptes : toutes les sociétés listées (${lignes.length})`);
ok(
  !!reel && reel.emails === null && reel.nb_chantiers === null && reel.nb_utilisateurs === 1,
  "comptes : client réel sans e-mails ni données métier",
);
ok(
  !!demo &&
    demo.est_demo &&
    demo.emails?.join() === "demo@example.invalid" &&
    demo.nb_chantiers === 1,
  "comptes : société démo avec e-mails et nombre de chantiers",
);
await db.exec(`UPDATE public.chantiers SET name = 'modifié' WHERE company_id = '${sDemo}'`);
await db.exec(`RESET ROLE`);
ok(
  (await val<string>(`SELECT name AS v FROM public.chantiers WHERE company_id = '${sDemo}'`)) ===
    "Villa Rénovation Namur",
  "administrateur : lecture seule (modification sans effet)",
);
await comme(ADM);
const r4 = await tenter(
  `INSERT INTO public.chantiers (company_id, name) VALUES ('${sDemo}', 'Ajout')`,
);
ok(r4 !== "accepté", `administrateur : pas d'ajout dans une société démo → ${r4}`);
await comme(X);
ok(
  (await chantiers()).length === 0,
  "autre utilisateur : ne voit pas les données de démonstration",
);

// Le compte démo peut être peuplé (une seule fois).
await comme(DEMO);
ok(
  (await val<string | null>(`SELECT public.seed_lock('${sDemo}') AS v`)) === sDemo,
  "société démo : peuplement autorisé",
);
ok(
  (await val<string | null>(`SELECT public.seed_lock('${sDemo}') AS v`)) === null,
  "société démo : une seule fois",
);

await comme(ADM);
await db.exec(`SELECT public.admin_definir_demo('${sDemo}', false)`);
ok((await chantiers()).length === 0, "démarquée : l'administrateur ne la voit plus");

// ---- 5. Logos ----------------------------------------------------------------------------
await db.exec(`RESET ROLE`);
const bucket = (
  await db.query<{ public: boolean; file_size_limit: number; allowed_mime_types: string[] }>(
    `SELECT public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'logos'`,
  )
).rows[0];
ok(
  bucket?.public === false &&
    Number(bucket.file_size_limit) === 2097152 &&
    bucket.allowed_mime_types.join() === "image/jpeg,image/png,image/webp",
  "bucket logos : privé, 2 Mo, JPG / PNG / WebP",
);
const U = "11111111-2222-3333-4444-555555555555";
await comme(REEL);
ok(
  (await tenter(
    `INSERT INTO storage.objects (bucket_id, name) VALUES ('logos', '${sReel}/logo-${U}.png')`,
  )) === "accepté",
  "logo : ajout dans le dossier de sa société",
);
const r5 = await tenter(
  `INSERT INTO storage.objects (bucket_id, name) VALUES ('logos', '${sDemo}/logo-${U}.png')`,
);
ok(r5 !== "accepté", "logo : ajout dans le dossier d'une autre société refusé");
const r6 = await tenter(
  `INSERT INTO storage.objects (bucket_id, name) VALUES ('logos', '${sReel}/autre.gif')`,
);
ok(r6 !== "accepté", "logo : nom ou extension non conforme refusé");
ok(
  (await tenter(
    `UPDATE public.companies SET logo_chemin = '${sReel}/logo-${U}.png' WHERE id = '${sReel}'`,
  )) === "accepté",
  "logo : chemin enregistré sur la société",
);
const r7 = await tenter(
  `UPDATE public.companies SET logo_chemin = '${sDemo}/logo-${U}.png' WHERE id = '${sReel}'`,
);
ok(r7.includes("companies_logo_chemin_chk"), "logo : chemin d'une autre société refusé");
await comme(DEMO);
ok(
  (await val<number>(
    `SELECT count(*)::int AS v FROM storage.objects WHERE bucket_id = 'logos'`,
  )) === 0,
  "logo : invisible pour une autre société",
);
await comme(REEL);
ok(
  (await tenter(
    `DELETE FROM storage.objects WHERE bucket_id = 'logos' AND name = '${sReel}/logo-${U}.png'`,
  )) === "accepté" &&
    (await val<number>(
      `SELECT count(*)::int AS v FROM storage.objects WHERE bucket_id = 'logos'`,
    )) === 0,
  "logo : suppression par sa société",
);

// ---- 6. Droits d'exécution ----------------------------------------------------------------
await db.exec(`RESET ROLE`);
const anon = (
  await db.query<{ f: string }>(`
    SELECT p.proname AS f FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f' AND has_function_privilege('anon', p.oid, 'EXECUTE')
    ORDER BY 1`)
).rows.map((r) => r.f);
ok(
  anon.join() === "contrat_a_signer,signer_contrat",
  `anon n'exécute que la signature publique (${anon.join(", ")})`,
);

console.log(fails ? `\n✖ ${fails} échec(s)` : "\n✓ tous les tests passent");
process.exit(fails ? 1 : 0);

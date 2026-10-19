// Test de la migration « équipe — pointages » sur PGlite (environnement Supabase simulé).
// Cloisonnement entre sociétés, droits gestionnaire / ouvrier, motif obligatoire, historique
// non modifiable, chevauchement, travailleur inactif. Données fictives uniquement.
// Lancer : bun supabase/tests/equipe_pointages.check.ts

import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { initSupabaseSimule } from "./supabase_simule";

const MIG = process.argv[2] ?? join(import.meta.dir, "..", "migrations");
const MIGRATION = "20261020090000_equipe_pointages.sql";

let fails = 0;
const ok = (cond: boolean, label: string) => {
  console.log(`${cond ? "✓" : "✗"} ${label}`);
  if (!cond) fails++;
};

const A = "00000000-0000-0000-0000-00000000000a"; // admin société A
const O = "00000000-0000-0000-0000-00000000000f"; // ouvrier société A
const B = "00000000-0000-0000-0000-00000000000b"; // admin société B

const db = new PGlite();
await initSupabaseSimule(db);
for (const f of readdirSync(MIG)
  .filter((f) => f.endsWith(".sql"))
  .sort())
  await db.exec(readFileSync(join(MIG, f), "utf8"));
await db.exec(readFileSync(join(MIG, MIGRATION), "utf8"));
ok(true, "migration rejouée une seconde fois sans erreur (idempotente)");

await db.exec(`INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('${A}', 'a@example.invalid', '{"company_name": "Société A"}'),
  ('${O}', 'o@example.invalid', '{"company_name": "Temporaire"}'),
  ('${B}', 'b@example.invalid', '{"company_name": "Société B"}')`);
const societe = async (uid: string) =>
  (await db.query<{ c: string }>(`SELECT company_id AS c FROM public.profiles WHERE id = '${uid}'`))
    .rows[0].c;
const SA = await societe(A);
const SB = await societe(B);
await db.exec(
  `UPDATE public.profiles SET company_id = '${SA}', role = 'ouvrier' WHERE id = '${O}'`,
);

const un = async <T>(sql: string) => (await db.query<T>(sql)).rows[0];
const ins = async (sql: string) => (await un<{ id: string }>(sql)).id;
const W1 = await ins(
  `INSERT INTO public.personnel (company_id, full_name, status) VALUES ('${SA}', 'Ouvrier Un', 'actif') RETURNING id`,
);
const W2 = await ins(
  `INSERT INTO public.personnel (company_id, full_name, status) VALUES ('${SA}', 'Ouvrier Deux', 'actif') RETURNING id`,
);
const WI = await ins(
  `INSERT INTO public.personnel (company_id, full_name, status) VALUES ('${SA}', 'Ancien', 'inactif') RETURNING id`,
);
const WB = await ins(
  `INSERT INTO public.personnel (company_id, full_name, status) VALUES ('${SB}', 'Ouvrier B', 'actif') RETURNING id`,
);
const CA = await ins(
  `INSERT INTO public.chantiers (company_id, name) VALUES ('${SA}', 'Chantier A') RETURNING id`,
);
const CB = await ins(
  `INSERT INTO public.chantiers (company_id, name) VALUES ('${SB}', 'Chantier B') RETURNING id`,
);

const comme = (uid: string) =>
  db.exec(
    `RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uid}', false);`,
  );
const systeme = () => db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false);`);
const tenter = async (sql: string) => {
  try {
    await db.exec(sql);
    return "accepté";
  } catch (e) {
    return (e as Error).message;
  }
};
const compte = async (sql: string) => Number((await un<{ n: number }>(sql)).n);
const pointage = (w: string, c: string, s: string, arr: string, dep: string | null, pause = 0) =>
  `INSERT INTO public.pointages (company_id, personnel_id, chantier_id, date, arrivee, depart, pause_minutes)
   VALUES ('${s}', '${w}', '${c}', '2026-10-20', '${arr}', ${dep ? `'${dep}'` : "NULL"}, ${pause})`;

// ---- Gestionnaire de A --------------------------------------------------------------------
await comme(A);
ok(
  (await tenter(pointage(W1, CA, SA, "07:30", "16:00", 30))) === "accepté",
  "1. le gestionnaire pointe un travailleur sur un chantier",
);
const P1 = (await un<{ id: string; m: number; par: string }>(
  `SELECT id, minutes_travaillees AS m, created_by AS par FROM public.pointages WHERE personnel_id = '${W1}'`,
))!;
ok(P1.m === 480 && P1.par === A, "2. durée calculée (8 h 00) et auteur imposé");
ok(
  (await tenter(pointage(W1, CA, SA, "15:00", "17:00"))).includes("pointage_chevauchement"),
  "3. chevauchement le même jour refusé",
);
ok(
  (await tenter(pointage(WI, CA, SA, "08:00", "12:00"))).includes("pointage_travailleur_inactif"),
  "4. travailleur inactif refusé",
);
ok(
  (await tenter(pointage(W2, CA, SA, "12:00", "08:00"))).includes("pointages_horaires_chk"),
  "5. départ avant l'arrivée refusé",
);
ok(
  (await tenter(pointage(W2, CB, SA, "08:00", "12:00"))) !== "accepté",
  "6. chantier d'une autre société refusé",
);
ok(
  (await tenter(`UPDATE public.pointages SET depart = '17:00' WHERE id = '${P1.id}'`)).includes(
    "pointage_motif_obligatoire",
  ),
  "7. modification directe sans motif refusée",
);
ok(
  (await tenter(
    `SELECT public.corriger_pointage('${P1.id}', '${CA}', '2026-10-20', '07:30', '16:30', 30, NULL, 'Oubli de 30 min')`,
  )) === "accepté",
  "8. correction avec motif acceptée",
);
const corr = await un<{ n: number; avant: string; apres: string; motif: string; par: string }>(
  `SELECT count(*) OVER () AS n, avant->>'depart' AS avant, apres->>'depart' AS apres, motif, par
   FROM public.pointage_corrections WHERE pointage_id = '${P1.id}'`,
);
ok(
  Number(corr.n) === 1 &&
    corr.avant === "16:00:00" &&
    corr.apres === "16:30:00" &&
    corr.motif === "Oubli de 30 min" &&
    corr.par === A,
  "9. historique : avant, après, motif et auteur",
);
ok(
  (
    await tenter(
      `SELECT public.corriger_pointage('${P1.id}', '${CA}', '2026-10-20', '07:30', '16:30', 30, NULL, '  ')`,
    )
  ).includes("pointage_motif_obligatoire"),
  "10. motif vide refusé",
);
await db.exec(pointage(W2, CA, SA, "08:00", null));
const P2 = (
  await un<{ id: string }>(`SELECT id FROM public.pointages WHERE personnel_id = '${W2}'`)
).id;
ok(
  (await tenter(
    `UPDATE public.pointages SET depart = '12:00', pause_minutes = 15 WHERE id = '${P2}'`,
  )) === "accepté" &&
    (await compte(
      `SELECT count(*) AS n FROM public.pointage_corrections WHERE pointage_id = '${P2}'`,
    )) === 0,
  "11. enregistrer le départ d'un pointage en cours : sans motif, sans correction",
);
ok(
  (await tenter(`DELETE FROM public.pointages WHERE id = '${P2}'`)).includes(
    "pointage_motif_obligatoire",
  ),
  "12. suppression directe sans motif refusée",
);
ok(
  (await tenter(`SELECT public.supprimer_pointage('${P2}', 'Doublon')`)) === "accepté" &&
    (await compte(
      `SELECT count(*) AS n FROM public.pointage_corrections WHERE pointage_id = '${P2}' AND action = 'suppression'`,
    )) === 1,
  "13. suppression avec motif : tracée",
);
ok(
  (await tenter(`UPDATE public.pointage_corrections SET motif = 'x'`)) !== "accepté" &&
    (await tenter(`DELETE FROM public.pointage_corrections`)) !== "accepté" &&
    (await tenter(
      `INSERT INTO public.pointage_corrections (company_id, pointage_id, personnel_id, action, avant, motif)
       VALUES ('${SA}', gen_random_uuid(), '${W1}', 'modification', '{}', 'faux')`,
    )) !== "accepté",
  "14. historique ni modifiable, ni supprimable, ni falsifiable par l'API",
);
ok(
  (await tenter(`UPDATE public.pointages SET personnel_id = '${W2}' WHERE id = '${P1.id}'`)) !==
    "accepté",
  "15. travailleur d'un pointage non modifiable",
);

// ---- Société B ----------------------------------------------------------------------------
await comme(B);
ok(
  (await compte(`SELECT count(*) AS n FROM public.pointages`)) === 0 &&
    (await compte(`SELECT count(*) AS n FROM public.pointage_corrections`)) === 0,
  "16. la société B ne voit ni les pointages ni l'historique de A",
);
ok(
  (await tenter(pointage(W1, CA, SA, "08:00", "09:00"))) !== "accepté" &&
    (await tenter(pointage(W1, CB, SB, "08:00", "09:00"))) !== "accepté",
  "17. la société B ne peut pas pointer un travailleur de A",
);
ok(
  (
    await tenter(
      `SELECT public.corriger_pointage('${P1.id}', '${CA}', '2026-10-20', '06:00', '16:30', 0, NULL, 'pirate')`,
    )
  ).includes("pointage_introuvable"),
  "18. la société B ne peut pas corriger un pointage de A",
);
ok((await tenter(pointage(WB, CB, SB, "08:00", "12:00"))) === "accepté", "19. B pointe chez elle");

// ---- Ouvrier de A -------------------------------------------------------------------------
await comme(O);
ok(
  (await compte(`SELECT count(*) AS n FROM public.pointages`)) === 0,
  "20. ouvrier non lié à une fiche : aucun pointage visible",
);
ok(
  (await tenter(`UPDATE public.personnel SET profile_id = '${O}' WHERE id = '${W1}'`)).includes(
    "personnel_lien_compte_reserve",
  ),
  "21. l'ouvrier ne peut pas se lier lui-même à une fiche",
);
await comme(A);
ok(
  (await tenter(`UPDATE public.personnel SET profile_id = '${B}' WHERE id = '${W2}'`)).includes(
    "personnel_lien_compte_autre_societe",
  ),
  "22. lien vers un compte d'une autre société refusé",
);
ok(
  (await tenter(`UPDATE public.personnel SET profile_id = '${O}' WHERE id = '${W1}'`)) ===
    "accepté",
  "23. le gestionnaire lie le compte de l'ouvrier à sa fiche",
);
await db.exec(pointage(W2, CA, SA, "08:00", "12:00"));
await comme(O);
ok(
  (await compte(`SELECT count(*) AS n FROM public.pointages`)) === 1 &&
    (await compte(`SELECT count(*) AS n FROM public.pointages WHERE personnel_id = '${W1}'`)) === 1,
  "24. l'ouvrier lié voit ses seules heures",
);
ok(
  (await compte(`SELECT count(*) AS n FROM public.pointage_corrections`)) === 1,
  "25. l'ouvrier voit l'historique de ses propres pointages",
);
ok(
  (await tenter(pointage(W1, CA, SA, "18:00", "19:00"))) !== "accepté" &&
    (
      await tenter(
        `SELECT public.corriger_pointage('${P1.id}', '${CA}', '2026-10-20', '06:00', '16:30', 0, NULL, 'moi')`,
      )
    ).includes("pointage_introuvable"),
  "26. l'ouvrier ne saisit ni ne corrige",
);

// ---- Comptes de la société ----------------------------------------------------------------
await comme(A);
const comptes = (await db.query<{ id: string }>(`SELECT id FROM public.comptes_societe()`)).rows;
ok(
  comptes.length === 2 && comptes.every((c) => c.id === A || c.id === O),
  "27. comptes_societe() : comptes de sa société uniquement",
);
await comme(O);
ok(
  (await tenter(`SELECT * FROM public.comptes_societe()`)).includes(
    "personnel_lien_compte_reserve",
  ),
  "28. comptes_societe() refusé à l'ouvrier",
);

// ---- anon, droits, suppressions -----------------------------------------------------------
await db.exec(`RESET ROLE; SET ROLE anon; SELECT set_config('request.jwt.claim.sub', '', false);`);
ok(
  (await tenter(`SELECT * FROM public.pointages`)) !== "accepté" &&
    (await tenter(`SELECT * FROM public.pointage_corrections`)) !== "accepté",
  "29. anon : aucun accès aux pointages ni à l'historique",
);
await systeme();
const executable = async (role: string, fn: string) =>
  (await un<{ x: boolean }>(`SELECT has_function_privilege('${role}', '${fn}', 'EXECUTE') AS x`)).x;
ok(
  !(await executable(
    "anon",
    "public.corriger_pointage(uuid, uuid, date, time, time, integer, text, text)",
  )) &&
    !(await executable("anon", "public.supprimer_pointage(uuid, text)")) &&
    !(await executable("anon", "public.comptes_societe()")) &&
    !(await executable("authenticated", "public.pointages_garde()")) &&
    !(await executable("authenticated", "public.personnel_lien_compte()")),
  "30. fonctions fermées à anon ; triggers non exécutables directement",
);
ok(
  (await tenter(`DELETE FROM public.personnel WHERE id = '${W1}'`)) !== "accepté",
  "31. une fiche avec pointages ne peut pas être supprimée",
);
ok(
  (await tenter(`DELETE FROM public.companies WHERE id = '${SB}'`)) === "accepté" &&
    (await compte(`SELECT count(*) AS n FROM public.pointages WHERE company_id = '${SB}'`)) === 0,
  "32. suppression d'une société entière : ses pointages partent en cascade",
);
ok(
  (await compte(
    `SELECT count(*) AS n FROM pg_policies WHERE tablename IN ('pointages', 'pointage_corrections') AND policyname = 'admin_plateforme_demo_select'`,
  )) === 2,
  "33. policy de lecture « démo » de l'administrateur plateforme présente",
);

console.log(fails ? `\n✖ ${fails} échec(s)` : "\n✓ tous les tests passent");
process.exit(fails ? 1 : 0);

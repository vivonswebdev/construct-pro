// Tests de la migration « back-office administrateur » sur PGlite (environnement Supabase simulé).
// Vérifie surtout qu'AUCUNE donnée métier ni e-mail de client réel ne sort des fonctions.
// Données fictives uniquement.
// Prérequis (une fois) : bun add -d @electric-sql/pglite
// Lancer : bun supabase/tests/backoffice.check.ts

import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { initSupabaseSimule } from "./supabase_simule";

const MIG = process.argv[2] ?? join(import.meta.dir, "..", "migrations");
const MIGRATION = "20261017090000_backoffice_admin.sql";

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
await db.exec(readFileSync(join(MIG, MIGRATION), "utf8"));
ok(true, "migration rejouée une seconde fois sans erreur (idempotente)");

const ADM = "00000000-0000-0000-0000-0000000000a1";
const REEL = "00000000-0000-0000-0000-0000000000b1";
const DEMO = "00000000-0000-0000-0000-0000000000c1";
const X = "00000000-0000-0000-0000-0000000000d1";
await db.exec(`INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at, last_sign_in_at) VALUES
  ('${ADM}', 'kaillaniyoussef@gmail.com', '{"company_name": "CONSTRUCT TEST", "full_name": "Youssef"}', now(), now()),
  ('${REEL}', 'secret-client@example.invalid', '{"company_name": "Client réel SRL", "full_name": "Nom Secret"}', now(), now() - interval '1 day'),
  ('${DEMO}', 'demo@example.invalid', '{"company_name": "Démo SRL", "full_name": "Jean Démo"}', now(), NULL),
  ('${X}', 'x@example.invalid', '{"company_name": "Société X"}', now(), NULL)`);
const societe = async (uid: string) =>
  (await db.query<{ c: string }>(`SELECT company_id AS c FROM public.profiles WHERE id = '${uid}'`))
    .rows[0].c;
const sReel = await societe(REEL);
const sDemo = await societe(DEMO);
await db.exec(`
  INSERT INTO public.chantiers (company_id, name) VALUES
    ('${sReel}', 'CHANTIER-SECRET-REEL'), ('${sReel}', 'CHANTIER-SECRET-REEL-2'), ('${sDemo}', 'Villa démo');
  INSERT INTO public.sous_traitants (id, company_id, raison_sociale) VALUES
    ('aaaaaaaa-0000-0000-0000-000000000001', '${sReel}', 'ST-SECRET-REEL'),
    ('aaaaaaaa-0000-0000-0000-000000000002', '${sDemo}', 'ST démo');
  INSERT INTO public.sous_traitant_contrats (company_id, sous_traitant_id, descriptif_prestations, montant_forfait_ht) VALUES
    ('${sReel}', 'aaaaaaaa-0000-0000-0000-000000000001', 'CONTRAT-SECRET', 99999),
    ('${sDemo}', 'aaaaaaaa-0000-0000-0000-000000000002', 'Contrat démo', 1000);
  UPDATE public.profiles SET role = 'gerant' WHERE id = '${X}';`);

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
const SECRETS = ["SECRET", "secret-client@", "Nom Secret", "99999"];
const fuite = (rows: unknown[]) => {
  const t = JSON.stringify(rows);
  return SECRETS.filter((s) => t.includes(s));
};

// ---- Refus pour les non-administrateurs et anon --------------------------------------------
await comme(X);
for (const sql of [
  "SELECT * FROM public.admin_statistiques()",
  "SELECT * FROM public.admin_utilisateurs()",
  "SELECT * FROM public.admin_activite()",
  `SELECT * FROM public.admin_conformite('${sDemo}')`,
]) {
  const r = await tenter(sql);
  ok(
    r.includes("acces_reserve_admin_plateforme"),
    `non-administrateur refusé : ${sql.slice(21, 45)} → ${r}`,
  );
}
for (const t of ["journal_plateforme", "erreurs_application"]) {
  const r = await tenter(`SELECT * FROM public.${t}`);
  ok(r.includes("permission denied"), `${t} : lecture directe refusée → ${r}`);
}
const r0 = await tenter(`INSERT INTO public.journal_plateforme (type) VALUES ('societe_creee')`);
ok(r0.includes("permission denied"), "journal : écriture directe refusée");
await db.exec(`RESET ROLE; SET ROLE anon; SELECT set_config('request.jwt.claim.sub', '', false);`);
for (const f of ["admin_statistiques()", "admin_activite()", "signaler_erreur('a','b','c','d')"]) {
  const r = await tenter(`SELECT public.${f}`);
  ok(r.includes("permission denied"), `anon refusé : ${f}`);
}

// ---- Erreurs signalées par l'application ---------------------------------------------------
await comme(REEL);
await db.exec(
  `SELECT public.signaler_erreur('TypeError', 'détail avec CHANTIER-SECRET-REEL', '/chantiers/123', 'Test')`,
);
await comme(DEMO);
await db.exec(
  `SELECT public.signaler_erreur('NetworkError', 'Message démo', '/dashboard', 'Test')`,
);
for (let i = 0; i < 25; i++)
  await db.exec(`SELECT public.signaler_erreur('Boucle', 'x', '/', 'T')`);
await db.exec(`RESET ROLE`);
const nbBoucle = Number(
  (
    await db.query<{ n: number }>(
      `SELECT count(*) AS n FROM public.erreurs_application WHERE code = 'Boucle'`,
    )
  ).rows[0].n,
);
ok(
  nbBoucle === 19,
  `erreurs limitées à 20 par utilisateur sur 10 min (${nbBoucle + 1} enregistrées)`,
);
await db.exec(
  `INSERT INTO public.erreurs_application (cree_le, code) VALUES (now() - interval '91 days', 'Ancienne')`,
);
await comme(DEMO);
await db.exec(`SELECT public.signaler_erreur('Purge', 'x', '/', 'T')`); // au-delà de la limite : ignorée
await comme(X);
await db.exec(`SELECT public.signaler_erreur('Purge', 'x', '/', 'T')`);
await db.exec(`RESET ROLE`);
ok(
  Number(
    (
      await db.query<{ n: number }>(
        `SELECT count(*) AS n FROM public.erreurs_application WHERE code = 'Ancienne'`,
      )
    ).rows[0].n,
  ) === 0,
  "erreurs de plus de 90 jours purgées",
);

// ---- Administrateur ------------------------------------------------------------------------
await comme(ADM);
await db.exec(`SELECT public.admin_definir_demo('${sDemo}', true)`);

const stats = (
  await db.query<{ indicateur: string; reel: number; demo: number }>(
    `SELECT * FROM public.admin_statistiques()`,
  )
).rows;
const st = (k: string) => stats.find((s) => s.indicateur === k);
ok(
  Number(st("societes")?.reel) === 3 &&
    Number(st("societes")?.demo) === 1 &&
    Number(st("chantiers")?.reel) === 2 &&
    Number(st("chantiers")?.demo) === 1 &&
    Number(st("contrats")?.reel) === 1 &&
    Number(st("sous_traitants")?.demo) === 1 &&
    st("prestations") !== undefined &&
    st("verifications_30bis") !== undefined,
  "statistiques : totaux séparés réel / démo (7 indicateurs + utilisateurs)",
);
ok(fuite(stats).length === 0, "statistiques : aucune donnée de client réel");

const users = (
  await db.query<{
    email: string | null;
    nom: string | null;
    societe: string;
    role: string;
    derniere_connexion: string | null;
    est_demo: boolean;
  }>(`SELECT * FROM public.admin_utilisateurs()`)
).rows;
const uReel = users.find((u) => u.societe === "Client réel SRL");
const uDemo = users.find((u) => u.societe === "Démo SRL");
ok(users.length === 4, `utilisateurs : tous listés (${users.length})`);
ok(
  !!uReel &&
    uReel.email === null &&
    uReel.nom === null &&
    uReel.role === "admin" &&
    !!uReel.derniere_connexion,
  "utilisateurs : client réel → rôle, société, dates ; ni e-mail ni nom",
);
ok(
  !!uDemo && uDemo.email === "demo@example.invalid" && uDemo.nom === "Jean Démo",
  "utilisateurs : démo → e-mail et nom",
);
ok(fuite(users).length === 0, `utilisateurs : aucune fuite (${fuite(users).join(", ")})`);

const act = (
  await db.query<{
    categorie: string;
    type: string;
    societe: string | null;
    email: string | null;
    details: Record<string, string> | null;
  }>(`SELECT * FROM public.admin_activite()`)
).rows;
const cats = new Set(act.map((a) => a.categorie));
ok(
  ["connexion", "creation_compte", "changement", "erreur"].every((c) => cats.has(c)),
  `activité : 4 catégories (${[...cats].join(", ")})`,
);
ok(
  act.some((a) => a.type === "societe_creee") &&
    act.some((a) => a.type === "demo_activee" && a.societe === "Démo SRL") &&
    act.some((a) => a.type === "profil_modifie"),
  "journal : société créée, démo activée, profil modifié (triggers)",
);
const errReel = act.find((a) => a.categorie === "erreur" && a.societe === "Client réel SRL");
const errDemo = act.find((a) => a.categorie === "erreur" && a.type === "NetworkError");
ok(
  !!errReel && errReel.details?.page === "/chantiers/123" && errReel.details?.message === undefined,
  "erreur d'un client réel : code et page, sans message",
);
ok(!!errDemo && errDemo.details?.message === "Message démo", "erreur d'une démo : message visible");
ok(fuite(act).length === 0, `activité : aucune fuite (${fuite(act).join(", ")})`);
ok(
  (await db.query(`SELECT * FROM public.admin_activite('erreur', 5)`)).rows.length <= 5,
  "activité : filtre par catégorie et limite",
);

// Connexions depuis auth.audit_log_entries quand la table existe (Supabase).
await db.exec(`RESET ROLE;
  CREATE TABLE auth.audit_log_entries (id uuid DEFAULT gen_random_uuid(), payload json, created_at timestamptz DEFAULT now());
  INSERT INTO auth.audit_log_entries (payload) VALUES ('{"action": "login", "actor_id": "${REEL}"}'), ('{"action": "logout", "actor_id": "${REEL}"}');`);
await comme(ADM);
const cx = (
  await db.query<{ type: string; societe: string; email: string | null }>(
    `SELECT * FROM public.admin_activite('connexion')`,
  )
).rows;
ok(
  cx.length === 1 &&
    cx[0].type === "login" &&
    cx[0].societe === "Client réel SRL" &&
    cx[0].email === null,
  "connexions : journal d'audit Supabase (login), sans e-mail pour un client réel",
);

// Conformité : démo seulement.
const conf = (await db.query(`SELECT * FROM public.admin_conformite('${sDemo}')`)).rows;
ok(conf.length === 1, "conformité d'une société démo lisible");
const r1 = await tenter(`SELECT * FROM public.admin_conformite('${sReel}')`);
ok(r1.includes("acces_reserve_admin_plateforme"), "conformité d'un client réel refusée");

// Lecture directe : démo oui, client réel non (RLS de la PR #23).
const ch = (
  await db.query<{ name: string }>(`SELECT name FROM public.chantiers ORDER BY name`)
).rows.map((r) => r.name);
ok(ch.join() === "Villa démo", "chantiers lisibles par l'administrateur : démo uniquement");

// ---- Droits anon ---------------------------------------------------------------------------
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

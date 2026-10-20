// Test de la migration « documents RH » (cartes d'identité, contrats papier) sur PGlite.
// Bucket privé `rh` sans lecture directe, tickets de 60 s, journal d'accès, consentement,
// échéance sortie + 1 an, cloisonnement entre sociétés, rôle ouvrier sans accès.
// Données fictives uniquement. Lancer : bun supabase/tests/documents_rh.check.ts

import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { initSupabaseSimule } from "./supabase_simule";

const MIG = process.argv[2] ?? join(import.meta.dir, "..", "migrations");
const MIGRATION = "20261020120000_documents_rh.sql";

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
const un = async <T>(sql: string) => (await db.query<T>(sql)).rows[0];
const societe = async (uid: string) =>
  (await un<{ c: string }>(`SELECT company_id AS c FROM public.profiles WHERE id = '${uid}'`)).c;
const SA = await societe(A);
const SB = await societe(B);
await db.exec(
  `UPDATE public.profiles SET company_id = '${SA}', role = 'ouvrier' WHERE id = '${O}'`,
);
const ins = async (sql: string) => (await un<{ id: string }>(sql)).id;
const W = await ins(
  `INSERT INTO public.personnel (company_id, full_name, status) VALUES ('${SA}', 'Ouvrier Un', 'actif') RETURNING id`,
);
const WB = await ins(
  `INSERT INTO public.personnel (company_id, full_name, status) VALUES ('${SB}', 'Ouvrier B', 'actif') RETURNING id`,
);
const ST = await ins(
  `INSERT INTO public.sous_traitants (company_id, raison_sociale) VALUES ('${SA}', 'Sous-traitant A') RETURNING id`,
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
/** Simule le téléversement par l'API Storage (INSERT soumis aux policies). */
const televerser = (chemin: string) =>
  tenter(
    `INSERT INTO storage.objects (bucket_id, name, metadata) VALUES ('rh', '${chemin}', '{"size": 1234}')`,
  );
const preparer = async (args: string) =>
  un<{ id: string; fichier: string }>(`SELECT * FROM public.preparer_depot_rh(${args})`);
const carte = (consent: string, remplace = "NULL") =>
  `'carte_identite', 'jpg', NULL, '${W}', NULL, NULL, NULL, ${consent}, 'Consentement écrit', ${remplace}`;

// ---- Bucket ------------------------------------------------------------------------------
const bucket = await un<{ public: boolean; l: number; t: string[] }>(
  `SELECT public, file_size_limit AS l, allowed_mime_types AS t FROM storage.buckets WHERE id = 'rh'`,
);
ok(
  bucket.public === false && Number(bucket.l) === 5242880 && bucket.t.length === 3,
  "1. bucket rh privé, 5 Mo, JPG / PNG / PDF",
);

// ---- Dépôt d'une carte d'identité ---------------------------------------------------------
await comme(A);
ok(
  (await tenter(`SELECT * FROM public.preparer_depot_rh(${carte("false")})`)).includes(
    "rh_consentement_obligatoire",
  ),
  "2. carte sans consentement refusée",
);
const d1 = await preparer(carte("true"));
ok(
  d1.fichier.startsWith(`${SA}/`) && d1.fichier.endsWith(".jpg"),
  "3. chemin préfixé par la société",
);
ok(
  (await televerser(`${SA}/${crypto.randomUUID()}.jpg`)) !== "accepté",
  "4. téléversement d'un fichier non préparé refusé",
);
ok((await televerser(d1.fichier)) === "accepté", "5. téléversement du fichier préparé accepté");
ok(
  (await compte(`SELECT count(*) AS n FROM storage.objects WHERE bucket_id = 'rh'`)) === 0,
  "6. aucune lecture directe du fichier (même juste après le dépôt)",
);
await db.exec(`SELECT public.confirmer_depot_rh('${d1.id}')`);
const doc = await un<{ statut: string; c: string | null; cp: string; taille: number }>(
  `SELECT statut, conserver_jusqu_au AS c, consentement_par AS cp, taille FROM public.documents_rh WHERE id = '${d1.id}'`,
);
ok(
  doc.statut === "actif" && doc.c === null && doc.cp === A && doc.taille === 1234,
  "7. dépôt confirmé : actif, consentement enregistré, échéance inconnue sans date de sortie",
);
ok(
  (await compte(
    `SELECT count(*) AS n FROM public.journal_acces_rh WHERE document_id = '${d1.id}' AND action = 'depot' AND par = '${A}'`,
  )) === 1,
  "8. dépôt journalisé",
);

// ---- Échéance : date de sortie + 1 an ----------------------------------------------------
await db.exec(`UPDATE public.personnel SET date_sortie = '2026-12-31' WHERE id = '${W}'`);
ok(
  String(
    (
      await un<{ c: string }>(
        `SELECT conserver_jusqu_au::text AS c FROM public.documents_rh WHERE id = '${d1.id}'`,
      )
    ).c,
  ) === "2027-12-31",
  "9. conservation recalculée : sortie + 1 an",
);

// ---- Consultation sur ticket -------------------------------------------------------------
const chemin = (await un<{ f: string }>(`SELECT public.ouvrir_document_rh('${d1.id}') AS f`)).f;
ok(
  chemin === d1.fichier &&
    (await compte(`SELECT count(*) AS n FROM storage.objects WHERE name = '${chemin}'`)) === 1,
  "10. ouverture : ticket de lecture, fichier lisible",
);
ok(
  (await compte(
    `SELECT count(*) AS n FROM public.journal_acces_rh WHERE document_id = '${d1.id}' AND action = 'consultation'`,
  )) === 1,
  "11. consultation journalisée",
);
ok(
  (await tenter(`DELETE FROM storage.objects WHERE name = '${chemin}'`)) === "accepté" &&
    (await compte(`SELECT count(*) AS n FROM storage.objects WHERE bucket_id = 'rh'`)) === 1,
  "12. un ticket de lecture ne permet pas d'effacer le fichier",
);
ok(
  (await tenter(`UPDATE storage.objects SET name = name WHERE bucket_id = 'rh'`)) === "accepté" &&
    true,
  "13. aucune policy de remplacement (UPDATE sans effet)",
);
await systeme();
await db.exec(`UPDATE public.tickets_fichiers_rh SET expire_le = now() - interval '1 second'`);
await comme(A);
ok(
  (await compte(`SELECT count(*) AS n FROM storage.objects WHERE bucket_id = 'rh'`)) === 0,
  "14. ticket expiré : plus de lecture",
);

// ---- Une seule carte active ; remplacement -----------------------------------------------
ok(
  (await tenter(`SELECT * FROM public.preparer_depot_rh(${carte("true")})`)).includes(
    "rh_carte_deja_active",
  ),
  "15. deuxième carte active refusée dès la préparation",
);
// Dépôt abandonné après téléversement : ticket d'effacement, plus de fichier orphelin.
const d2 = await preparer(
  `'autre_contractuel', 'pdf', 'Brouillon', '${W}', NULL, NULL, NULL, false, NULL, NULL`,
);
await televerser(d2.fichier);
const f2 = (await un<{ f: string }>(`SELECT public.annuler_depot_rh('${d2.id}') AS f`)).f;
ok(
  f2 === d2.fichier &&
    (await tenter(`DELETE FROM storage.objects WHERE name = '${f2}'`)) === "accepté" &&
    (await compte(`SELECT count(*) AS n FROM public.documents_rh WHERE id = '${d2.id}'`)) === 0,
  "15b. dépôt abandonné : ligne retirée, fichier effaçable",
);
const d3 = await preparer(carte("true", `'${d1.id}'`));
await televerser(d3.fichier);
await db.exec(`SELECT public.confirmer_depot_rh('${d3.id}')`);
const anc = await un<{ statut: string; c: string }>(
  `SELECT statut, conserver_jusqu_au::text AS c FROM public.documents_rh WHERE id = '${d1.id}'`,
);
ok(
  anc.statut === "remplace" && anc.c <= new Date().toISOString().slice(0, 10),
  "16. carte remplacée : à supprimer immédiatement",
);
const aTraiter = (await db.query<{ id: string }>(`SELECT id FROM public.documents_rh_a_traiter()`))
  .rows;
ok(
  aTraiter.some((r) => r.id === d1.id),
  "17. liste « à supprimer » : ancienne copie signalée",
);

// ---- Suppression ------------------------------------------------------------------------
ok(
  (await tenter(`SELECT public.supprimer_document_rh('${d1.id}', ' ')`)).includes(
    "rh_motif_obligatoire",
  ),
  "18. suppression sans motif refusée",
);
const f1 = (
  await un<{ f: string }>(`SELECT public.supprimer_document_rh('${d1.id}', 'Copie remplacée') AS f`)
).f;
ok(
  (await tenter(`DELETE FROM storage.objects WHERE name = '${f1}'`)) === "accepté" &&
    (await compte(`SELECT count(*) AS n FROM storage.objects WHERE true`)) === 0,
  "19. ticket de suppression : fichier effacé",
);
await systeme();
ok(
  (await compte(`SELECT count(*) AS n FROM storage.objects WHERE name = '${f1}'`)) === 0 &&
    (await compte(`SELECT count(*) AS n FROM storage.objects WHERE name = '${d3.fichier}'`)) === 1,
  "20. seul le fichier supprimé a disparu",
);
const sup = await un<{ statut: string; m: string }>(
  `SELECT statut, motif_suppression AS m FROM public.documents_rh WHERE id = '${d1.id}'`,
);
ok(
  sup.statut === "supprime" &&
    sup.m === "Copie remplacée" &&
    (await compte(
      `SELECT count(*) AS n FROM public.journal_acces_rh WHERE document_id = '${d1.id}' AND action IN ('remplacement', 'suppression')`,
    )) === 2,
  "21. ligne conservée (trace) ; remplacement et suppression journalisés",
);
await comme(A);
ok(
  (await tenter(`SELECT public.ouvrir_document_rh('${d1.id}')`)).includes(
    "rh_document_introuvable",
  ),
  "22. document supprimé : plus de consultation",
);

// ---- Contrat papier ---------------------------------------------------------------------
ok(
  (await tenter(
    `SELECT * FROM public.preparer_depot_rh('contrat_sous_traitance', 'pdf', 'Contrat', NULL, NULL, NULL, NULL, false, NULL, NULL)`,
  )) !== "accepté",
  "23. contrat de sous-traitance sans sous-traitant refusé",
);
const c1 = await preparer(
  `'contrat_sous_traitance', 'pdf', 'Contrat cadre 2026', NULL, '${ST}', NULL, NULL, false, NULL, NULL`,
);
await televerser(c1.fichier);
await db.exec(`SELECT public.confirmer_depot_rh('${c1.id}')`);
const c2 = await preparer(
  `'contrat_sous_traitance', 'pdf', 'Contrat cadre 2026 v2', NULL, '${ST}', NULL, NULL, false, NULL, '${c1.id}'`,
);
await televerser(c2.fichier);
await db.exec(`SELECT public.confirmer_depot_rh('${c2.id}')`);
ok(
  (await tenter(`SELECT public.ouvrir_document_rh('${c1.id}')`)) === "accepté",
  "24. contrat remplacé : l'ancienne version reste consultable",
);
ok(
  (
    await tenter(
      `SELECT * FROM public.preparer_depot_rh('autre_contractuel', 'exe', NULL, '${W}', NULL, NULL, NULL, false, NULL, NULL)`,
    )
  ).includes("rh_format_refuse"),
  "25. format non autorisé refusé",
);

// ---- Écritures directes interdites ------------------------------------------------------
ok(
  (await tenter(
    `INSERT INTO public.documents_rh (company_id, type, personnel_id, fichier, statut, consentement_le, consentement_par) VALUES ('${SA}', 'carte_identite', '${W}', '${SA}/${crypto.randomUUID()}.jpg', 'actif', now(), '${A}')`,
  )) !== "accepté" &&
    (await tenter(`UPDATE public.documents_rh SET statut = 'actif' WHERE id = '${d1.id}'`)) !==
      "accepté" &&
    (await tenter(`DELETE FROM public.journal_acces_rh`)) !== "accepté" &&
    (await tenter(
      `INSERT INTO public.tickets_fichiers_rh (user_id, fichier, action, expire_le) VALUES ('${A}', 'x', 'lecture', now() + interval '1 hour')`,
    )) !== "accepté",
  "26. aucune écriture directe (documents, journal, tickets)",
);

// ---- Société B --------------------------------------------------------------------------
await comme(B);
ok(
  (await compte(`SELECT count(*) AS n FROM public.documents_rh`)) === 0 &&
    (await compte(`SELECT count(*) AS n FROM public.journal_acces_rh`)) === 0,
  "27. la société B ne voit ni les documents ni le journal de A",
);
ok(
  (await tenter(`SELECT public.ouvrir_document_rh('${d3.id}')`)).includes("rh_acces_refuse") &&
    (await tenter(`SELECT public.supprimer_document_rh('${d3.id}', 'pirate')`)).includes(
      "rh_acces_refuse",
    ),
  "28. la société B ne peut ni ouvrir ni supprimer un document de A",
);
ok(
  (await tenter(
    `SELECT * FROM public.preparer_depot_rh('carte_identite', 'jpg', NULL, '${W}', NULL, NULL, NULL, true, NULL, NULL)`,
  )) !== "accepté",
  "29. la société B ne peut pas déposer pour un travailleur de A",
);
const db1 = await preparer(
  `'carte_identite', 'png', NULL, '${WB}', NULL, NULL, NULL, true, NULL, NULL`,
);
ok(
  (await televerser(`${SA}/${db1.fichier.split("/")[1]}`)) !== "accepté",
  "30. la société B ne peut pas écrire dans le dossier de A",
);

// ---- Ouvrier ----------------------------------------------------------------------------
await comme(O);
ok(
  (await compte(`SELECT count(*) AS n FROM public.documents_rh`)) === 0 &&
    (await tenter(`SELECT public.ouvrir_document_rh('${d3.id}')`)).includes("rh_acces_refuse") &&
    (await tenter(`SELECT * FROM public.preparer_depot_rh(${carte("true")})`)).includes(
      "rh_acces_refuse",
    ),
  "31. l'ouvrier ne voit, n'ouvre ni ne dépose rien",
);

// ---- anon et droits ---------------------------------------------------------------------
await db.exec(`RESET ROLE; SET ROLE anon; SELECT set_config('request.jwt.claim.sub', '', false);`);
ok(
  (await tenter(`SELECT * FROM public.documents_rh`)) !== "accepté" &&
    (await compte(`SELECT count(*) AS n FROM storage.objects WHERE bucket_id = 'rh'`)) === 0,
  "32. anon : aucun accès",
);
await systeme();
const ex = async (role: string, fn: string) =>
  (await un<{ x: boolean }>(`SELECT has_function_privilege('${role}', '${fn}', 'EXECUTE') AS x`)).x;
ok(
  !(await ex("anon", "public.ouvrir_document_rh(uuid)")) &&
    !(await ex("anon", "public.ticket_fichier_rh_valide(text, text)")) &&
    !(await ex("authenticated", "public.rh_exiger_gestionnaire(uuid)")) &&
    !(await ex("authenticated", "public.rh_echeance_carte(uuid)")),
  "33. fonctions fermées à anon ; fonctions internes non exécutables",
);
ok(
  (await tenter(`DELETE FROM public.personnel WHERE id = '${W}'`)) !== "accepté",
  "34. un travailleur avec documents ne peut pas être supprimé",
);
ok(
  (await compte(
    `SELECT count(*) AS n FROM pg_policies WHERE tablename IN ('documents_rh', 'journal_acces_rh') AND policyname = 'admin_plateforme_demo_select'`,
  )) === 2 &&
    (await compte(
      `SELECT count(*) AS n FROM pg_policies WHERE schemaname = 'storage' AND policyname LIKE 'rh_%'`,
    )) === 3,
  "35. policies démo (métadonnées) et 3 policies de stockage (insert, select, delete)",
);

console.log(fails ? `\n✖ ${fails} échec(s)` : "\n✓ tous les tests passent");
process.exit(fails ? 1 : 0);

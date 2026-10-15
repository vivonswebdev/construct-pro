// Test de la migration « signature des contrats » sur PostgreSQL en mémoire (PGlite).
// Rejoue toutes les migrations (schéma auth simulé), puis vérifie le circuit de signature.
// Prérequis (une fois) : bun add -d @electric-sql/pglite
// Lancer : bun supabase/tests/phase9_contrat_signatures.check.ts

import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { initSupabaseSimule } from "./supabase_simule";

const MIG = process.argv[2] ?? join(import.meta.dir, "..", "migrations");
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
const as = async (uid: string) =>
  db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub', '${uid}', false); SET ROLE authenticated;`,
  );
const asAnon = async () =>
  db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false);
     SELECT set_config('request.headers', '{"x-forwarded-for":"203.0.113.7, 10.0.0.1","user-agent":"Test/1.0"}', false);
     SET ROLE anon;`,
  );

const U1 = "11111111-1111-1111-1111-111111111111";
const U2 = "22222222-2222-2222-2222-222222222222";
await db.exec(`
  INSERT INTO auth.users VALUES ('${U1}', 'a@a.be', '{"company_name":"Société A"}'),
                                ('${U2}', 'b@b.be', '{"company_name":"Société B"}');`);
const C1 = (
  await db.query<{ company_id: string }>(
    `SELECT company_id FROM public.profiles WHERE id = '${U1}'`,
  )
).rows[0].company_id;

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const H1 = "a".repeat(64);
const H2 = "b".repeat(64);

await as(U1);
await db.exec(`
  INSERT INTO public.sous_traitants (id, company_id, raison_sociale) VALUES ('aaaaaaaa-0000-0000-0000-0000000000a1', '${C1}', 'ST A');
  INSERT INTO public.sous_traitant_contrats (id, company_id, sous_traitant_id, descriptif_prestations, montant_forfait_ht)
  VALUES ('aaaaaaaa-0000-0000-0000-0000000000c1', '${C1}', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'Plafonnage', 1000);
  INSERT INTO public.contrat_signatures (company_id, contrat_id, token, donnees, document_hash, statut,
    entreprise_signataire_nom, entreprise_signataire_qualite, entreprise_signature, signature, signe_le)
  VALUES ('${C1}', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'choisi-par-moi', '{"x":1}', '${H1}', 'signe',
    'Jeanne Dupont', 'Administratrice', '${PNG}', '${PNG}', now());`);
const row = (
  await db.query<{ token: string; statut: string; signature: string | null; par: string }>(
    `SELECT token, statut, signature, entreprise_signe_par AS par FROM public.contrat_signatures`,
  )
).rows[0];
ok(row.token.length === 64 && row.token !== "choisi-par-moi", "jeton imposé par la base (64 car.)");
ok(
  row.statut === "envoye" && row.signature === null,
  "une demande ne peut pas être créée « signée »",
);
ok(row.par === U1, "signataire entreprise = utilisateur connecté");
const T = row.token;

await expectError(
  `UPDATE public.contrat_signatures SET signataire_nom = 'Faux'`,
  "permission denied",
  "l'entreprise ne peut pas écrire la signature du sous-traitant",
);
await expectError(
  `UPDATE public.contrat_signatures SET statut = 'signe'`,
  "row-level security",
  "l'entreprise ne peut pas marquer la demande « signée »",
);
await expectError(
  `DELETE FROM public.contrat_signatures`,
  "permission denied",
  "suppression d'une demande de signature refusée",
);

// Société B : rien de visible
await as(U2);
const vu = await db.query<{ n: number }>(`SELECT count(*) AS n FROM public.contrat_signatures`);
ok(Number(vu.rows[0].n) === 0, "la société B ne voit pas les demandes de A");

// Sous-traitant anonyme
await asAnon();
await expectError(
  `SELECT * FROM public.contrat_signatures`,
  "permission denied",
  "anon : aucun accès direct à la table",
);
await expectError(
  `SELECT public.contrat_a_signer('${"0".repeat(64)}')`,
  "lien_invalide",
  "jeton inconnu refusé",
);
const lu = await db.query<{ j: { statut: string; donnees: { x: number } } }>(
  `SELECT public.contrat_a_signer('${T}') AS j`,
);
ok(lu.rows[0].j.statut === "envoye" && lu.rows[0].j.donnees.x === 1, "lecture par jeton");
await expectError(
  `SELECT public.signer_contrat('${T}', 'Piotr Nowak', 'Gérant', 'Bruxelles', '{}', '${PNG}', '${H2}', '${H2}')`,
  "document_modifie",
  "signature refusée si le document a changé (empreinte différente)",
);
await expectError(
  `SELECT public.signer_contrat('${T}', ' ', 'Gérant', 'Bruxelles', '{}', '${PNG}', '${H1}', '${H2}')`,
  "champs_requis",
  "signature refusée sans nom",
);
await expectError(
  `SELECT public.signer_contrat('${T}', 'Piotr Nowak', 'Gérant', 'Bruxelles', '{}', 'javascript:x', '${H1}', '${H2}')`,
  "signature_invalide",
  "signature refusée si l'image n'est pas un PNG",
);
const signe = await db.query<{ j: { statut: string; signe_ip: string } }>(
  `SELECT public.signer_contrat('${T}', 'Piotr Nowak', 'Gérant', 'Bruxelles', '{"iban":"BE68539007547034"}', '${PNG}', '${H1}', '${H2}') AS j`,
);
ok(signe.rows[0].j.statut === "signe", "signature du sous-traitant enregistrée");
ok(signe.rows[0].j.signe_ip === "203.0.113.7", `IP enregistrée (${signe.rows[0].j.signe_ip})`);
await expectError(
  `SELECT public.signer_contrat('${T}', 'Autre', 'Gérant', 'Bruxelles', '{}', '${PNG}', '${H1}', '${H2}')`,
  "deja_signe",
  "double signature refusée",
);

// Retour entreprise : demande signée figée, contrat non supprimable
await as(U1);
await expectError(
  `UPDATE public.contrat_signatures SET statut = 'annule'`,
  "signature_figee",
  "une demande signée ne peut plus être annulée",
);
await expectError(
  `DELETE FROM public.sous_traitant_contrats WHERE id = 'aaaaaaaa-0000-0000-0000-0000000000c1'`,
  "contrat_signatures_contrat_fk",
  "un contrat signé ne peut pas être supprimé",
);

// Annulation puis lien refusé ; expiration
await db.exec(`
  INSERT INTO public.contrat_signatures (company_id, contrat_id, donnees, document_hash,
    entreprise_signataire_nom, entreprise_signataire_qualite, entreprise_signature)
  VALUES ('${C1}', 'aaaaaaaa-0000-0000-0000-0000000000c1', '{}', '${H1}', 'J. Dupont', 'Gérante', '${PNG}'),
         ('${C1}', 'aaaaaaaa-0000-0000-0000-0000000000c1', '{}', '${H1}', 'J. Dupont', 'Gérante', '${PNG}');`);
const [t2, t3] = (
  await db.query<{ token: string }>(
    `SELECT token FROM public.contrat_signatures WHERE statut = 'envoye' ORDER BY id`,
  )
).rows.map((r) => r.token);
await db.exec(`UPDATE public.contrat_signatures SET statut = 'annule' WHERE token = '${t2}'`);
await db.exec(
  `RESET ROLE; UPDATE public.contrat_signatures SET expire_le = now() - interval '1 day' WHERE token = '${t3}'`,
);
await asAnon();
await expectError(
  `SELECT public.contrat_a_signer('${t2}')`,
  "lien_annule",
  "lien d'une demande annulée refusé",
);
await expectError(
  `SELECT public.signer_contrat('${t3}', 'P', 'G', 'B', '{}', '${PNG}', '${H1}', '${H2}')`,
  "lien_expire",
  "lien expiré refusé",
);

console.log(fails ? `\n✖ ${fails} échec(s)` : "\n✓ tous les tests passent");
process.exit(fails ? 1 : 0);

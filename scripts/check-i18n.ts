/**
 * Contrôle i18n — `bun run i18n:check`
 *
 * 1. Clés : chaque clé du français (référence) existe dans nl, en, ro, pl, et inversement
 *    (pas de clé orpheline). Les pluriels sont vérifiés selon les règles de chaque langue
 *    (Intl.PluralRules) : fr/en/nl → one/other, ro → one/few/other, pl → one/few/many/other.
 * 2. Chaînes en dur : texte JSX, attributs visibles (label, placeholder, title, alt, aria-label,
 *    sub) et messages toast/confirm/prompt/alert contenant des lettres, dans src/ (hors ui/,
 *    integrations/, fichiers générés). Exception ponctuelle : commentaire `i18n-ignore` sur la ligne.
 *
 * Code de sortie 1 si un problème est trouvé.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const ROOT = join(import.meta.dir, "..");
const LOCALES = join(ROOT, "src", "locales");
const LANGS = ["fr", "nl", "en", "ro", "pl"] as const;
const REF = "fr";
const PLURAL_SUFFIXES = ["zero", "one", "two", "few", "many", "other"];

let problems = 0;
const report = (msg: string) => {
  problems++;
  console.log(msg);
};

// ---------------------------------------------------------------------------
// 1. Clés
// ---------------------------------------------------------------------------
type Tree = { [k: string]: string | Tree };

function flatten(obj: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.set(key, v);
    else for (const [kk, vv] of flatten(v, key)) out.set(kk, vv);
  }
  return out;
}

/** "a.b_one" -> { base: "a.b", suffix: "one" } ; sinon suffix null. */
function splitPlural(key: string): { base: string; suffix: string | null } {
  const m = key.match(/^(.*)_(zero|one|two|few|many|other)$/);
  return m ? { base: m[1], suffix: m[2] } : { base: key, suffix: null };
}

function requiredPluralForms(lang: string): string[] {
  return new Intl.PluralRules(lang).resolvedOptions().pluralCategories as string[];
}

function loadLang(lang: string): Map<string, Map<string, string>> {
  const dir = join(LOCALES, lang);
  const byNs = new Map<string, Map<string, string>>();
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const ns = f.replace(/\.json$/, "");
    byNs.set(ns, flatten(JSON.parse(readFileSync(join(dir, f), "utf8")) as Tree));
  }
  return byNs;
}

function interpolations(s: string): string[] {
  return [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();
}

const data = new Map(LANGS.map((l) => [l, loadLang(l)]));
const ref = data.get(REF)!;

for (const lang of LANGS) {
  if (lang === REF) continue;
  const cur = data.get(lang)!;
  const forms = requiredPluralForms(lang);
  for (const ns of new Set([...ref.keys(), ...cur.keys()])) {
    const refKeys = ref.get(ns);
    const curKeys = cur.get(ns);
    if (!refKeys) {
      report(`[${lang}] namespace en trop : ${ns}`);
      continue;
    }
    if (!curKeys) {
      report(`[${lang}] namespace manquant : ${ns}`);
      continue;
    }
    // Bases attendues (pluriels regroupés)
    const refBases = new Map<string, boolean>(); // base -> est un pluriel
    for (const k of refKeys.keys()) {
      const { base, suffix } = splitPlural(k);
      refBases.set(base, refBases.get(base) || suffix !== null);
    }
    for (const [base, isPlural] of refBases) {
      if (isPlural) {
        for (const form of forms) {
          if (!curKeys.has(`${base}_${form}`)) report(`[${lang}] ${ns}:${base}_${form} manquant`);
        }
      } else if (!curKeys.has(base)) {
        report(`[${lang}] ${ns}:${base} manquant`);
      } else {
        const a = interpolations(refKeys.get(base)!).join();
        const b = interpolations(curKeys.get(base)!).join();
        if (a !== b) report(`[${lang}] ${ns}:${base} variables {{…}} différentes (${b} ≠ ${a})`);
      }
    }
    for (const k of curKeys.keys()) {
      const { base, suffix } = splitPlural(k);
      if (!refBases.has(base)) report(`[${lang}] ${ns}:${k} orpheline (absente du français)`);
      else if (suffix && !forms.includes(suffix) && suffix !== "other")
        report(`[${lang}] ${ns}:${k} forme plurielle inutile pour cette langue`);
      if (curKeys.get(k)!.trim() === "") report(`[${lang}] ${ns}:${k} vide`);
    }
  }
}
// Le français lui-même : formes plurielles complètes
for (const [ns, keys] of ref) {
  const forms = requiredPluralForms(REF);
  const bases = new Set(
    [...keys.keys()]
      .map(splitPlural)
      .filter((p) => p.suffix)
      .map((p) => p.base),
  );
  for (const base of bases)
    for (const form of forms)
      if (!keys.has(`${base}_${form}`)) report(`[fr] ${ns}:${base}_${form} manquant`);
}

// ---------------------------------------------------------------------------
// 2. Chaînes en dur
// ---------------------------------------------------------------------------
const SRC = join(ROOT, "src");
const EXCLUDE = [
  /[\\/]components[\\/]ui[\\/]/,
  /[\\/]integrations[\\/]/,
  /routeTree\.gen\.ts$/,
  /\.d\.ts$/,
];
const VISIBLE_ATTRS = new Set(["label", "placeholder", "title", "alt", "aria-label", "sub"]);
const MESSAGE_CALLS = new Set([
  "success",
  "error",
  "info",
  "warning",
  "message",
  "confirm",
  "prompt",
  "alert",
]);
const HAS_WORD = /\p{L}{2,}/u;
// Exemples de format (« BE0123456789 », « 1-ABC-123 », « 0123.456.789 ») : rien à traduire.
const FORMAT_EXAMPLE = (s: string) => /\d/.test(s) && !/\p{Ll}{2,}/u.test(s);
// Termes identiques dans toutes les langues (pas TVA/ONSS : BTW, RSZ, VAT…).
const UNIVERSAL = new Set(["CSV", "PDF", "IBAN", "BIC", "UBL", "Peppol", "Excel", "€"]);
const isText = (s: string) => HAS_WORD.test(s) && !FORMAT_EXAMPLE(s) && !UNIVERSAL.has(s.trim());

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });
}

for (const file of walk(SRC)) {
  if (EXCLUDE.some((re) => re.test(file))) continue;
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const flag = (node: ts.Node, what: string) => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
    if (lines[line]?.includes("i18n-ignore") || lines[line - 1]?.includes("i18n-ignore")) return;
    report(`${relative(ROOT, file)}:${line + 1}  ${what}`);
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      const s = node.getText().trim();
      if (isText(s)) flag(node, `texte JSX : ${JSON.stringify(s.slice(0, 60))}`);
    } else if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText();
      const init = node.initializer;
      const lit = ts.isStringLiteral(init)
        ? init
        : ts.isJsxExpression(init) && init.expression && ts.isStringLiteral(init.expression)
          ? init.expression
          : null;
      if (VISIBLE_ATTRS.has(name) && lit && isText(lit.text))
        flag(node, `${name}=${JSON.stringify(lit.text.slice(0, 60))}`);
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const fname = ts.isPropertyAccessExpression(callee)
        ? callee.name.getText()
        : ts.isIdentifier(callee)
          ? callee.getText()
          : "";
      const arg = node.arguments[0];
      if (
        MESSAGE_CALLS.has(fname) &&
        arg &&
        (ts.isStringLiteral(arg) ||
          ts.isNoSubstitutionTemplateLiteral(arg) ||
          ts.isTemplateExpression(arg)) &&
        HAS_WORD.test(arg.getText())
      )
        flag(node, `${fname}(${arg.getText().slice(0, 60)})`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

console.log(
  problems ? `\n✖ ${problems} problème(s) i18n` : "✓ i18n : clés cohérentes, aucune chaîne en dur",
);
process.exit(problems ? 1 : 0);

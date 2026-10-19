import { Fragment, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, CircleAlert, Download, Info } from "lucide-react";
import { ZidarProLogo } from "@/components/marque/ZidarProLogo";
import { useAuth } from "@/lib/auth";
import { ADRESSE_DEMO, EDITEUR, urlPage } from "@/site/config";
import { alternatives, INTERFACE, LIEN, pageParCle, urlDe } from "@/site/registre";
import type { Bloc, LangueSite, PageSite } from "@/site/types";

/** Texte avec liens `[texte](url)` ; liens externes ouverts dans un nouvel onglet. */
function Texte({ t }: { t: string }) {
  const parts: ReactNode[] = [];
  let i = 0;
  for (const m of t.matchAll(LIEN)) {
    const [tout, libelle, url] = m;
    parts.push(t.slice(i, m.index));
    const externe = /^https?:/.test(url);
    parts.push(
      <a
        key={m.index}
        href={url}
        className="font-medium text-[#0F2A43] underline decoration-[#F59E0B] decoration-2 underline-offset-2 hover:text-[#F59E0B]"
        {...(externe ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {libelle}
      </a>,
    );
    i = (m.index ?? 0) + tout.length;
  }
  parts.push(t.slice(i));
  return <>{parts}</>;
}

const dateBE = (iso: string) => iso.split("-").reverse().join("/");

function BoutonDemo({ langue, clair = false }: { langue: LangueSite; clair?: boolean }) {
  return (
    <a
      href={urlDe(langue, "demo")}
      className={`inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold shadow-sm transition ${
        clair
          ? "bg-white text-[#0F2A43] hover:bg-orange-50"
          : "bg-[#F59E0B] text-[#0F2A43] hover:bg-[#fbbf24]"
      }`}
    >
      {INTERFACE[langue].demo} <ArrowRight className="h-4 w-4" />
    </a>
  );
}

function Illustration({
  langue,
  variante,
}: {
  langue: LangueSite;
  variante: keyof (typeof INTERFACE)["fr"]["illus"];
}) {
  const ui = INTERFACE[langue];
  const d = ui.illus[variante];
  const icone = { ok: CheckCircle2, alerte: CircleAlert, neutre: Info };
  const couleur = { ok: "text-emerald-600", alerte: "text-amber-600", neutre: "text-slate-400" };
  return (
    <figure className="mx-auto my-8 max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
      <p className="mb-3 text-sm font-semibold text-[#0F2A43]">{d.titre}</p>
      <ul className="divide-y divide-slate-100 text-sm">
        {d.lignes.map((l) => {
          const I = icone[l.etat];
          return (
            <li key={l.libelle} className="flex items-center justify-between gap-3 py-2">
              <span className="flex items-center gap-2 text-slate-600">
                <I className={`h-4 w-4 shrink-0 ${couleur[l.etat]}`} aria-hidden="true" />
                {l.libelle}
              </span>
              <span className="font-semibold text-slate-900">{l.valeur}</span>
            </li>
          );
        })}
      </ul>
      <figcaption className="mt-3 text-[11px] text-slate-400">{ui.illustration}</figcaption>
    </figure>
  );
}

function FormulaireDemo({ langue }: { langue: LangueSite }) {
  const f = INTERFACE[langue].formulaire;
  const [v, setV] = useState({ nom: "", societe: "", email: "", telephone: "", message: "" });
  const champ = (k: keyof typeof v, label: string, type = "text", requis = true) => (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        required={requis}
        value={v[k]}
        onChange={(e) => setV({ ...v, [k]: e.target.value })}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0F2A43]"
      />
    </label>
  );
  const envoyer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ADRESSE_DEMO) return;
    const corps = [
      `${f.nom} : ${v.nom}`,
      `${f.societe} : ${v.societe}`,
      `${f.email} : ${v.email}`,
      `${f.telephone} : ${v.telephone}`,
      "",
      v.message,
    ].join("\n");
    window.location.href = `mailto:${ADRESSE_DEMO}?subject=${encodeURIComponent(f.sujet)}&body=${encodeURIComponent(corps)}`;
  };
  return (
    <form
      onSubmit={envoyer}
      className="mx-auto max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-[#0F2A43]">{f.titre}</h2>
      {champ("nom", f.nom)}
      {champ("societe", f.societe)}
      {champ("email", f.email, "email")}
      {champ("telephone", f.telephone, "tel", false)}
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">{f.message}</span>
        <textarea
          rows={4}
          value={v.message}
          onChange={(e) => setV({ ...v, message: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0F2A43]"
        />
      </label>
      {ADRESSE_DEMO ? (
        <>
          <button
            type="submit"
            className="w-full rounded-lg bg-[#F59E0B] px-5 py-3 text-sm font-semibold text-[#0F2A43] hover:bg-[#fbbf24]"
          >
            {f.envoyer}
          </button>
          <p className="text-xs text-slate-500">{f.note}</p>
        </>
      ) : (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{f.indisponible}</p>
      )}
    </form>
  );
}

function Blocs({ blocs, langue }: { blocs: Bloc[]; langue: LangueSite }) {
  const ui = INTERFACE[langue];
  return (
    <>
      {blocs.map((b, i) => {
        switch (b.type) {
          case "h2":
            return (
              <h2
                key={i}
                id={b.id}
                className="mt-12 scroll-mt-20 text-2xl font-bold tracking-tight text-[#0F2A43]"
              >
                {b.texte}
              </h2>
            );
          case "p":
            return (
              <p key={i} className="mt-4 leading-relaxed text-slate-700">
                <Texte t={b.texte} />
              </p>
            );
          case "liste":
            return (
              <ul key={i} className="mt-4 space-y-2">
                {b.items.map((t) => (
                  <li key={t} className="flex gap-2 text-slate-700">
                    <CheckCircle2
                      className="mt-1 h-4 w-4 shrink-0 text-[#F59E0B]"
                      aria-hidden="true"
                    />
                    <span>
                      <Texte t={t} />
                    </span>
                  </li>
                ))}
              </ul>
            );
          case "reponse":
            return (
              <div key={i} className="mt-6 rounded-xl border-l-4 border-[#F59E0B] bg-orange-50 p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-[#b45309]">
                  {b.titre}
                </p>
                <p className="mt-2 text-lg leading-relaxed text-slate-800">
                  <Texte t={b.texte} />
                </p>
              </div>
            );
          case "etapes":
            return (
              <ol key={i} className="mt-6 space-y-4">
                {b.items.map((e, k) => (
                  <li key={e.titre} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0F2A43] text-sm font-bold text-white">
                      {k + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">{e.titre}</p>
                      <p className="mt-1 text-slate-700">
                        <Texte t={e.texte} />
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            );
          case "cartes":
            return (
              <div key={i} className="mt-6 grid gap-4 sm:grid-cols-2">
                {b.items.map((c) => {
                  const contenu = (
                    <>
                      <p className="font-semibold text-[#0F2A43]">{c.titre}</p>
                      <p className="mt-1 text-sm text-slate-600">{c.texte}</p>
                    </>
                  );
                  return c.lien ? (
                    <a
                      key={c.titre}
                      href={c.lien}
                      className="block rounded-xl border border-slate-200 bg-white p-5 transition hover:border-[#F59E0B] hover:shadow-md"
                    >
                      {contenu}
                    </a>
                  ) : (
                    <div key={c.titre} className="rounded-xl border border-slate-200 bg-white p-5">
                      {contenu}
                    </div>
                  );
                })}
              </div>
            );
          case "tableau":
            return (
              <div key={i} className="mt-6 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#0F2A43] text-white">
                    <tr>
                      {b.entetes.map((h) => (
                        <th key={h} className="px-4 py-2 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.lignes.map((l) => (
                      <tr key={l.join("|")} className="border-b border-slate-200">
                        {l.map((c, k) => (
                          <td key={k} className="px-4 py-2 text-slate-700">
                            {c}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "faq":
            return (
              <div
                key={i}
                className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white"
              >
                {b.items.map((q) => (
                  <details key={q.q} className="group p-4" open>
                    <summary className="cursor-pointer list-none font-semibold text-slate-900">
                      <h3 className="inline">{q.q}</h3>
                    </summary>
                    <p className="mt-2 text-slate-700">
                      <Texte t={q.r} />
                    </p>
                  </details>
                ))}
              </div>
            );
          case "modele":
            return (
              <div
                key={i}
                className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5"
              >
                <div>
                  <p className="font-semibold text-[#0F2A43]">{b.libelle}</p>
                  <p className="text-sm text-slate-600">{b.description}</p>
                </div>
                <a
                  href={b.fichier}
                  download
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0F2A43] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1b3d5c]"
                >
                  <Download className="h-4 w-4" aria-hidden="true" /> {ui.telecharger}
                </a>
              </div>
            );
          case "sources":
            return (
              <section key={i} className="mt-10 rounded-xl border border-slate-200 p-5">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                  {ui.sources}
                </h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {b.items.map((s) => (
                    <li key={s.url}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#0F2A43] underline"
                      >
                        {s.titre}
                      </a>{" "}
                      <span className="text-slate-500">
                        ({ui.consulteLe} {dateBE(s.consulteLe)})
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          case "avertissement":
            return (
              <p
                key={i}
                className="mt-8 flex gap-2 rounded-lg bg-slate-100 p-4 text-sm text-slate-600"
              >
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                  aria-hidden="true"
                />
                <span>
                  <Texte t={b.texte} />
                </span>
              </p>
            );
          case "illustration":
            return <Illustration key={i} langue={langue} variante={b.variante} />;
          case "cta":
            return (
              <div key={i} className="mt-10 rounded-2xl bg-[#0F2A43] p-6 text-center sm:p-8">
                {b.texte && <p className="mb-4 text-lg font-semibold text-white">{b.texte}</p>}
                <BoutonDemo langue={langue} />
              </div>
            );
          case "demo":
            return (
              <div key={i} className="mt-8">
                <FormulaireDemo langue={langue} />
              </div>
            );
          default:
            return <Fragment key={i} />;
        }
      })}
    </>
  );
}

function EnTete({ langue, page }: { langue: LangueSite; page: PageSite }) {
  const ui = INTERFACE[langue];
  const { session } = useAuth();
  const autre: LangueSite = langue === "fr" ? "nl" : "fr";
  const alt = alternatives(page.cle);
  const lien = "text-sm font-medium text-slate-200 hover:text-white";
  return (
    <header className="z-30 bg-[#0F2A43] sm:sticky sm:top-0">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <a href={urlPage(langue, "")} aria-label={ui.accueil}>
          <ZidarProLogo variante="sombre" taille="text-lg" />
        </a>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label={ui.nav.fonctions}>
          <a
            href={`${urlPage(langue, "")}#${langue === "fr" ? "fonctionnalites" : "functies"}`}
            className={lien}
          >
            {ui.nav.fonctions}
          </a>
          <a href={urlDe(langue, "tarifs")} className={lien}>
            {ui.nav.tarifs}
          </a>
          <a href={urlDe(langue, "guides")} className={lien}>
            {ui.nav.guides}
          </a>
          <a href={urlDe(langue, "faq")} className={lien}>
            {ui.nav.faq}
          </a>
          <a
            href={alt[autre] ?? urlPage(autre, "")}
            hrefLang={`${autre}-BE`}
            lang={autre}
            className={lien}
          >
            {ui.autreLangue}
          </a>
          <a href={session ? "/dashboard" : "/login"} className={lien}>
            {session ? ui.ouvrirApp : ui.nav.connexion}
          </a>
          <BoutonDemo langue={langue} clair />
        </nav>
      </div>
    </header>
  );
}

function PiedDePage({ langue }: { langue: LangueSite }) {
  const ui = INTERFACE[langue];
  const fonctions = ["f-30bis", "f-conformite", "f-devis", "f-chantiers"];
  const ressources = ["guides", "g-verifier", "g-tva6", "g-retenue", "faq"];
  const col = (titre: string, cles: string[]) => (
    <div>
      <p className="text-sm font-semibold text-white">{titre}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {cles.map((c) => {
          const p = pageParCle(langue, c);
          return p ? (
            <li key={c}>
              <a href={urlPage(langue, p.chemin)} className="text-slate-300 hover:text-white">
                {p.h1}
              </a>
            </li>
          ) : null;
        })}
      </ul>
    </div>
  );
  return (
    <footer className="mt-16 bg-[#0F2A43] text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <ZidarProLogo variante="sombre" taille="text-lg" />
          <p className="mt-3 text-sm">{ui.piedTexte}</p>
        </div>
        {col(ui.piedFonctions, fonctions)}
        {col(ui.piedRessources, ressources)}
        {col(ui.piedLegal, ["tarifs", "demo", "legal"])}
      </div>
    </footer>
  );
}

/** Page complète du site vitrine. */
export function PageVitrine({ langue, page }: { langue: LangueSite; page: PageSite }) {
  const ui = INTERFACE[langue];
  const parents = (page.parents ?? [])
    .map((c) => pageParCle(langue, c))
    .filter((p): p is PageSite => !!p);
  const accueil = page.type === "accueil";
  return (
    <div lang={langue} className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <EnTete langue={langue} page={page} />
      <main className="mx-auto max-w-3xl px-4 py-10">
        {parents.length > 0 && (
          <nav aria-label={ui.ariane} className="mb-6 text-sm text-slate-500">
            {parents.map((p) => (
              <span key={p.cle}>
                <a
                  href={urlPage(langue, p.chemin)}
                  className="hover:text-[#0F2A43] hover:underline"
                >
                  {p.type === "accueil" ? ui.accueil : p.h1}
                </a>
                <span aria-hidden="true"> / </span>
              </span>
            ))}
          </nav>
        )}
        <h1
          className={`font-extrabold tracking-tight text-[#0F2A43] ${accueil ? "text-4xl sm:text-5xl" : "text-3xl sm:text-4xl"}`}
        >
          {page.h1}
        </h1>
        {page.chapo && <p className="mt-4 text-lg leading-relaxed text-slate-600">{page.chapo}</p>}
        {page.type === "legal" ? (
          <MentionsLegales langue={langue} />
        ) : (
          <Blocs blocs={page.blocs} langue={langue} />
        )}
        {page.type === "guide" && (
          <p className="mt-8 text-xs text-slate-500">
            {ui.majLe} {dateBE(page.majLe)}
          </p>
        )}
      </main>
      <PiedDePage langue={langue} />
    </div>
  );
}

function MentionsLegales({ langue }: { langue: LangueSite }) {
  const l = INTERFACE[langue].legal;
  if (!EDITEUR) return <p className="mt-6 text-slate-700">{l.enAttente}</p>;
  const lignes: [string, string][] = [
    [l.editeur, EDITEUR.nom],
    [l.adresse, EDITEUR.adresse],
    [l.bce, EDITEUR.bce],
    [l.contact, EDITEUR.email],
  ];
  return (
    <dl className="mt-6 grid gap-3 sm:grid-cols-[200px_1fr]">
      {lignes.map(([k, v]) => (
        <Fragment key={k}>
          <dt className="font-semibold text-slate-900">{k}</dt>
          <dd className="text-slate-700">{v}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

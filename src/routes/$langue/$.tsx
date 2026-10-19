import { createFileRoute, notFound } from "@tanstack/react-router";
import { PageVitrine } from "@/components/site/SiteVitrine";
import { estLangueSite, trouverPage } from "@/site/registre";
import { headPage } from "@/site/seo";
import type { LangueSite } from "@/site/types";

/** Pages du site vitrine : /fr/... et /nl/... (fonctions, tarifs, FAQ, guides, démo). */
export const Route = createFileRoute("/$langue/$")({
  loader: ({ params }) => {
    if (!estLangueSite(params.langue)) throw notFound();
    const chemin = params._splat ?? "";
    if (!trouverPage(params.langue, chemin)) throw notFound();
    return { langue: params.langue as LangueSite, chemin };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const page = trouverPage(loaderData.langue, loaderData.chemin);
    return page ? headPage(page, loaderData.langue) : {};
  },
  component: PageSite,
});

function PageSite() {
  const { langue, chemin } = Route.useLoaderData();
  return <PageVitrine langue={langue} page={trouverPage(langue, chemin)!} />;
}

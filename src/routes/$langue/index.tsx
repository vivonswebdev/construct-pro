import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { PageVitrine } from "@/components/site/SiteVitrine";
import { estLangueSite, pageParCle } from "@/site/registre";
import { headPage } from "@/site/seo";

/** Accueil du site vitrine dans une langue : /nl (le français est servi à la racine « / »). */
export const Route = createFileRoute("/$langue/")({
  beforeLoad: ({ params }) => {
    if (params.langue === "fr") throw redirect({ to: "/", statusCode: 301 });
    if (!estLangueSite(params.langue)) throw notFound();
  },
  loader: ({ params }) => ({ langue: params.langue as "nl" }),
  head: ({ loaderData }) => {
    const langue = loaderData?.langue ?? "nl";
    return headPage(pageParCle(langue, "accueil")!, langue);
  },
  component: AccueilLangue,
});

function AccueilLangue() {
  const { langue } = Route.useLoaderData();
  return <PageVitrine langue={langue} page={pageParCle(langue, "accueil")!} />;
}

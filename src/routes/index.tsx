import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { PageVitrine } from "@/components/site/SiteVitrine";
import { useAuth } from "@/lib/auth";
import { pageParCle } from "@/site/registre";
import { headPage } from "@/site/seo";

/**
 * Accueil public (site vitrine, français) rendu côté serveur : c'est ce que voient Google et
 * les visiteurs. Un utilisateur déjà connecté est renvoyé vers son tableau de bord, comme avant.
 */
const accueil = pageParCle("fr", "accueil")!;

export const Route = createFileRoute("/")({
  head: () => headPage(accueil, "fr"),
  component: Index,
});

function Index() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [session, loading, navigate]);
  return <PageVitrine langue="fr" page={accueil} />;
}

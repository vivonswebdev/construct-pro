import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { chargerLogoPdf, urlLogo } from "@/lib/logo";
import { definirLogoPdf } from "@/lib/logo-pdf";

/**
 * Logo de la société courante : URL temporaire (bucket privé), ou null (logo par défaut).
 * `pourPdf` : précharge aussi l'image utilisée par les PDF (appelé une fois, dans la mise en page).
 */
export function useLogoEntreprise({ pourPdf = false }: { pourPdf?: boolean } = {}) {
  const { company } = useAuth();
  const chemin = company?.logo_chemin ?? null;
  const { data: url = null } = useQuery({
    queryKey: ["logo-entreprise", chemin],
    enabled: !!chemin,
    staleTime: 30 * 60 * 1000,
    queryFn: () => urlLogo(chemin!),
  });
  useEffect(() => {
    if (!pourPdf) return;
    let actif = true;
    if (!chemin || !url) definirLogoPdf(null);
    else void chargerLogoPdf(url).then((l) => actif && definirLogoPdf(l));
    return () => {
      actif = false;
    };
  }, [pourPdf, chemin, url]);
  return { chemin, url: chemin ? url : null };
}

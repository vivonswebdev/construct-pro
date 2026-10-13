import type { Bloc } from "@/lib/contrats/sous-traitance";

/** Rendu HTML du contrat (texte du document, dans la langue du modèle). */
export function ContratApercu({ blocs, className = "" }: { blocs: Bloc[]; className?: string }) {
  return (
    <article lang="fr" className={`space-y-2 text-[13px] leading-relaxed ${className}`}>
      {blocs.map((b, i) => {
        switch (b.k) {
          case "titre":
            return (
              <h2 key={i} className="text-center text-base font-bold">
                {b.t}
              </h2>
            );
          case "soustitre":
            return (
              <p key={i} className="pb-2 text-center text-xs text-muted-foreground">
                {b.t}
              </p>
            );
          case "h":
            return (
              <h3 key={i} className="pt-3 text-sm font-bold">
                {b.t}
              </h3>
            );
          case "p":
            return <p key={i}>{b.t}</p>;
          case "li":
            return (
              <p key={i} className="pl-4 -indent-3">
                • {b.t}
              </p>
            );
          case "check":
            return (
              <p key={i} className="pl-4">
                ☐ {b.t}
              </p>
            );
          case "ligne":
            return (
              <p key={i} className="pl-2">
                <span className="font-medium">{b.label} :</span> {b.valeur}
              </p>
            );
        }
      })}
    </article>
  );
}

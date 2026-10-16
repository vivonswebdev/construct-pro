import {
  BRIQUES,
  BRIQUES_ICONE,
  COULEURS_MARQUE,
  MARQUE_PARTIES,
  NOM_MARQUE,
  RAYON_ICONE,
  cheminSvg,
  couleurBrique,
  type VarianteMarque,
} from "@/lib/marque";

/** Symbole ZidarPro (Z en briques). `icone` : version simplifiée sur carré bleu (petites tailles). */
export function ZidarProSymbole({
  variante = "clair",
  icone = false,
  className = "h-8 w-8",
}: {
  variante?: VarianteMarque;
  icone?: boolean;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label={NOM_MARQUE}>
      {icone && <rect width="64" height="64" rx={RAYON_ICONE} fill={COULEURS_MARQUE.bleu} />}
      {(icone ? BRIQUES_ICONE : BRIQUES).map((b, i) => (
        <path key={i} d={cheminSvg(b)} fill={couleurBrique(b, icone ? "sombre" : variante)} />
      ))}
    </svg>
  );
}

/** Logo complet : symbole + « Zidar » (bleu ou blanc) « Pro » (orange), en Inter 800. */
export function ZidarProLogo({
  variante = "clair",
  className = "",
  taille = "text-xl",
}: {
  variante?: VarianteMarque;
  className?: string;
  taille?: string;
}) {
  const [zidar, pro] = MARQUE_PARTIES;
  return (
    <span className={`inline-flex items-center gap-[0.4em] ${taille} ${className}`}>
      <ZidarProSymbole variante={variante} className="h-[1.6em] w-[1.6em] shrink-0" />
      <span className="font-extrabold tracking-tight" aria-hidden="true">
        <span
          style={{ color: variante === "clair" ? COULEURS_MARQUE.bleu : COULEURS_MARQUE.blanc }}
        >
          {zidar}
        </span>
        <span style={{ color: COULEURS_MARQUE.orange }}>{pro}</span>
      </span>
    </span>
  );
}

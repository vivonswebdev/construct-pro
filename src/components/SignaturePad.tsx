import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Zone de signature manuscrite (souris, doigt, stylet). Renvoie une image PNG (data URL)
 * ou null tant que rien n'est tracé.
 */
export function SignaturePad({ onChange }: { onChange: (png: string | null) => void }) {
  const { t } = useTranslation("common");
  const canvas = useRef<HTMLCanvasElement>(null);
  const dessin = useRef(false);
  const [vide, setVide] = useState(true);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    // Résolution réelle de l'écran pour un trait net, fond blanc pour le PDF.
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dessin.current = true;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.1, p.y + 0.1);
    ctx.stroke();
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dessin.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const up = () => {
    if (!dessin.current) return;
    dessin.current = false;
    setVide(false);
    onChange(canvas.current?.toDataURL("image/png") ?? null);
  };

  const effacer = () => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.restore();
    setVide(true);
    onChange(null);
  };

  return (
    <div>
      <div className="relative">
        <canvas
          ref={canvas}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          aria-label={t("signature.area")}
          className="h-36 w-full cursor-crosshair touch-none rounded-lg border-2 border-dashed border-border bg-white"
        />
        {vide && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            {t("signature.hint")}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={effacer}
        className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Eraser className="h-3.5 w-3.5" /> {t("signature.clear")}
      </button>
    </div>
  );
}

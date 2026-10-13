import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { toast } from "sonner";
import { translateText } from "@/lib/traduction.functions";
import { isLangue } from "@/lib/i18n";

/**
 * Affiche un contenu saisi par un utilisateur, avec un bouton « Traduire » vers la langue de
 * l'interface et « Voir l'original » pour revenir au texte d'origine.
 */
export function TranslatableText({
  text,
  className = "",
}: {
  text: string | null | undefined;
  className?: string;
}) {
  const { t, i18n } = useTranslation("common");
  const translate = useServerFn(translateText);
  const [traduit, setTraduit] = useState<string | null>(null);
  const [voirTraduction, setVoirTraduction] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!text) return null;

  const onTranslate = async () => {
    if (traduit) {
      setVoirTraduction(true);
      return;
    }
    setLoading(true);
    try {
      const langueCible = isLangue(i18n.language) ? i18n.language : "fr";
      const res = await translate({ data: { texte: text, langueCible } });
      if (!res.ok) {
        toast.error(t("translation.failed"));
        return;
      }
      setTraduit(res.texte);
      setVoirTraduction(true);
    } catch {
      toast.error(t("translation.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      <p className="whitespace-pre-wrap">{voirTraduction && traduit ? traduit : text}</p>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
        {voirTraduction && traduit ? (
          <>
            <span className="italic">{t("translation.translatedFrom")}</span>
            <button
              type="button"
              onClick={() => setVoirTraduction(false)}
              className="font-semibold text-primary hover:underline"
            >
              {t("actions.showOriginal")}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onTranslate}
            disabled={loading}
            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline disabled:opacity-50"
          >
            <Languages className="h-3 w-3" />
            {loading ? t("actions.translating") : t("actions.translate")}
          </button>
        )}
      </div>
    </div>
  );
}

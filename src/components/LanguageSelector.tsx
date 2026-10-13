import { useTranslation } from "react-i18next";
import { LANGUES, isLangue } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

/** Sélecteur de langue de l'interface (drapeau + nom natif). */
export function LanguageSelector({ className = "" }: { className?: string }) {
  const { t, i18n } = useTranslation("nav");
  const { setLangue } = useAuth();
  return (
    <select
      aria-label={t("language")}
      title={t("language")}
      value={i18n.language}
      onChange={(e) => {
        if (isLangue(e.target.value)) void setLangue(e.target.value);
      }}
      className={className}
    >
      {LANGUES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.flag} {l.label}
        </option>
      ))}
    </select>
  );
}

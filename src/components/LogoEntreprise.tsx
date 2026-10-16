import { useLogoEntreprise } from "@/hooks/useLogoEntreprise";
import { useAuth } from "@/lib/auth";
import { avatarColor, initials } from "@/lib/format";
import { useTranslation } from "react-i18next";

/** Logo de la société ; à défaut, ses initiales sur fond de couleur (logo par défaut). */
export function LogoEntreprise({ className = "h-16 w-16" }: { className?: string }) {
  const { t } = useTranslation("profil");
  const { company } = useAuth();
  const { url } = useLogoEntreprise();
  const nom = company?.name ?? "";
  return url ? (
    <img
      src={url}
      alt={t("logo.alt", { company: nom })}
      className={`${className} rounded-lg border border-border bg-white object-contain p-1`}
    />
  ) : (
    <div
      role="img"
      aria-label={t("logo.defaultAlt")}
      className={`${className} flex items-center justify-center rounded-lg text-lg font-bold text-white ${avatarColor(nom || "?")}`}
    >
      {initials(nom || "?")}
    </div>
  );
}

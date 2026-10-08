import i18n from "@/lib/i18n";
import type common from "@/locales/fr/common.json";

type PageKey = keyof (typeof common)["pages"];

/** Balises <head> d'une page (titre + description), traduites (français au rendu serveur). */
export function pageHead(page: PageKey) {
  const title = `${i18n.t(`common:pages.${page}.title`)} — ${i18n.t("common:appName")}`;
  const description = i18n.t(`common:pages.${page}.description`);
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}

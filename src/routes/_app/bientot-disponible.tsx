import { createFileRoute } from "@tanstack/react-router";
import {
  Bell,
  CalendarClock,
  ClipboardCheck,
  FileSignature,
  Fingerprint,
  Globe,
  Languages,
  Leaf,
  Receipt,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Star,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { pageHead } from "@/lib/head";
import { useTranslation } from "react-i18next";

/** Fonctionnalités à venir : annoncées sans date. Page hors menu (profil, tableau de bord). */
export const Route = createFileRoute("/_app/bientot-disponible")({
  head: () => pageHead("comingSoon"),
  component: BientotPage,
});

const PRINCIPALES: [string, LucideIcon][] = [
  ["achats", ShoppingCart],
  ["facturation", Receipt],
  ["itsme", Fingerprint],
  ["ficheChantier", FileSignature],
  ["contratNlEn", Languages],
];
const AUTRES: [string, LucideIcon][] = [
  ["siteWeb", Globe],
  ["avis", Star],
  ["emails", Bell],
  ["planning", CalendarClock],
  ["journalMobile", Smartphone],
  ["materiel", Truck],
  ["primes", Leaf],
  ["rapport", ClipboardCheck],
];

function BientotPage() {
  const { t } = useTranslation("bientot");
  const carte = ([cle, Icone]: [string, LucideIcon]) => (
    <div key={cle} className="flex gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icone className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{t(`items.${cle}.title` as "items.achats.title")}</h3>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
            {t("badge")}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(`items.${cle}.description` as "items.achats.description")}
        </p>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Sparkles className="h-6 w-6 text-primary" /> {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">{PRINCIPALES.map(carte)}</div>
      <h2 className="pt-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t("others")}
      </h2>
      <div className="grid gap-3 md:grid-cols-2">{AUTRES.map(carte)}</div>
      <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>
    </div>
  );
}

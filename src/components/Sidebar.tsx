import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  HardHat,
  Users,
  Truck,
  FileText,
  Package,
  Calculator,
  LogOut,
  UserCircle,
  ShieldCheck,
  Landmark,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { initials } from "@/lib/format";

const ACTIVE_NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/chantiers", label: "Chantiers", icon: HardHat },
  { to: "/personnel", label: "Personnel", icon: Users },
  { to: "/vehicules", label: "Véhicules", icon: Truck },
  { to: "/stock", label: "Stock", icon: Package },
  { to: "/facturation", label: "Devis & Factures", icon: FileText },
  { to: "/conformite-tva", label: "Conformité TVA", icon: ShieldCheck },
  { to: "/precompte", label: "Précompte & ONSS", icon: Landmark },
  { to: "/profil", label: "Mon profil", icon: UserCircle },
] as const;

const COMING_SOON = [
  { key: "belcotax", label: "Belcotax", icon: Calculator },
] as const;

export function Sidebar() {
  const { profile, company, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [csModal, setCsModal] = useState<string | null>(null);

  const isActive = (to: string) =>
    pathname === to || (to !== "/dashboard" && pathname.startsWith(to));

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-sidebar-bg text-sidebar-text">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-white">
            CF
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold text-white">ConstructFlow</div>
            <div className="truncate text-xs text-sidebar-text">
              {company?.name ?? "—"}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-2">
          <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-text/60">
            Modules actifs
          </div>
          {ACTIVE_NAV.map((item) => {
            const active = isActive(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`mx-1 mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-primary text-white"
                    : "text-sidebar-text hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}

          <div className="mb-1 mt-5 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-text/60">
            Bientôt disponible
          </div>
          {COMING_SOON.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setCsModal(item.label)}
                className="mx-1 mb-1 flex w-[calc(100%-0.5rem)] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-text/70 transition hover:bg-white/5 hover:text-white"
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1 text-left">{item.label}</span>
                <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-sidebar-text">
                  Bientôt
                </span>
              </button>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-white/5 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
              {initials(profile?.full_name)}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-xs font-semibold text-white">
                {profile?.full_name ?? "Utilisateur"}
              </div>
              <div className="text-[11px] text-sidebar-text capitalize">
                {profile?.role ?? ""}
              </div>
            </div>
            <button
              onClick={signOut}
              className="rounded-md p-1.5 text-sidebar-text transition hover:bg-white/10 hover:text-white"
              title="Se déconnecter"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Coming-soon modal */}
      {csModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setCsModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card p-6 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">{csModal}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Ce module sera disponible dans la prochaine mise à jour.
            </p>
            <button
              onClick={() => setCsModal(null)}
              className="mt-5 w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </>
  );
}

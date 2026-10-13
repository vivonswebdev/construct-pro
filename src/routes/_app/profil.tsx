import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { User, Building2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { initials, avatarColor } from "@/lib/format";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/LanguageSelector";

export const Route = createFileRoute("/_app/profil")({
  component: ProfilPage,
});

function ProfilPage() {
  const { t } = useTranslation(["profil", "nav", "common"]);
  const { user, profile, company, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [bce, setBce] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
  }, [profile?.full_name]);

  useEffect(() => {
    if (!company?.id) return;
    supabase
      .from("companies")
      .select("name, address, bce_number, logo_url")
      .eq("id", company.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setCompanyName(data.name ?? "");
        setAddress(data.address ?? "");
        setBce(data.bce_number ?? "");
        setLogoUrl(data.logo_url ?? "");
      });
    // also fetch avatar for current profile
    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user!.id)
      .maybeSingle()
      .then(({ data }) => setAvatarUrl(data?.avatar_url ?? ""));
  }, [company?.id, user]);

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, avatar_url: avatarUrl || null })
      .eq("id", user.id);
    setSavingProfile(false);
    if (error) toast.error(error.message);
    else {
      toast.success(t("toasts.profileUpdated"));
      refreshProfile();
    }
  };

  const saveCompany = async () => {
    if (!company?.id) return;
    setSavingCompany(true);
    const { error } = await supabase
      .from("companies")
      .update({
        name: companyName,
        address: address || null,
        bce_number: bce || null,
        logo_url: logoUrl || null,
      })
      .eq("id", company.id);
    setSavingCompany(false);
    if (error) toast.error(error.message);
    else {
      toast.success(t("toasts.companyUpdated"));
      refreshProfile();
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">{t("personal")}</h2>
        </div>
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={t("avatarAlt")}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold text-white ${avatarColor(fullName || "?")}`}
            >
              {initials(fullName)}
            </div>
          )}
          <div className="text-sm text-muted-foreground">
            <div className="font-semibold text-foreground">{user?.email}</div>
            <div>
              {t("role", {
                role: profile?.role
                  ? t(`nav:roles.${profile.role}`, { defaultValue: profile.role })
                  : "—",
              })}
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-3">
          <Field label={t("fullName")}>
            <input
              className="pf-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </Field>
          <Field label={t("avatarUrl")}>
            <input
              className="pf-input"
              placeholder="https://..."
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
            />
          </Field>
          <Field label={t("language")}>
            <LanguageSelector className="pf-input" />
            <span className="mt-1 block text-xs text-muted-foreground">{t("languageHelp")}</span>
          </Field>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            onClick={saveProfile}
            disabled={savingProfile}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {savingProfile ? "…" : t("common:actions.save")}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">{t("company")}</h2>
        </div>
        <div className="grid gap-3">
          <Field label={t("companyName")}>
            <input
              className="pf-input"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </Field>
          <Field label={t("address")}>
            <input
              className="pf-input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("bce")}>
              <input
                className="pf-input"
                placeholder="BE 0123.456.789"
                value={bce}
                onChange={(e) => setBce(e.target.value)}
              />
            </Field>
            <Field label={t("logoUrl")}>
              <input
                className="pf-input"
                placeholder="https://..."
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />
            </Field>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            onClick={saveCompany}
            disabled={savingCompany}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {savingCompany ? "…" : t("common:actions.save")}
          </button>
        </div>
      </section>

      <style>{`.pf-input{width:100%;padding:.5rem .75rem;border:1px solid var(--color-border);border-radius:.5rem;font-size:.875rem;background:white;outline:none}.pf-input:focus{border-color:var(--color-primary);box-shadow:0 0 0 3px color-mix(in oklab,var(--color-primary) 20%,transparent)}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}

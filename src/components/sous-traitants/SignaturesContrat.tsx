import { Ban, Copy, FileDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { etatSignature, lienSignature, telechargerContratPDF } from "@/lib/contrats/signature";
import { formatDateBE } from "@/lib/format";
import { useTranslation } from "react-i18next";

const STYLES = {
  envoye: "bg-info/10 text-info",
  signe: "bg-emerald-100 text-emerald-700",
  annule: "bg-muted text-muted-foreground",
  expire: "bg-amber-100 text-amber-700",
} as const;

/** Demandes de signature d'un contrat : suivi, lien, annulation, PDF. */
export function SignaturesContrat({
  signatures,
  onChange,
}: {
  signatures: Tables<"contrat_signatures">[];
  onChange: () => void;
}) {
  const { t } = useTranslation(["contrats", "common"]);
  if (signatures.length === 0) return null;

  const annuler = async (id: string) => {
    if (!confirm(t("list.confirmCancel"))) return;
    const { error } = await supabase
      .from("contrat_signatures")
      .update({ statut: "annule" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("toasts.cancelled"));
    onChange();
  };

  return (
    <ul className="mt-2 space-y-1">
      {signatures.map((s) => {
        const etat = etatSignature(s);
        return (
          <li
            key={s.id}
            className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 px-3 py-1.5 text-xs"
          >
            <span className={`rounded-full px-2 py-0.5 font-semibold ${STYLES[etat]}`}>
              {t(`status.${etat}`)}
            </span>
            <span className="text-muted-foreground">
              {etat === "signe"
                ? t("list.signedBy", {
                    name: s.signataire_nom,
                    date: formatDateBE(s.signe_le),
                  })
                : s.consulte_le
                  ? t("list.viewed", { date: formatDateBE(s.consulte_le) })
                  : t("list.sentOn", { date: formatDateBE(s.created_at) })}
            </span>
            <span className="ml-auto flex gap-1">
              {etat === "envoye" && (
                <>
                  <IconBtn
                    label={t("send.copy")}
                    onClick={() =>
                      navigator.clipboard
                        .writeText(lienSignature(s.token))
                        .then(() => toast.success(t("send.copied")))
                    }
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </IconBtn>
                  <IconBtn label={t("list.cancel")} onClick={() => annuler(s.id)}>
                    <Ban className="h-3.5 w-3.5" />
                  </IconBtn>
                </>
              )}
              <IconBtn label={t("list.pdf")} onClick={() => telechargerContratPDF(s)}>
                <FileDown className="h-3.5 w-3.5" />
              </IconBtn>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded p-1 text-muted-foreground hover:bg-card hover:text-foreground"
    >
      {children}
    </button>
  );
}

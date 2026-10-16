import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { intlLocale } from "@/lib/i18n";

/** Back-office : date et heure courtes dans la langue de l'interface. */
export const dateHeure = (d: string | null) =>
  d ? new Date(d).toLocaleString(intlLocale(), { dateStyle: "short", timeStyle: "short" }) : "—";

/** Utilisateurs de la plateforme (admin_utilisateurs : e-mail et nom pour les démos seulement). */
export function useUtilisateurs() {
  return useQuery({
    queryKey: ["admin-utilisateurs"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_utilisateurs");
      if (error) throw error;
      return data;
    },
  });
}

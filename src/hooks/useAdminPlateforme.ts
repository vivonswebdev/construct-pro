import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/**
 * Administrateur de la plateforme ? Décidé EN BASE (est_admin_plateforme) ; l'interface ne fait
 * qu'afficher ou masquer. Les données restent protégées par la RLS.
 */
export function useAdminPlateforme() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["admin-plateforme", user?.id],
    enabled: !!user,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("est_admin_plateforme");
      if (error) return false; // migration pas encore appliquée : pas d'administration
      return data === true;
    },
  });
}

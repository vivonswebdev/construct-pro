import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LigneConformite } from "@/lib/conformite";

/** Conformité de tous les sous-traitants de la société (calculée en base). */
export function useConformite() {
  return useQuery({
    queryKey: ["conformite"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("conformite_sous_traitants");
      if (error) throw error;
      return new Map((data as LigneConformite[]).map((l) => [l.sous_traitant_id, l]));
    },
  });
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { aujourdhuiBruxelles } from "@/lib/sous-traitants";
import { tauxEnVigueur, type Parametres30bis } from "@/lib/retenue-30bis";

/** Taux de retenue 30bis / 402 CIR en vigueur à une date (aujourd'hui à Bruxelles par défaut). */
export function useParametres30bis(date: string = aujourdhuiBruxelles()) {
  const q = useQuery({
    queryKey: ["parametres_30bis"],
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parametres_30bis")
        .select("*")
        .order("date_debut", { ascending: false });
      if (error) throw error;
      return data as Parametres30bis[];
    },
  });
  return { ...q, taux: tauxEnVigueur(q.data, date) };
}

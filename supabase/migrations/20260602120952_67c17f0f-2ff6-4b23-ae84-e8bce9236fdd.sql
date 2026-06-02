-- Vehicules
CREATE TABLE public.vehicules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'Camionnette',
  brand text,
  model text,
  year integer,
  plate text NOT NULL,
  current_km integer NOT NULL DEFAULT 0,
  cost_per_km numeric NOT NULL DEFAULT 0,
  photo_url text,
  ct_date date,
  insurance_date date,
  maintenance_date date,
  status text NOT NULL DEFAULT 'Disponible',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicules TO authenticated;
GRANT ALL ON public.vehicules TO service_role;

ALTER TABLE public.vehicules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicules select" ON public.vehicules FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "vehicules insert" ON public.vehicules FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "vehicules update" ON public.vehicules FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "vehicules delete" ON public.vehicules FOR DELETE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

-- Affectations
CREATE TABLE public.vehicule_affectations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicule_id uuid NOT NULL,
  chantier_id uuid NOT NULL,
  start_date date,
  end_date date,
  start_km integer,
  end_km integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicule_affectations TO authenticated;
GRANT ALL ON public.vehicule_affectations TO service_role;

ALTER TABLE public.vehicule_affectations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "veh_aff select" ON public.vehicule_affectations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vehicules v WHERE v.id = vehicule_affectations.vehicule_id AND v.company_id = get_user_company_id(auth.uid())));
CREATE POLICY "veh_aff insert" ON public.vehicule_affectations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.vehicules v WHERE v.id = vehicule_affectations.vehicule_id AND v.company_id = get_user_company_id(auth.uid())));
CREATE POLICY "veh_aff update" ON public.vehicule_affectations FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vehicules v WHERE v.id = vehicule_affectations.vehicule_id AND v.company_id = get_user_company_id(auth.uid())));
CREATE POLICY "veh_aff delete" ON public.vehicule_affectations FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vehicules v WHERE v.id = vehicule_affectations.vehicule_id AND v.company_id = get_user_company_id(auth.uid())));

CREATE INDEX idx_veh_aff_vehicule ON public.vehicule_affectations(vehicule_id);
CREATE INDEX idx_veh_aff_chantier ON public.vehicule_affectations(chantier_id);
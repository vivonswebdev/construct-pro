
-- Companies
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  bce_number text UNIQUE,
  address text,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  full_name text,
  role text NOT NULL DEFAULT 'admin',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Chantiers
CREATE TABLE public.chantiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  client_name text,
  address text,
  budget numeric(12,2) DEFAULT 0,
  actual_costs numeric(12,2) DEFAULT 0,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'En attente',
  progress integer NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Etapes
CREATE TABLE public.etapes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id uuid NOT NULL REFERENCES public.chantiers(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'En attente',
  progress integer NOT NULL DEFAULT 0,
  start_date date,
  end_date date,
  notes text
);

-- Personnel
CREATE TABLE public.personnel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  nrn text,
  email text,
  phone text,
  contract_type text,
  hourly_rate numeric(8,2),
  photo_url text,
  status text NOT NULL DEFAULT 'Actif',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Presence
CREATE TABLE public.presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text NOT NULL,
  chantier_id uuid REFERENCES public.chantiers(id) ON DELETE SET NULL,
  hours numeric(4,1) DEFAULT 8,
  UNIQUE(personnel_id, date)
);

-- Affectations
CREATE TABLE public.affectations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  chantier_id uuid NOT NULL REFERENCES public.chantiers(id) ON DELETE CASCADE,
  start_date date,
  end_date date,
  role text
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chantiers TO authenticated;
GRANT ALL ON public.chantiers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.etapes TO authenticated;
GRANT ALL ON public.etapes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personnel TO authenticated;
GRANT ALL ON public.personnel TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presence TO authenticated;
GRANT ALL ON public.presence TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.affectations TO authenticated;
GRANT ALL ON public.affectations TO service_role;

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chantiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etapes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affectations ENABLE ROW LEVEL SECURITY;

-- Security definer function to get user's company
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = _user_id
$$;

-- RLS policies
CREATE POLICY "Users view own company" ON public.companies
  FOR SELECT TO authenticated USING (id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users update own company" ON public.companies
  FOR UPDATE TO authenticated USING (id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Chantiers
CREATE POLICY "Chantiers select" ON public.chantiers FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Chantiers insert" ON public.chantiers FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Chantiers update" ON public.chantiers FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Chantiers delete" ON public.chantiers FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Etapes (via chantier)
CREATE POLICY "Etapes select" ON public.etapes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chantiers c WHERE c.id = chantier_id AND c.company_id = public.get_user_company_id(auth.uid())));
CREATE POLICY "Etapes insert" ON public.etapes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.chantiers c WHERE c.id = chantier_id AND c.company_id = public.get_user_company_id(auth.uid())));
CREATE POLICY "Etapes update" ON public.etapes FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chantiers c WHERE c.id = chantier_id AND c.company_id = public.get_user_company_id(auth.uid())));
CREATE POLICY "Etapes delete" ON public.etapes FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chantiers c WHERE c.id = chantier_id AND c.company_id = public.get_user_company_id(auth.uid())));

-- Personnel
CREATE POLICY "Personnel select" ON public.personnel FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Personnel insert" ON public.personnel FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Personnel update" ON public.personnel FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Personnel delete" ON public.personnel FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Presence (via personnel)
CREATE POLICY "Presence select" ON public.presence FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.personnel p WHERE p.id = personnel_id AND p.company_id = public.get_user_company_id(auth.uid())));
CREATE POLICY "Presence insert" ON public.presence FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.personnel p WHERE p.id = personnel_id AND p.company_id = public.get_user_company_id(auth.uid())));
CREATE POLICY "Presence update" ON public.presence FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.personnel p WHERE p.id = personnel_id AND p.company_id = public.get_user_company_id(auth.uid())));
CREATE POLICY "Presence delete" ON public.presence FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.personnel p WHERE p.id = personnel_id AND p.company_id = public.get_user_company_id(auth.uid())));

-- Affectations
CREATE POLICY "Affectations select" ON public.affectations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.personnel p WHERE p.id = personnel_id AND p.company_id = public.get_user_company_id(auth.uid())));
CREATE POLICY "Affectations insert" ON public.affectations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.personnel p WHERE p.id = personnel_id AND p.company_id = public.get_user_company_id(auth.uid())));
CREATE POLICY "Affectations update" ON public.affectations FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.personnel p WHERE p.id = personnel_id AND p.company_id = public.get_user_company_id(auth.uid())));
CREATE POLICY "Affectations delete" ON public.affectations FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.personnel p WHERE p.id = personnel_id AND p.company_id = public.get_user_company_id(auth.uid())));

-- Auto-create company + profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id uuid;
  company_name_val text;
  full_name_val text;
BEGIN
  company_name_val := COALESCE(NEW.raw_user_meta_data->>'company_name', 'Mon entreprise');
  full_name_val := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

  INSERT INTO public.companies (name) VALUES (company_name_val)
  RETURNING id INTO new_company_id;

  INSERT INTO public.profiles (id, company_id, full_name, role)
  VALUES (NEW.id, new_company_id, full_name_val, 'admin');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

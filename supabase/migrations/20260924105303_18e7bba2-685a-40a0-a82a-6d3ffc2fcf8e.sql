ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS demo_seeded boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.seed_lock(_company_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r uuid;
BEGIN
  UPDATE public.companies SET demo_seeded = true
  WHERE id = _company_id AND demo_seeded = false
    AND id = public.get_user_company_id(auth.uid())
  RETURNING id INTO r;
  RETURN r;
END $$;
REVOKE EXECUTE ON FUNCTION public.seed_lock(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.seed_lock(uuid) TO authenticated;

CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'particulier' CHECK (type IN ('particulier','entreprise')),
  nom text,
  prenom text,
  raison_sociale text,
  numero_bce text,
  numero_tva text,
  assujetti_tva boolean NOT NULL DEFAULT false,
  adresse text,
  code_postal text,
  ville text,
  email text,
  telephone text,
  langue text NOT NULL DEFAULT 'FR' CHECK (langue IN ('FR','NL')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_select" ON public.clients FOR SELECT TO authenticated USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "clients_insert" ON public.clients FOR INSERT TO authenticated WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "clients_update" ON public.clients FOR UPDATE TO authenticated USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "clients_delete" ON public.clients FOR DELETE TO authenticated USING (company_id = public.get_user_company_id(auth.uid()));
CREATE INDEX idx_clients_company ON public.clients(company_id);

ALTER TABLE public.chantiers ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.factures ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.factures ADD COLUMN IF NOT EXISTS valid_until date;
ALTER TABLE public.factures ADD COLUMN IF NOT EXISTS autoliquidation boolean NOT NULL DEFAULT false;
ALTER TABLE public.factures ADD COLUMN IF NOT EXISTS attestation_6 boolean NOT NULL DEFAULT false;
ALTER TABLE public.facture_lignes ADD COLUMN IF NOT EXISTS vat_rate numeric NOT NULL DEFAULT 21;
CREATE INDEX IF NOT EXISTS idx_chantiers_client ON public.chantiers(client_id);
CREATE INDEX IF NOT EXISTS idx_factures_client ON public.factures(client_id);
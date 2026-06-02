
CREATE TABLE public.factures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  chantier_id uuid,
  type text NOT NULL DEFAULT 'facture',
  number text NOT NULL,
  client_name text NOT NULL,
  client_vat text,
  client_address text,
  issue_date date NOT NULL DEFAULT current_date,
  due_date date,
  vat_rate numeric NOT NULL DEFAULT 21,
  subtotal_ht numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  total_ttc numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Brouillon',
  paid_date date,
  payment_reference text,
  notes text,
  conditions text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.factures TO authenticated;
GRANT ALL ON public.factures TO service_role;

ALTER TABLE public.factures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "factures select" ON public.factures FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "factures insert" ON public.factures FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "factures update" ON public.factures FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "factures delete" ON public.factures FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE TABLE public.facture_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id uuid NOT NULL,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total_ht numeric NOT NULL DEFAULT 0,
  order_index integer NOT NULL DEFAULT 0
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.facture_lignes TO authenticated;
GRANT ALL ON public.facture_lignes TO service_role;

ALTER TABLE public.facture_lignes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fl select" ON public.facture_lignes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.factures f WHERE f.id = facture_lignes.facture_id AND f.company_id = public.get_user_company_id(auth.uid())));
CREATE POLICY "fl insert" ON public.facture_lignes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.factures f WHERE f.id = facture_lignes.facture_id AND f.company_id = public.get_user_company_id(auth.uid())));
CREATE POLICY "fl update" ON public.facture_lignes FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.factures f WHERE f.id = facture_lignes.facture_id AND f.company_id = public.get_user_company_id(auth.uid())));
CREATE POLICY "fl delete" ON public.facture_lignes FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.factures f WHERE f.id = facture_lignes.facture_id AND f.company_id = public.get_user_company_id(auth.uid())));

CREATE INDEX idx_factures_company ON public.factures(company_id);
CREATE INDEX idx_factures_chantier ON public.factures(chantier_id);
CREATE INDEX idx_fl_facture ON public.facture_lignes(facture_id);


-- TVA checks
CREATE TABLE public.tva_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  client_name text NOT NULL,
  client_vat_number text NOT NULL,
  check_date timestamptz NOT NULL DEFAULT now(),
  is_eligible boolean,
  raw_response jsonb,
  checked_by uuid,
  notes text
);
CREATE INDEX idx_tva_checks_vat_date ON public.tva_checks(client_vat_number, check_date DESC);
CREATE INDEX idx_tva_checks_company ON public.tva_checks(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tva_checks TO authenticated;
GRANT ALL ON public.tva_checks TO service_role;

ALTER TABLE public.tva_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tva_checks select" ON public.tva_checks FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "tva_checks insert" ON public.tva_checks FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "tva_checks update" ON public.tva_checks FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "tva_checks delete" ON public.tva_checks FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Précompte payments
CREATE TABLE public.precompte_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  personnel_id uuid NOT NULL,
  period_month integer NOT NULL,
  period_year integer NOT NULL,
  amount numeric(10,2) DEFAULT 0,
  paid boolean DEFAULT false,
  paid_date date,
  due_date date,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(personnel_id, period_month, period_year)
);
CREATE INDEX idx_precompte_company ON public.precompte_payments(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.precompte_payments TO authenticated;
GRANT ALL ON public.precompte_payments TO service_role;
ALTER TABLE public.precompte_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "precompte select" ON public.precompte_payments FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "precompte insert" ON public.precompte_payments FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "precompte update" ON public.precompte_payments FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "precompte delete" ON public.precompte_payments FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

-- ONSS payments
CREATE TABLE public.onss_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  personnel_id uuid NOT NULL,
  quarter integer NOT NULL,
  year integer NOT NULL,
  amount numeric(10,2) DEFAULT 0,
  paid boolean DEFAULT false,
  paid_date date,
  due_date date,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(personnel_id, quarter, year)
);
CREATE INDEX idx_onss_company ON public.onss_payments(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onss_payments TO authenticated;
GRANT ALL ON public.onss_payments TO service_role;
ALTER TABLE public.onss_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onss select" ON public.onss_payments FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "onss insert" ON public.onss_payments FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "onss update" ON public.onss_payments FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "onss delete" ON public.onss_payments FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Salary payments
CREATE TABLE public.salary_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  personnel_id uuid NOT NULL,
  period_month integer NOT NULL,
  period_year integer NOT NULL,
  gross_amount numeric(10,2) DEFAULT 0,
  net_amount numeric(10,2) DEFAULT 0,
  paid boolean DEFAULT false,
  paid_date date,
  payment_method text DEFAULT 'Virement',
  reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(personnel_id, period_month, period_year)
);
CREATE INDEX idx_salary_company ON public.salary_payments(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_payments TO authenticated;
GRANT ALL ON public.salary_payments TO service_role;
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salary select" ON public.salary_payments FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "salary insert" ON public.salary_payments FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "salary update" ON public.salary_payments FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "salary delete" ON public.salary_payments FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

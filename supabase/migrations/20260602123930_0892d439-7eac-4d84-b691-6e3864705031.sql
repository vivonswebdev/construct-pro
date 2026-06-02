
-- Materials catalog
CREATE TABLE public.materiaux (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  sku text,
  category text,
  unit text NOT NULL DEFAULT 'pièce',
  unit_price numeric NOT NULL DEFAULT 0,
  stock_quantity numeric NOT NULL DEFAULT 0,
  min_stock numeric NOT NULL DEFAULT 0,
  supplier text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.materiaux TO authenticated;
GRANT ALL ON public.materiaux TO service_role;

ALTER TABLE public.materiaux ENABLE ROW LEVEL SECURITY;

CREATE POLICY "materiaux select" ON public.materiaux FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "materiaux insert" ON public.materiaux FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "materiaux update" ON public.materiaux FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "materiaux delete" ON public.materiaux FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Stock movements (achat, sortie, retour)
CREATE TABLE public.stock_mouvements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  materiau_id uuid NOT NULL,
  chantier_id uuid,
  type text NOT NULL DEFAULT 'achat', -- 'achat' | 'sortie' | 'retour'
  quantity numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  supplier text,
  reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_mouvements TO authenticated;
GRANT ALL ON public.stock_mouvements TO service_role;

ALTER TABLE public.stock_mouvements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sm select" ON public.stock_mouvements FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "sm insert" ON public.stock_mouvements FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "sm update" ON public.stock_mouvements FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "sm delete" ON public.stock_mouvements FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE INDEX idx_sm_chantier ON public.stock_mouvements(chantier_id);
CREATE INDEX idx_sm_materiau ON public.stock_mouvements(materiau_id);

-- Trigger to update stock quantities on mouvement changes
CREATE OR REPLACE FUNCTION public.apply_stock_mouvement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  delta numeric := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'achat' OR NEW.type = 'retour' THEN delta := NEW.quantity;
    ELSIF NEW.type = 'sortie' THEN delta := -NEW.quantity;
    END IF;
    UPDATE public.materiaux SET stock_quantity = stock_quantity + delta WHERE id = NEW.materiau_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.type = 'achat' OR OLD.type = 'retour' THEN delta := -OLD.quantity;
    ELSIF OLD.type = 'sortie' THEN delta := OLD.quantity;
    END IF;
    UPDATE public.materiaux SET stock_quantity = stock_quantity + delta WHERE id = OLD.materiau_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_apply_stock_mouvement
AFTER INSERT OR DELETE ON public.stock_mouvements
FOR EACH ROW EXECUTE FUNCTION public.apply_stock_mouvement();

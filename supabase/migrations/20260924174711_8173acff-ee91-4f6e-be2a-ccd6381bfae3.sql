-- Phase 0 — Paramètres de société (taux et hypothèses de calcul, identité visuelle, banque).
-- Les taux sont INDICATIFS : ce sont des hypothèses de travail éditables, à valider par le
-- comptable / secrétariat social. Aucun composant ne doit coder ces valeurs en dur.

CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Taux sociaux / fiscaux indicatifs (fractions : 0.1307 = 13,07 %)
  taux_precompte numeric NOT NULL DEFAULT 0.18,
  taux_onss_personnel numeric NOT NULL DEFAULT 0.1307,
  taux_onss_patronal numeric NOT NULL DEFAULT 0.27,
  base_onss_ouvrier_pct numeric NOT NULL DEFAULT 108,  -- ouvriers : cotisations sur 108 % du brut
  taux_verifies_le date,

  -- Hypothèses de gestion
  marge_cible_pct numeric NOT NULL DEFAULT 15,
  coefficient_cout_charge numeric NOT NULL DEFAULT 1.8, -- coût horaire chargé = taux × coefficient
  heures_par_jour numeric NOT NULL DEFAULT 8,
  marge_intemperies_pct numeric NOT NULL DEFAULT 10,
  seuil_checkinatwork numeric NOT NULL DEFAULT 500000, -- € HTVA

  -- Identité et banque
  couleur text NOT NULL DEFAULT '#0891b2',
  iban text,
  bic text,

  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT company_settings_taux_chk CHECK (
    taux_precompte BETWEEN 0 AND 1 AND taux_onss_personnel BETWEEN 0 AND 1
    AND taux_onss_patronal BETWEEN 0 AND 1
  ),
  CONSTRAINT company_settings_couleur_chk CHECK (couleur ~ '^#[0-9a-fA-F]{6}$')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_settings_select" ON public.company_settings FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "company_settings_insert" ON public.company_settings FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "company_settings_update" ON public.company_settings FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "company_settings_delete" ON public.company_settings FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_company_settings_updated_at
BEFORE UPDATE ON public.company_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Une ligne de paramètres par société : créée automatiquement, et rétroactivement.
CREATE OR REPLACE FUNCTION public.create_company_settings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.company_settings (company_id) VALUES (NEW.id)
  ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_companies_create_settings
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.create_company_settings();

INSERT INTO public.company_settings (company_id)
SELECT id FROM public.companies
ON CONFLICT (company_id) DO NOTHING;
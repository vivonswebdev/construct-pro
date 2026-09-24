-- Phase 0 — Réconciliation : les taux ajoutés sur companies par la migration
-- 20260924173652 (precompte_rate, onss_employee_rate, onss_employer_rate) sont déplacés vers
-- company_settings, source unique des paramètres de société. companies reste l'identité.
-- Prérequis : 20260924130100_phase0_company_settings.sql appliquée.

INSERT INTO public.company_settings (company_id)
SELECT id FROM public.companies
ON CONFLICT (company_id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'precompte_rate'
  ) THEN
    UPDATE public.company_settings s
    SET taux_precompte = c.precompte_rate,
        taux_onss_personnel = c.onss_employee_rate,
        taux_onss_patronal = c.onss_employer_rate
    FROM public.companies c
    WHERE c.id = s.company_id;
  END IF;
END $$;

ALTER TABLE public.companies
  DROP COLUMN IF EXISTS precompte_rate,
  DROP COLUMN IF EXISTS onss_employee_rate,
  DROP COLUMN IF EXISTS onss_employer_rate;
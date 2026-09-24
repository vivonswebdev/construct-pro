ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS precompte_rate numeric NOT NULL DEFAULT 0.18;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS onss_employee_rate numeric NOT NULL DEFAULT 0.1307;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS onss_employer_rate numeric NOT NULL DEFAULT 0.27;
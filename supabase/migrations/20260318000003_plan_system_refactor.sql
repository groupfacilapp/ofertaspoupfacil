-- ============================================================
-- Migration: Plan system refactor
-- - Re-seeds planos_sistema with trial, basico, profissional, premium
-- - Adds plan_id FK to user_plans (replaces bare text slug)
-- - Updates handle_new_user_plan trigger to set plan_id + 7-day trial
-- ============================================================

-- Step 1: Truncate and re-seed planos_sistema with real plans
TRUNCATE public.planos_sistema RESTART IDENTITY;

INSERT INTO public.planos_sistema
  (slug, nome, descricao, valor, tipo_periodo, link_checkout, recursos, destaque, ordem_exibicao)
VALUES
  (
    'trial',
    'Teste Gratuito',
    'Experimente por 7 dias sem cartão',
    0,
    'free',
    '',
    '["1 grupo de disparo","1 marketplace","10 disparos por dia","Acesso completo ao dashboard"]',
    false,
    1
  ),
  (
    'basico',
    'Básico',
    'Para testar o método',
    69.90,
    'mensal',
    '',
    '["Até 3 Grupos (1 conexão WhatsApp)","Até 3 Marketplaces","50 disparos por dia","Envio Automático de Ofertas","Mensagens em Massa","IA para Copies","Suporte por WhatsApp"]',
    false,
    2
  ),
  (
    'profissional',
    'Profissional',
    'Escale suas comissões com automação',
    99.90,
    'mensal',
    '',
    '["Até 10 Grupos (1 conexão WhatsApp)","Até 4 Marketplaces","Disparos ilimitados","Tudo do Básico +","Bot de Boas-Vindas","Rastreamento de Links","Espelhamento de Grupos","Reviews de Produtos com IA","Cupons Mercado Livre","Suporte por WhatsApp"]',
    true,
    3
  ),
  (
    'premium',
    'Premium',
    'Máxima escala com tudo incluso',
    129.90,
    'mensal',
    '',
    '["+de 20 Grupos (1 conexão WhatsApp)","Todos os Marketplaces","Disparos ilimitados","Tudo do Profissional incluso","Landing Page Exclusiva","Instagram Flow","UGC com IA","Reaja e Receba","Acesso antecipado a novidades","Suporte Prioritário"]',
    false,
    4
  );

-- Step 2: Drop old CHECK constraint on user_plans.plan
ALTER TABLE public.user_plans
  DROP CONSTRAINT IF EXISTS user_plans_plan_check;

-- Step 3: Add plan_id FK column (nullable until we populate it)
ALTER TABLE public.user_plans
  ADD COLUMN IF NOT EXISTS plan_id INTEGER REFERENCES public.planos_sistema(id);

-- Step 4: Migrate existing text slugs
--   old 'pro'  → new 'profissional'
--   old 'free' → new 'trial'
UPDATE public.user_plans SET plan = 'profissional' WHERE plan = 'pro';
UPDATE public.user_plans SET plan = 'trial' WHERE plan = 'free' OR plan IS NULL;

-- Step 5: Add new CHECK constraint
ALTER TABLE public.user_plans
  ADD CONSTRAINT user_plans_plan_check
  CHECK (plan IN ('trial', 'basico', 'profissional', 'premium'));

-- Step 6: Populate plan_id from slug match
UPDATE public.user_plans up
  SET plan_id = ps.id
  FROM public.planos_sistema ps
  WHERE ps.slug = up.plan;

-- Step 7: Set plan_expires_at for trial users who don't have one
UPDATE public.user_plans
  SET plan_expires_at = created_at + INTERVAL '7 days'
  WHERE plan = 'trial' AND plan_expires_at IS NULL;

-- Step 8: Make plan_id NOT NULL
ALTER TABLE public.user_plans
  ALTER COLUMN plan_id SET NOT NULL;

-- Step 9: Update trigger so new signups get trial plan + 7-day expiry
CREATE OR REPLACE FUNCTION public.handle_new_user_plan()
RETURNS trigger AS $$
DECLARE
  trial_plan_id INTEGER;
BEGIN
  SELECT id INTO trial_plan_id
    FROM public.planos_sistema
    WHERE slug = 'trial'
    LIMIT 1;

  INSERT INTO public.user_plans
    (user_id, plan, plan_id, plan_started_at, plan_expires_at)
  VALUES
    (new.id, 'trial', trial_plan_id, now(), now() + INTERVAL '7 days');

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

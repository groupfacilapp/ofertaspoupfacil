-- ============================================================
-- Migration: DB-driven plan limits
-- Moves plan limits from hardcoded TypeScript into planos_sistema.
-- Adds annual plan support via periodo_dias column.
-- ============================================================

-- 1. Add limit + period columns to planos_sistema
ALTER TABLE public.planos_sistema
  ADD COLUMN IF NOT EXISTS max_grupos            INTEGER,     -- NULL = ilimitado
  ADD COLUMN IF NOT EXISTS max_marketplaces      INTEGER,     -- NULL = ilimitado
  ADD COLUMN IF NOT EXISTS max_disparos_dia      INTEGER,     -- NULL = ilimitado
  ADD COLUMN IF NOT EXISTS max_destinos_grupo    INTEGER,     -- NULL = ilimitado
  ADD COLUMN IF NOT EXISTS periodo_dias          INTEGER,     -- dias até expirar (NULL = sem expiração)
  ADD COLUMN IF NOT EXISTS valor_mensal_equiv    NUMERIC(10,2); -- para planos anuais: valor por mês equivalente

-- 2. Populate limits for existing plans
UPDATE public.planos_sistema SET
  max_grupos = 1, max_marketplaces = 1, max_disparos_dia = 10, max_destinos_grupo = 1, periodo_dias = 7
  WHERE slug = 'trial';

UPDATE public.planos_sistema SET
  max_grupos = 3, max_marketplaces = 3, max_disparos_dia = 50, max_destinos_grupo = 1, periodo_dias = 30
  WHERE slug = 'basico';

UPDATE public.planos_sistema SET
  max_grupos = 10, max_marketplaces = 4, max_disparos_dia = NULL, max_destinos_grupo = NULL, periodo_dias = 30
  WHERE slug = 'profissional';

UPDATE public.planos_sistema SET
  max_grupos = NULL, max_marketplaces = 5, max_disparos_dia = NULL, max_destinos_grupo = NULL, periodo_dias = 30
  WHERE slug = 'premium';

-- 3. Add annual plan examples (mesma hierarquia, cobrado anualmente, desconto de ~20%)
INSERT INTO public.planos_sistema
  (slug, nome, descricao, valor, tipo_periodo, link_checkout, recursos, destaque,
   ordem_exibicao, max_grupos, max_marketplaces, max_disparos_dia, max_destinos_grupo,
   periodo_dias, valor_mensal_equiv)
VALUES
  (
    'basico_anual',
    'Básico Anual',
    'Para testar o método — melhor preço',
    699.00,   -- cobrado uma vez (12x R$58,25)
    'anual',
    '',
    '["Até 3 Grupos (1 conexão WhatsApp)","Até 3 Marketplaces","50 disparos por dia","Envio Automático de Ofertas","Mensagens em Massa","IA para Copies","Suporte por WhatsApp","2 meses grátis vs mensal"]',
    false,
    3,        -- aparece logo após basico mensal
    3, 3, 50, 1,
    365,
    58.25
  ),
  (
    'profissional_anual',
    'Profissional Anual',
    'Escale suas comissões — melhor custo-benefício',
    999.00,   -- cobrado uma vez (12x R$83,25)
    'anual',
    '',
    '["Até 10 Grupos (1 conexão WhatsApp)","Até 4 Marketplaces","Disparos ilimitados","Tudo do Básico +","Bot de Boas-Vindas","Rastreamento de Links","Espelhamento de Grupos","Reviews de Produtos com IA","Cupons Mercado Livre","Suporte por WhatsApp","2 meses grátis vs mensal"]',
    true,     -- destaque na aba anual
    5,
    10, 4, NULL, NULL,
    365,
    83.25
  ),
  (
    'premium_anual',
    'Premium Anual',
    'Máxima escala — preço de atacado',
    1299.00,  -- cobrado uma vez (12x R$108,25)
    'anual',
    '',
    '["+de 20 Grupos (1 conexão WhatsApp)","Todos os Marketplaces","Disparos ilimitados","Tudo do Profissional incluso","Landing Page Exclusiva","Instagram Flow","UGC com IA","Reaja e Receba","Acesso antecipado a novidades","Suporte Prioritário","2 meses grátis vs mensal"]',
    false,
    7,
    NULL, 5, NULL, NULL,
    365,
    108.25
  );

-- 4. Drop the hardcoded CHECK constraint on user_plans.plan
--    (plan_id FK is the authoritative reference now; plan TEXT is just a cached slug)
ALTER TABLE public.user_plans
  DROP CONSTRAINT IF EXISTS user_plans_plan_check;

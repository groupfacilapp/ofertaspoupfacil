-- =============================================================================
-- DISPARA-ZAP — Cron Job (pg_cron + Supabase Edge Functions)
--
-- Execute este arquivo NO SQL EDITOR do Supabase após rodar disparazap_structure.sql
--
-- COMO PREENCHER:
--   1. Substitua udlmqdwtisolgutzdylw pelo ID do seu projeto Supabase
--      (ex: yuypedritsizhuegslej — aparece na URL do dashboard)
--   2. Substitua 38cf3a475fdae9b063487d494d88aa6f pelo valor de CRON_SECRET no seu .env.local
--
-- IMPORTANTE: Os cron jobs chamam Supabase Edge Functions diretamente,
-- NÃO as rotas do Next.js/Vercel. Faça o deploy dessas Edge Functions usando a
-- flag --no-verify-jwt para garantir que o CRON_SECRET seja aceito.
-- =============================================================================

-- 1. Remove os jobs anteriores caso já existam (seguro para re-executar)
SELECT cron.unschedule('auto-automation-5m')       WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-automation-5m');
SELECT cron.unschedule('dz-worker-1m')             WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dz-worker-1m');
SELECT cron.unschedule('cleanup-expired-offers')   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-offers');
SELECT cron.unschedule('reset-daily-dispatch-count') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reset-daily-dispatch-count');

-- 2. Agenda o COORDENADOR (enfileira jobs de fetch e dispatch) a cada 5 minutos
SELECT cron.schedule(
    'auto-automation-5m',
    '*/5 * * * *',
    $$ SELECT net.http_post(
            url     := 'https://udlmqdwtisolgutzdylw.supabase.co/functions/v1/automation',
            headers := '{"Authorization": "Bearer 38cf3a475fdae9b063487d494d88aa6f", "Content-Type": "application/json"}'::jsonb,
            body    := '{}'::jsonb
       ); $$
);

-- 3. Agenda o WORKER (processa filas de dispatch e fetch) a cada 1 minuto
SELECT cron.schedule(
    'dz-worker-1m',
    '* * * * *',
    $$ SELECT net.http_post(
            url     := 'https://udlmqdwtisolgutzdylw.supabase.co/functions/v1/worker',
            headers := '{"Authorization": "Bearer 38cf3a475fdae9b063487d494d88aa6f", "Content-Type": "application/json"}'::jsonb,
            body    := '{}'::jsonb
       ); $$
);

-- 4. Cleanup: remove ofertas expiradas toda hora (1h de janela garante que dispatches em curso não sejam interrompidos)
SELECT cron.schedule(
    'cleanup-expired-offers',
    '0 * * * *',
    $$ DELETE FROM offers WHERE expires_at < NOW() - INTERVAL '1 hour'; $$
);

-- 5. Reset do contador de disparos diários (3h BRT = 6h UTC)
SELECT cron.schedule(
    'reset-daily-dispatch-count',
    '0 3 * * *',
    $$
      UPDATE public.user_plans
      SET daily_dispatch_count = 0,
          daily_dispatch_reset_at = CURRENT_DATE,
          updated_at = NOW()
      WHERE daily_dispatch_reset_at < CURRENT_DATE;
    $$
);

-- Confirma o agendamento
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname IN ('auto-automation-5m', 'dz-worker-1m', 'cleanup-expired-offers', 'reset-daily-dispatch-count');

-- Track fetch errors per marketplace connection so users can see health status
ALTER TABLE public.marketplace_connections
  ADD COLUMN IF NOT EXISTS last_fetch_error TEXT,
  ADD COLUMN IF NOT EXISTS last_fetch_error_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_fetch_success_at TIMESTAMPTZ;

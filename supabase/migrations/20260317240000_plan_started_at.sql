-- Add plan_started_at to track when a user activated their current plan
ALTER TABLE public.user_plans
  ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMPTZ;

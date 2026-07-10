-- automation_rules: per-user, per-marketplace automation config
CREATE TABLE public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  marketplace TEXT NOT NULL CHECK (marketplace IN ('amazon', 'mercadolivre', 'shopee', 'aliexpress')),
  rule_type TEXT NOT NULL CHECK (rule_type IN ('fetch', 'dispatch')),
  is_active BOOLEAN DEFAULT false,
  interval_minutes INT NOT NULL DEFAULT 60,
  start_hour INT NOT NULL DEFAULT 8 CHECK (start_hour >= 0 AND start_hour <= 23),
  end_hour INT NOT NULL DEFAULT 22 CHECK (end_hour >= 0 AND end_hour <= 23),
  target_group_id UUID REFERENCES public.dispatch_groups(id) ON DELETE SET NULL,
  last_run_at TIMESTAMPTZ,
  products_found_today INT DEFAULT 0,
  products_found_reset_at DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, marketplace, rule_type)
);

-- RLS
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own automation_rules" ON public.automation_rules
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Service role bypass
CREATE POLICY "Service role full access on automation_rules" ON public.automation_rules
  FOR ALL USING (current_setting('role') = 'service_role');

-- Indexes
CREATE INDEX idx_automation_rules_user ON automation_rules (user_id);
CREATE INDEX idx_automation_rules_active ON automation_rules (is_active, rule_type) WHERE is_active = true;

-- Add dispatched tracking index to dispatch_logs for date-range queries
CREATE INDEX IF NOT EXISTS idx_dispatch_logs_date ON dispatch_logs (dispatched_date, user_id);

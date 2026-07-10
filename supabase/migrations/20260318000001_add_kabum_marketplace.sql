-- Add 'kabum' to marketplace CHECK constraints

ALTER TABLE public.marketplace_connections
  DROP CONSTRAINT marketplace_connections_marketplace_check;

ALTER TABLE public.marketplace_connections
  ADD CONSTRAINT marketplace_connections_marketplace_check
  CHECK (marketplace IN ('amazon', 'mercadolivre', 'shopee', 'aliexpress', 'kabum'));

ALTER TABLE public.automation_rules
  DROP CONSTRAINT automation_rules_marketplace_check;

ALTER TABLE public.automation_rules
  ADD CONSTRAINT automation_rules_marketplace_check
  CHECK (marketplace IN ('amazon', 'mercadolivre', 'shopee', 'aliexpress', 'kabum'));

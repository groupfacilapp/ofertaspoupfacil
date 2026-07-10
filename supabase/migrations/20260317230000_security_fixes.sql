-- ============================================
-- Security fixes
-- ============================================

-- 1. Encrypt Evolution API key in platform_settings
-- Add encrypted_value column alongside value for sensitive keys
-- (value stays for non-sensitive settings like prefix, limits)

-- 2. Add webhook_secret to platform_settings for Evolution webhook auth
INSERT INTO public.platform_settings (key, value, description)
VALUES ('evolution_webhook_secret', '', 'Secret token para validar webhooks da Evolution API')
ON CONFLICT (key) DO NOTHING;

-- 3. RLS: ensure platform_settings is only accessible via service role
-- (already enabled, but make explicit: no user policies = service role only)
-- Verify no accidental policies exist
DO $$
BEGIN
  -- Drop any accidentally created user-facing policies on platform_settings
  DROP POLICY IF EXISTS "allow_read_platform_settings" ON public.platform_settings;
  DROP POLICY IF EXISTS "allow_all_platform_settings" ON public.platform_settings;
END $$;

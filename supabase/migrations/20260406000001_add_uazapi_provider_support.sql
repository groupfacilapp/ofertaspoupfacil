-- Add provider_token column to whatsapp_instances
-- Stores the per-instance token returned by UAZAPI on creation.
-- NULL for Evolution instances (which use a global apikey).
ALTER TABLE whatsapp_instances
  ADD COLUMN IF NOT EXISTS provider_token TEXT;

-- Add whatsapp_provider default to platform_settings
INSERT INTO platform_settings (key, value, updated_at)
VALUES ('whatsapp_provider', 'evolution', NOW())
ON CONFLICT (key) DO NOTHING;

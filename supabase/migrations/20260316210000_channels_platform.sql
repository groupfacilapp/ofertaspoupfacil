-- ============================================
-- platform_settings: admin configuration store
-- ============================================
CREATE TABLE public.platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- No user RLS — accessed only via service role (admin)
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Seed default settings
INSERT INTO public.platform_settings (key, value, description) VALUES
  ('evolution_api_url', '', 'URL base da Evolution API (ex: https://evo.seudominio.com)'),
  ('evolution_api_key', '', 'API Key global da Evolution API'),
  ('instance_prefix', 'dz', 'Prefixo para nomes de instâncias WhatsApp'),
  ('whatsapp_max_daily_messages', '50', 'Limite diário de mensagens por instância'),
  ('whatsapp_min_interval_seconds', '30', 'Intervalo mínimo entre mensagens em segundos')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- whatsapp_instances: per-user WhatsApp state
-- ============================================
CREATE TABLE public.whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  instance_name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected', 'qr_pending', 'connected', 'error')),
  phone_number TEXT,
  qr_code TEXT,
  qr_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_whatsapp_instance"
  ON public.whatsapp_instances FOR ALL
  USING (user_id = auth.uid());

CREATE INDEX idx_whatsapp_instances_status ON public.whatsapp_instances (status);

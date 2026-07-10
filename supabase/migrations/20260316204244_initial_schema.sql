-- ============================================
-- Table 1: users (extends auth.users)
-- ============================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, display_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Table 2: user_plans
-- ============================================
CREATE TABLE public.user_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  plan_expires_at TIMESTAMPTZ,
  daily_dispatch_count INT DEFAULT 0,
  daily_dispatch_reset_at DATE DEFAULT CURRENT_DATE,
  payment_provider_customer_id TEXT,
  payment_provider_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create user_plan on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_plan()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_plans (user_id)
  VALUES (new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_plan
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_plan();

-- ============================================
-- Table 3: marketplace_connections
-- ============================================
CREATE TABLE public.marketplace_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  marketplace TEXT NOT NULL CHECK (marketplace IN ('amazon', 'mercadolivre', 'shopee', 'aliexpress')),
  encrypted_credentials TEXT NOT NULL,
  is_valid BOOLEAN DEFAULT true,
  last_validated_at TIMESTAMPTZ,
  validation_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, marketplace)
);

-- ============================================
-- Table 4: channel_connections
-- ============================================
CREATE TABLE public.channel_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('whatsapp', 'telegram')),
  label TEXT NOT NULL,
  encrypted_config TEXT NOT NULL,
  is_connected BOOLEAN DEFAULT false,
  last_status_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Table 5: dispatch_groups
-- ============================================
CREATE TABLE public.dispatch_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  marketplaces TEXT[] NOT NULL DEFAULT '{}',
  categories TEXT[] DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}',
  min_discount INT DEFAULT 0,
  min_price INT,
  max_price INT,
  min_sales INT DEFAULT 0,
  daily_limit INT NOT NULL DEFAULT 10,
  messaging_interval_minutes INT NOT NULL DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  schedule_hours INT[] DEFAULT '{8,12,18}',
  template_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Table 6: group_destinations (many-to-many: groups <-> channels)
-- ============================================
CREATE TABLE public.group_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.dispatch_groups(id) ON DELETE CASCADE NOT NULL,
  channel_id UUID REFERENCES public.channel_connections(id) ON DELETE CASCADE NOT NULL,
  target_id TEXT NOT NULL,
  target_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (group_id, channel_id, target_id)
);

-- ============================================
-- Table 7: offers
-- ============================================
CREATE TABLE public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  marketplace TEXT NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  current_price INT NOT NULL,
  original_price INT,
  discount_percent INT,
  image_url TEXT,
  product_url TEXT NOT NULL,
  condition TEXT,
  installments TEXT,
  category TEXT,
  affiliate_link TEXT,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, marketplace, external_id)
);

-- ============================================
-- Table 8: dispatch_logs
-- ============================================
CREATE TABLE public.dispatch_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  group_id UUID REFERENCES public.dispatch_groups(id) NOT NULL,
  offer_id UUID REFERENCES public.offers(id) NOT NULL,
  channel_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  error_message TEXT,
  external_message_id TEXT,
  attempt_count INT DEFAULT 1,
  dispatched_at TIMESTAMPTZ DEFAULT now(),
  dispatched_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Indexes
-- ============================================
CREATE UNIQUE INDEX idx_dispatch_dedup
  ON dispatch_logs (group_id, offer_id, dispatched_date)
  WHERE status IN ('sent', 'pending', 'delivered', 'read');

CREATE INDEX idx_offers_user_marketplace ON offers (user_id, marketplace);
CREATE INDEX idx_offers_fetched_at ON offers (fetched_at);
CREATE INDEX idx_dispatch_logs_user ON dispatch_logs (user_id, dispatched_at DESC);
CREATE INDEX idx_dispatch_logs_group ON dispatch_logs (group_id, dispatched_at DESC);
CREATE INDEX idx_dispatch_groups_user_active ON dispatch_groups (user_id) WHERE is_active = true;
CREATE INDEX idx_channel_connections_user ON channel_connections (user_id);
CREATE INDEX idx_marketplace_connections_user ON marketplace_connections (user_id);

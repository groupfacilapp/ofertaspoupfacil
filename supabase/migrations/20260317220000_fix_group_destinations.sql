-- Drop the FK constraint on channel_id (we use whatsapp_instances now)
ALTER TABLE public.group_destinations DROP CONSTRAINT IF EXISTS group_destinations_channel_id_fkey;
ALTER TABLE public.group_destinations ALTER COLUMN channel_id DROP NOT NULL;

-- Drop unique constraint that includes channel_id (now nullable)
ALTER TABLE public.group_destinations DROP CONSTRAINT IF EXISTS group_destinations_group_id_channel_id_target_id_key;

-- Add new unique constraint without channel_id
ALTER TABLE public.group_destinations ADD CONSTRAINT group_destinations_group_id_target_id_key
  UNIQUE (group_id, target_id);

-- Add channel_type to distinguish WhatsApp vs Telegram
ALTER TABLE public.group_destinations ADD COLUMN IF NOT EXISTS channel_type TEXT NOT NULL DEFAULT 'whatsapp';

-- Add keywords array to dispatch_groups if not exists
ALTER TABLE public.dispatch_groups ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT '{}';
ALTER TABLE public.dispatch_groups ADD COLUMN IF NOT EXISTS blocked_keywords TEXT[] DEFAULT '{}';

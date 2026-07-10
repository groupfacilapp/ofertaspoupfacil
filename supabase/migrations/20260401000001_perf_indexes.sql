-- Performance indexes to reduce Disk IO on hot query paths.
-- All CREATE INDEX CONCURRENTLY so they don't lock tables.

-- 1. offers.expires_at: used in every dispatch call (.gt('expires_at', now()))
--    Without this, every dispatch does a full seq-scan of the offers table.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_offers_expires_at
  ON offers (expires_at);

-- 2. offers composite: (user_id, marketplace, expires_at) covers the main dispatch query fully.
--    Replaces the partial scan done by idx_offers_user_marketplace + expires_at filter.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_offers_user_mp_expires
  ON offers (user_id, marketplace, expires_at DESC);

-- 3. dispatch_logs(group_id, dispatched_date): used in 7-day dedup query.
--    Existing idx_dispatch_logs_group is on (group_id, dispatched_at DESC) — not dispatched_date.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dispatch_logs_group_date
  ON dispatch_logs (group_id, dispatched_date DESC);

-- 4. pg_trgm GIN index on offers.title: makes ilike '%keyword%' fast instead of seq scan.
--    Keyword groups use .or('title.ilike.%kw%,...') which is extremely expensive without this.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_offers_title_trgm
  ON offers USING GIN (title gin_trgm_ops);

-- 5. Partial index for ML offers with null affiliate_link (regeneration loop).
--    dispatch.ts iterates mlNullOffers on every call — index avoids full scan.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_offers_ml_null_affiliate
  ON offers (user_id, marketplace, fetched_at DESC)
  WHERE marketplace = 'mercadolivre' AND affiliate_link IS NULL;

-- 6. automation_rules: coordinator reads all active rules every 5 min.
--    idx_automation_rules_active already exists but include marketplace for filter push-down.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_automation_rules_active_mp
  ON automation_rules (marketplace, is_active)
  WHERE is_active = true;

-- Remove schedule_hours column from dispatch_groups.
-- This field was only used by the legacy /api/cron/dispatch route (midnight Vercel cron)
-- which has been replaced by the automation_rules system (/api/cron/automation via pg_cron).
ALTER TABLE dispatch_groups DROP COLUMN IF EXISTS schedule_hours;

-- Migration: allow multiple target groups per automation dispatch rule
-- Changes target_group_id (single FK) -> target_group_ids (UUID array)

ALTER TABLE public.automation_rules
  ADD COLUMN target_group_ids UUID[] NOT NULL DEFAULT '{}';

-- Migrate existing single group to the new array column
UPDATE public.automation_rules
  SET target_group_ids = ARRAY[target_group_id]
  WHERE target_group_id IS NOT NULL;

-- Drop old column (FK constraint drops automatically)
ALTER TABLE public.automation_rules
  DROP COLUMN target_group_id;

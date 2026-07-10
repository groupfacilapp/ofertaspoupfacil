-- Enable RLS on ALL user-facing tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_logs ENABLE ROW LEVEL SECURITY;

-- users: access own profile only (PK = id = auth.uid())
CREATE POLICY "users_own_profile" ON public.users
  FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- user_plans: access own plan only
CREATE POLICY "users_own_plan" ON public.user_plans
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- marketplace_connections: access own connections only
CREATE POLICY "users_own_marketplace_connections" ON public.marketplace_connections
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- channel_connections: access own channels only
CREATE POLICY "users_own_channel_connections" ON public.channel_connections
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- dispatch_groups: access own groups only
CREATE POLICY "users_own_dispatch_groups" ON public.dispatch_groups
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- group_destinations: access through group ownership
CREATE POLICY "users_own_group_destinations" ON public.group_destinations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.dispatch_groups
      WHERE dispatch_groups.id = group_destinations.group_id
      AND dispatch_groups.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dispatch_groups
      WHERE dispatch_groups.id = group_destinations.group_id
      AND dispatch_groups.user_id = auth.uid()
    )
  );

-- offers: access own offers only
CREATE POLICY "users_own_offers" ON public.offers
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- dispatch_logs: access own logs only
CREATE POLICY "users_own_dispatch_logs" ON public.dispatch_logs
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { DashboardShell } from '@/components/layout/DashboardShell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const displayName = (user?.user_metadata?.display_name as string | undefined) ?? null;
  const isAdmin = user?.app_metadata?.is_admin === true;

  const { data: planData } = await supabaseAdmin
    .from('user_plans')
    .select(`
      plan, plan_expires_at,
      planos_sistema ( nome )
    `)
    .eq('user_id', user.id)
    .single();

  const planSlug: string = planData?.plan ?? 'trial';
  const planExpiresAt: string | null = planData?.plan_expires_at ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const planLabel: string = (planData?.planos_sistema as any)?.nome ?? 'Teste Gratuito';

  const isExpired = planExpiresAt ? new Date(planExpiresAt) < new Date() : false;

  return (
    <DashboardShell
      isAdmin={isAdmin}
      userDisplayName={displayName}
      userEmail={user.email}
      userPlan={planSlug}
      planLabel={planLabel}
      planExpiresAt={planExpiresAt}
      isExpired={isExpired}
    >
      {children}
    </DashboardShell>
  );
}

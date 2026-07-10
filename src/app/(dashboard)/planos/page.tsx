export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getActivePlans } from '@/lib/plans';
import { PlanosClient } from './components/PlanosClient';

export default async function PlanosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [planData, allPlanos] = await Promise.all([
    supabaseAdmin
      .from('user_plans')
      .select('plan, plan_expires_at, planos_sistema ( nome )')
      .eq('user_id', user.id)
      .single(),
    getActivePlans(),
  ]);

  const currentPlan: string = planData.data?.plan ?? 'trial';
  const planExpiresAt: string | null = planData.data?.plan_expires_at ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const planLabel: string = (planData.data?.planos_sistema as any)?.nome ?? 'Teste Gratuito';
  const isExpired = planExpiresAt ? new Date(planExpiresAt) < new Date() : false;

  // Split plans by period
  const planosMensais = allPlanos.filter((p) => p.tipoPeriodo === 'mensal');
  const planosAnuais = allPlanos.filter((p) => p.tipoPeriodo === 'anual');

  return (
    <PlanosClient
      planosMensais={planosMensais}
      planosAnuais={planosAnuais}
      currentPlan={currentPlan}
      planLabel={planLabel}
      planExpiresAt={planExpiresAt}
      isExpired={isExpired}
    />
  );
}

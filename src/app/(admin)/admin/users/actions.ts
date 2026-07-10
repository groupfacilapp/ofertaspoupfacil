'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { setUserPlan, type PlanType } from '@/lib/plans';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.app_metadata?.is_admin) throw new Error('Não autorizado');
  return user;
}

export interface PlanOption {
  id: number;
  slug: string;
  nome: string;
  periodo_dias: number | null;
  ativo: boolean;
}

export async function adminGetAllPlans(): Promise<PlanOption[]> {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from('planos_sistema')
    .select('id, slug, nome, periodo_dias, ativo')
    .order('ordem_exibicao');
  return (data ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    nome: r.nome,
    periodo_dias: r.periodo_dias,
    ativo: r.ativo,
  }));
}

export async function adminUpdateUser(
  userId: string,
  updates: { display_name?: string; is_admin?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();

    if (updates.display_name !== undefined) {
      const { error } = await supabaseAdmin
        .from('users')
        .update({ display_name: updates.display_name, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) return { ok: false, error: error.message };
    }

    if (updates.is_admin !== undefined) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        app_metadata: { is_admin: updates.is_admin },
      });
      if (error) return { ok: false, error: error.message };
    }

    revalidatePath('/admin/users');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function adminSetPlan(
  userId: string,
  plan: PlanType,
  expiresAt: string | null
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    await setUserPlan(userId, plan, expiresAt);
    revalidatePath('/admin/users');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function adminListUsersWithPlans() {
  await requireAdmin();

  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
  const { data: plans } = await supabaseAdmin
    .from('user_plans')
    .select('user_id, plan, plan_started_at, plan_expires_at, daily_dispatch_count, daily_dispatch_reset_at, payment_provider_subscription_id');

  const planMap = new Map((plans ?? []).map((p) => [p.user_id, p]));

  return (users ?? []).map((u) => {
    const p = planMap.get(u.id);
    const today = new Date(Date.now() - 3 * 3600000).toISOString().split('T')[0];
    const isExpired = p?.plan_expires_at && new Date(p.plan_expires_at) < new Date();
    return {
      id: u.id,
      email: u.email ?? '',
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      is_admin: !!u.app_metadata?.is_admin,
      plan: (p?.plan ?? 'trial') as PlanType,
      plan_started_at: p?.plan_started_at ?? null,
      plan_expires_at: p?.plan_expires_at ?? null,
      plan_is_expired: !!isExpired,
      subscription_id: p?.payment_provider_subscription_id ?? null,
      daily_dispatch_count: p?.daily_dispatch_reset_at === today ? (p?.daily_dispatch_count ?? 0) : 0,
    };
  });
}

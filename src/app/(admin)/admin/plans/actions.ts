'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.app_metadata?.is_admin) throw new Error('Não autorizado');
}

export interface AdminPlanRow {
  id: number;
  slug: string;
  nome: string;
  descricao: string;
  valor: number;
  tipo_periodo: string;
  link_checkout: string;
  recursos: string[];
  ativo: boolean;
  destaque: boolean;
  ordem_exibicao: number;
  max_grupos: number | null;
  max_marketplaces: number | null;
  max_destinos_grupo: number | null;
  periodo_dias: number | null;
  valor_mensal_equiv: number | null;
  user_count: number;
}

export interface PlanFormData {
  slug: string;
  nome: string;
  descricao: string;
  valor: number;
  tipo_periodo: string;
  link_checkout: string;
  recursos: string[];
  ativo: boolean;
  destaque: boolean;
  ordem_exibicao: number;
  max_grupos: number | null;
  max_marketplaces: number | null;
  max_destinos_grupo: number | null;
  periodo_dias: number | null;
  valor_mensal_equiv: number | null;
}

export async function adminListPlans(): Promise<AdminPlanRow[]> {
  await requireAdmin();

  const [{ data: plans }, { data: planUsers }] = await Promise.all([
    supabaseAdmin.from('planos_sistema').select('*').order('ordem_exibicao'),
    supabaseAdmin.from('user_plans').select('plan_id'),
  ]);

  const countMap = new Map<number, number>();
  for (const row of planUsers ?? []) {
    countMap.set(row.plan_id, (countMap.get(row.plan_id) ?? 0) + 1);
  }

  return (plans ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    nome: row.nome,
    descricao: row.descricao ?? '',
    valor: Number(row.valor),
    tipo_periodo: row.tipo_periodo,
    link_checkout: row.link_checkout ?? '',
    recursos: Array.isArray(row.recursos) ? row.recursos : JSON.parse(row.recursos ?? '[]'),
    ativo: row.ativo,
    destaque: row.destaque,
    ordem_exibicao: row.ordem_exibicao,
    max_grupos: row.max_grupos,
    max_marketplaces: row.max_marketplaces,
    max_destinos_grupo: row.max_destinos_grupo,
    periodo_dias: row.periodo_dias,
    valor_mensal_equiv: row.valor_mensal_equiv ? Number(row.valor_mensal_equiv) : null,
    user_count: countMap.get(row.id) ?? 0,
  }));
}

export async function adminCreatePlan(
  data: PlanFormData
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const { error } = await supabaseAdmin.from('planos_sistema').insert({
      ...data,
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath('/admin/plans');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function adminUpdatePlan(
  id: number,
  data: Partial<PlanFormData>
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const { error } = await supabaseAdmin
      .from('planos_sistema')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return { ok: false, error: error.message };
    revalidatePath('/admin/plans');
    revalidatePath('/admin/users');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function adminDeletePlan(
  id: number
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const { count } = await supabaseAdmin
      .from('user_plans')
      .select('*', { count: 'exact', head: true })
      .eq('plan_id', id);
    if (count && count > 0) {
      return {
        ok: false,
        error: `${count} usuário(s) estão neste plano. Mova-os para outro plano antes de excluir.`,
      };
    }
    const { error } = await supabaseAdmin.from('planos_sistema').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    revalidatePath('/admin/plans');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

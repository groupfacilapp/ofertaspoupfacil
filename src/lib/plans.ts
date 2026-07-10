import { supabaseAdmin } from './supabase/admin';

// ─── Types ────────────────────────────────────────────────────────────────────

// PlanType is just the slug stored in user_plans.plan.
// Not restricted to a fixed union — new plans are added in the DB.
export type PlanType = string;

export interface PlanLimits {
  maxGroups: number;           // Infinity when DB value is NULL
  maxMarketplaces: number;
  maxDestinationsPerGroup: number;
}

export interface PlanRecord {
  id: number;
  slug: string;
  nome: string;
  descricao: string;
  valor: number;
  tipoPeriodo: string;         // 'free' | 'mensal' | 'anual' | ...
  periododias: number | null;  // days until expiry; null = no expiry
  linkCheckout: string;
  recursos: string[];
  destaque: boolean;
  ordemExibicao: number;
  valorMensalEquiv: number | null;
  limits: PlanLimits;
}

export interface UserPlanInfo {
  plan: PlanType;
  planId: number;
  planLabel: string;           // nome from planos_sistema
  planStartedAt: string | null;
  planExpiresAt: string | null;
  dailyDispatchCount: number;
  limits: PlanLimits;
  isExpired: boolean;
  daysRemaining: number | null; // null = no expiry
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nullToInfinity(v: number | null): number {
  return v === null || v === undefined ? Infinity : v;
}

function rowToLimits(row: {
  max_grupos: number | null;
  max_marketplaces: number | null;
  max_destinos_grupo: number | null;
}): PlanLimits {
  return {
    maxGroups: nullToInfinity(row.max_grupos),
    maxMarketplaces: nullToInfinity(row.max_marketplaces),
    maxDestinationsPerGroup: nullToInfinity(row.max_destinos_grupo),
  };
}

// ─── Fetch all active purchasable plans (for /planos page) ───────────────────

export async function getActivePlans(): Promise<PlanRecord[]> {
  const { data, error } = await supabaseAdmin
    .from('planos_sistema')
    .select('*')
    .eq('ativo', true)
    .neq('slug', 'trial')
    .order('ordem_exibicao');

  if (error) throw new Error(`getActivePlans: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    nome: row.nome,
    descricao: row.descricao,
    valor: row.valor,
    tipoPeriodo: row.tipo_periodo,
    periododias: row.periodo_dias ?? null,
    linkCheckout: row.link_checkout ?? '',
    recursos: Array.isArray(row.recursos) ? row.recursos : JSON.parse(row.recursos ?? '[]'),
    destaque: row.destaque ?? false,
    ordemExibicao: row.ordem_exibicao,
    valorMensalEquiv: row.valor_mensal_equiv ?? null,
    limits: rowToLimits(row),
  }));
}

// ─── Get user plan (with limits from DB) ─────────────────────────────────────

export async function getUserPlan(userId: string): Promise<UserPlanInfo> {
  // Join user_plans with planos_sistema to get limits in one query
  const { data } = await supabaseAdmin
    .from('user_plans')
    .select(`
      plan, plan_id, plan_started_at, plan_expires_at,
      daily_dispatch_count, daily_dispatch_reset_at,
      planos_sistema (
        nome,
        max_grupos, max_marketplaces, max_destinos_grupo
      )
    `)
    .eq('user_id', userId)
    .single();

  const plan: PlanType = data?.plan ?? 'trial';
  const planId: number = data?.plan_id ?? 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const planRow = data?.planos_sistema as any;
  const planLabel: string = planRow?.nome ?? plan;
  const planStartedAt: string | null = data?.plan_started_at ?? null;
  const planExpiresAt: string | null = data?.plan_expires_at ?? null;

  // Limits from DB (fallback to most restrictive if no join)
  const limits: PlanLimits = planRow
    ? rowToLimits(planRow)
    : { maxGroups: 1, maxMarketplaces: 1, maxDestinationsPerGroup: 1 };

  // Check expiry
  let isExpired = false;
  let daysRemaining: number | null = null;

  if (planExpiresAt) {
    const expiresDate = new Date(planExpiresAt);
    const now = new Date();
    isExpired = expiresDate < now;
    if (!isExpired) {
      daysRemaining = Math.ceil((expiresDate.getTime() - now.getTime()) / 86400000);
    }
  }

  // Reset daily count if it's a new day
  const resetDate = data?.daily_dispatch_reset_at;
  const today = new Date(Date.now() - 3 * 3600000).toISOString().split('T')[0];
  const dailyDispatchCount = resetDate !== today ? 0 : (data?.daily_dispatch_count ?? 0);

  return {
    plan,
    planId,
    planLabel,
    planStartedAt,
    planExpiresAt,
    dailyDispatchCount,
    limits,
    isExpired,
    daysRemaining,
  };
}

// ─── Plan limit checks ────────────────────────────────────────────────────────

export async function canCreateGroup(userId: string): Promise<{ ok: boolean; error?: string }> {
  const { planLabel, limits, isExpired } = await getUserPlan(userId);
  if (isExpired) return { ok: false, error: 'Seu plano expirou. Renove para continuar.' };
  if (limits.maxGroups === Infinity) return { ok: true };

  const { count } = await supabaseAdmin
    .from('dispatch_groups')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if ((count ?? 0) >= limits.maxGroups) {
    return {
      ok: false,
      error: `Plano ${planLabel} permite no máximo ${limits.maxGroups} grupo(s). Faça upgrade para continuar.`,
    };
  }
  return { ok: true };
}

export async function canConnectMarketplace(userId: string): Promise<{ ok: boolean; error?: string }> {
  const { planLabel, limits, isExpired } = await getUserPlan(userId);
  if (isExpired) return { ok: false, error: 'Seu plano expirou. Renove para continuar.' };
  if (limits.maxMarketplaces === Infinity) return { ok: true };

  const { count } = await supabaseAdmin
    .from('marketplace_connections')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_valid', true);

  if ((count ?? 0) >= limits.maxMarketplaces) {
    return {
      ok: false,
      error: `Plano ${planLabel} permite no máximo ${limits.maxMarketplaces} marketplace(s). Faça upgrade para continuar.`,
    };
  }
  return { ok: true };
}

// ─── Admin: activate a plan for a user ───────────────────────────────────────
// expiresAt: if null, calculated from planos_sistema.periodo_dias

export async function setUserPlan(
  userId: string,
  planSlug: PlanType,
  expiresAt: string | null = null
): Promise<void> {
  const now = new Date().toISOString();

  // Resolve plan_id and periodo_dias from DB
  const { data: planRow } = await supabaseAdmin
    .from('planos_sistema')
    .select('id, periodo_dias')
    .eq('slug', planSlug)
    .single();

  const planId = planRow?.id ?? 1;

  // Calculate expiry from periodo_dias if not provided
  let resolvedExpiresAt = expiresAt;
  if (!resolvedExpiresAt && planRow?.periodo_dias) {
    const d = new Date();
    d.setDate(d.getDate() + planRow.periodo_dias);
    resolvedExpiresAt = d.toISOString();
  }

  await supabaseAdmin
    .from('user_plans')
    .upsert({
      user_id: userId,
      plan: planSlug,
      plan_id: planId,
      plan_expires_at: resolvedExpiresAt,
      plan_started_at: now,
      updated_at: now,
    }, { onConflict: 'user_id' });
}

export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getUserPlan } from '@/lib/plans';
import { ProfileForm } from './ProfileForm';
import { PasswordForm } from './PasswordForm';
import { Crown, ShoppingBag, Layers } from 'lucide-react';

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const displayName = (user?.user_metadata?.display_name as string | undefined) ?? '';

  // Plan info — fetches limits from DB via planos_sistema JOIN
  const planInfo = await getUserPlan(user.id);
  const { plan, planLabel, planStartedAt, planExpiresAt, limits, isExpired } = planInfo;

  // Usage counts
  const [
    { count: marketplacesCount },
    { count: groupsCount },
  ] = await Promise.all([
    supabaseAdmin.from('marketplace_connections').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_valid', true),
    supabaseAdmin.from('dispatch_groups').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
  ]);

  function fmt(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR');
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Configurações</h1>
        <p className="text-sm text-zinc-500 mt-1">Gerencie seu perfil, plano e segurança.</p>
      </div>

      {/* Assinatura */}
      <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800/60 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Assinatura</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Seu plano atual e limites de uso</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${
            plan !== 'trial'
              ? 'text-indigo-300 bg-indigo-500/15 border-indigo-500/25'
              : 'text-zinc-500 bg-zinc-800/60 border-zinc-700/40'
          }`}>
            {plan !== 'trial' && <Crown className="h-3 w-3" />}
            {planLabel}
          </span>
        </div>

        <div className="p-5 space-y-4">
          {(plan !== 'trial' || isExpired) && (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-zinc-800/40 px-3 py-2.5">
                <p className="text-zinc-600 mb-1">Ativação</p>
                <p className="text-zinc-300 font-medium">{fmt(planStartedAt)}</p>
              </div>
              <div className="rounded-lg bg-zinc-800/40 px-3 py-2.5">
                <p className="text-zinc-600 mb-1">Expira em</p>
                <p className={`font-medium ${isExpired ? 'text-amber-400' : 'text-zinc-300'}`}>
                  {planExpiresAt ? fmt(planExpiresAt) : 'Nunca'}
                  {isExpired && ' ⚠'}
                </p>
              </div>
            </div>
          )}

          {/* Usage bars */}
          <div className="space-y-3">
            <UsageBar
              icon={ShoppingBag}
              label="Marketplaces"
              used={marketplacesCount ?? 0}
              max={limits.maxMarketplaces}
            />
            <UsageBar
              icon={Layers}
              label="Grupos de disparo"
              used={groupsCount ?? 0}
              max={limits.maxGroups}
            />
          </div>

          {(plan === 'trial' || plan === 'basico') && (
            <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-4 py-3 flex items-start gap-3">
              <Crown className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-indigo-300">Quer mais poder?</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Faça upgrade para o Profissional e tenha grupos ilimitados, 4 marketplaces e disparos sem restrição.
                </p>
                <a href="/planos" className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 inline-block">
                  Ver planos →
                </a>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Perfil */}
      <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800/60">
          <h2 className="text-sm font-semibold text-white">Perfil</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Nome de exibição e email da conta</p>
        </div>
        <div className="p-5">
          <ProfileForm defaultName={displayName} email={user.email ?? ''} />
        </div>
      </section>

      {/* Segurança */}
      <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800/60">
          <h2 className="text-sm font-semibold text-white">Segurança</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Alterar senha da conta</p>
        </div>
        <div className="p-5">
          <PasswordForm />
        </div>
      </section>

      {/* Conta */}
      <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800/60">
          <h2 className="text-sm font-semibold text-white">Informações da conta</h2>
        </div>
        <div className="p-5 space-y-2">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-zinc-500">ID da conta</span>
            <span className="text-xs font-mono text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded">{user.id.slice(0, 8)}…</span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-zinc-500">Cadastrado em</span>
            <span className="text-xs text-zinc-400">{fmt(user.created_at)}</span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-zinc-500">Último login</span>
            <span className="text-xs text-zinc-400">{fmt(user.last_sign_in_at ?? null)}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function UsageBar({
  icon: Icon,
  label,
  used,
  max,
}: {
  icon: React.ElementType;
  label: string;
  used: number;
  max: number;
}) {
  const isUnlimited = max === Infinity;
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((used / max) * 100));
  const isNearLimit = !isUnlimited && pct >= 80;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3 text-zinc-600" />
          <span className="text-xs text-zinc-400">{label}</span>
        </div>
        <span className={`text-xs font-medium ${isNearLimit ? 'text-amber-400' : 'text-zinc-400'}`}>
          {used} / {isUnlimited ? '∞' : max}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1 rounded-full bg-zinc-800/80 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isNearLimit ? 'bg-amber-500' : 'bg-indigo-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

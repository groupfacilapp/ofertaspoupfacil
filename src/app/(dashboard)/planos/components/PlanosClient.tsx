'use client';

import { useState } from 'react';
import { CheckCircle2, Zap, Crown, Clock, AlertTriangle, Infinity as InfinityIcon, Clock3 } from 'lucide-react';
import type { PlanRecord } from '@/lib/plans';

interface PlanosClientProps {
  planosMensais: PlanRecord[];
  planosAnuais: PlanRecord[];
  currentPlan: string;
  planLabel: string;
  planExpiresAt: string | null;
  isExpired: boolean;
}

function parseRecursos(recursos: string[]): Array<{ text: string; soon?: boolean }> {
  return recursos.map((r) => {
    const isSoon = r.includes('(em breve)');
    return { text: r.replace(/\s*\(em breve\)/gi, '').trim(), soon: isSoon || undefined };
  });
}

const PLAN_VISUAL: Record<
  string,
  {
    icon: React.ElementType;
    iconBg: string;
    iconColor: string;
    badgeText: string;
    badgeBg: string;
    priceColor: string;
    border: string;
    ctaBg: string;
    ctaText: string;
    subtitleColor: string;
    checkColor: string;
  }
> = {
  basico: {
    icon: Zap,
    iconBg: 'bg-amber-500/20',
    iconColor: 'text-amber-550 dark:text-amber-400',
    badgeText: '⚡ IDEAL PRA COMEÇAR',
    badgeBg: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
    priceColor: 'text-foreground dark:text-white',
    border: 'border-border dark:border-zinc-800/60',
    ctaBg: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100',
    ctaText: 'Começar Agora',
    subtitleColor: 'text-amber-700 dark:text-amber-400',
    checkColor: 'text-emerald-600 dark:text-emerald-400',
  },
  profissional: {
    icon: Crown,
    iconBg: 'bg-amber-500/20',
    iconColor: 'text-amber-550 dark:text-amber-400',
    badgeText: '🔥 MAIS ESCOLHIDO',
    badgeBg: 'bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300',
    priceColor: 'text-amber-600 dark:text-amber-450',
    border: 'border-indigo-500/50 dark:border-indigo-500/30',
    ctaBg: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-900 font-bold',
    ctaText: 'Escolher Profissional',
    subtitleColor: 'text-amber-700 dark:text-amber-400',
    checkColor: 'text-amber-650 dark:text-amber-400',
  },
  premium: {
    icon: InfinityIcon,
    iconBg: 'bg-violet-500/20',
    iconColor: 'text-violet-500 dark:text-violet-400',
    badgeText: '👑 MAIS VANTAJOSO',
    badgeBg: 'bg-violet-500/10 border-violet-500/30 text-violet-700 dark:text-violet-300',
    priceColor: 'text-foreground dark:text-white',
    border: 'border-border dark:border-zinc-800/60',
    ctaBg: 'bg-violet-600 hover:bg-violet-500 text-white font-bold',
    ctaText: 'Garantir Premium',
    subtitleColor: 'text-violet-700 dark:text-violet-400',
    checkColor: 'text-violet-600 dark:text-violet-400',
  },
};

function getFamily(slug: string): string {
  return slug.replace('_anual', '');
}

function formatPrice(valor: number) {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function LimitTag({ label, value }: { label: string; value: number }) {
  const isUnlimited = value === Infinity;
  return (
    <div className="flex items-center justify-between text-[11px] py-0.5">
      <span className="text-zinc-500">{label}</span>
      <span className={isUnlimited ? 'text-emerald-500 dark:text-emerald-400 font-bold' : 'text-zinc-700 dark:text-zinc-300 font-semibold'}>
        {isUnlimited ? '∞ ilimitado' : value}
      </span>
    </div>
  );
}

function PlanCard({
  plano,
  isCurrent,
  isAnnual,
}: {
  plano: PlanRecord;
  isCurrent: boolean;
  isAnnual: boolean;
}) {
  const family = getFamily(plano.slug);
  const cfg = PLAN_VISUAL[family] ?? PLAN_VISUAL.basico;
  const Icon = cfg.icon;
  const features = parseRecursos(plano.recursos);

  return (
    <div className={`relative rounded-2xl border bg-card dark:bg-zinc-900 flex flex-col overflow-hidden transition-all ${
      plano.destaque ? 'border-indigo-500/50 shadow-lg shadow-indigo-500/10 md:-mt-2 md:mb-2' : cfg.border
    }`}>
      {/* Badge */}
      <div className="flex justify-center pt-4 pb-0 px-4">
        <span className={`inline-flex items-center text-[11px] font-bold tracking-wide px-3 py-1 rounded-full border ${cfg.badgeBg}`}>
          {cfg.badgeText}
        </span>
      </div>

      <div className="flex-1 flex flex-col p-6 space-y-5">
        {/* Icon + name */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${cfg.iconBg}`}>
            <Icon className={`h-7 w-7 ${cfg.iconColor}`} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground dark:text-white">{plano.nome}</h2>
            <p className={`text-sm mt-0.5 font-medium ${cfg.subtitleColor}`}>{plano.descricao}</p>
          </div>
        </div>

        {/* Price */}
        <div className="text-center">
          {isAnnual && plano.valorMensalEquiv ? (
            <>
              <div className="flex items-end justify-center gap-1">
                <span className="text-sm text-zinc-500 mb-1">R$</span>
                <span className={`text-4xl font-extrabold tracking-tight ${cfg.priceColor}`}>
                  {formatPrice(plano.valorMensalEquiv)}
                </span>
                <span className="text-sm text-zinc-550 dark:text-zinc-500 mb-1">/mês</span>
              </div>
              <p className="text-xs text-zinc-550 dark:text-zinc-500 mt-1">
                R$ {formatPrice(plano.valor)} cobrado anualmente
              </p>
              <span className="inline-flex items-center text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full mt-1">
                2 meses grátis
              </span>
            </>
          ) : (
            <div className="flex items-end justify-center gap-1">
              <span className="text-sm text-zinc-550 dark:text-zinc-500 mb-1">R$</span>
              <span className={`text-4xl font-extrabold tracking-tight ${cfg.priceColor}`}>
                {formatPrice(plano.valor)}
              </span>
              <span className="text-sm text-zinc-550 dark:text-zinc-500 mb-1">/mês</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-border dark:border-zinc-800/60" />

        {/* Features */}
        <ul className="space-y-2 flex-1">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5">
              {f.soon ? (
                <Clock3 className="h-4 w-4 shrink-0 mt-0.5 text-zinc-600" />
              ) : (
                <CheckCircle2 className={`h-4 w-4 shrink-0 mt-0.5 ${cfg.checkColor}`} />
              )}
              <span className={`text-sm leading-snug font-medium ${f.soon ? 'text-zinc-500 dark:text-zinc-600' : 'text-zinc-700 dark:text-zinc-300'}`}>
                {f.text}
                {f.soon && (
                  <span className="ml-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-600 bg-zinc-100 dark:bg-zinc-800 border border-border dark:border-zinc-700/60 px-1.5 py-0.5 rounded-full align-middle">
                    em breve
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>

        {/* Limits summary */}
        <div className="rounded-lg border border-border dark:border-zinc-800/50 bg-zinc-100/40 dark:bg-zinc-950/50 px-3 py-2.5 space-y-0.5">
          <p className="text-[10px] text-zinc-650 dark:text-zinc-600 uppercase tracking-wide font-semibold mb-1.5">Limites do plano</p>
          <LimitTag label="Grupos" value={plano.limits.maxGroups} />
          <LimitTag label="Marketplaces" value={plano.limits.maxMarketplaces} />
        </div>
      </div>

      {/* CTA */}
      <div className="p-5 pt-0">
        {isCurrent ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-border dark:border-zinc-700/60 bg-zinc-100/50 dark:bg-zinc-800/40 px-6 py-3 text-sm font-semibold text-zinc-650 dark:text-zinc-400">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            Plano atual
          </div>
        ) : plano.linkCheckout ? (
          <a
            href={plano.linkCheckout}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-center w-full rounded-xl px-6 py-3 text-sm transition-all ${cfg.ctaBg}`}
          >
            {cfg.ctaText}
          </a>
        ) : (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-border dark:border-zinc-700/40 bg-zinc-100/30 dark:bg-zinc-800/30 px-6 py-3 text-sm text-zinc-650 dark:text-zinc-600 cursor-not-allowed select-none">
            Em breve
          </div>
        )}
      </div>
    </div>
  );
}

export function PlanosClient({
  planosMensais,
  planosAnuais,
  currentPlan,
  planLabel,
  planExpiresAt,
  isExpired,
}: PlanosClientProps) {
  const [tab, setTab] = useState<'mensal' | 'anual'>('mensal');

  const planos = tab === 'anual' ? planosAnuais : planosMensais;

  const daysRemaining = planExpiresAt && !isExpired
    ? Math.ceil((new Date(planExpiresAt).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="max-w-5xl space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-foreground dark:text-white">Escolha seu plano</h1>
        <p className="text-sm text-zinc-650 dark:text-zinc-400">
          Comece hoje e escale suas comissões com automação de ofertas.
        </p>
      </div>

      {/* Current plan status */}
      <div className={`rounded-xl border px-5 py-4 flex items-center justify-between gap-4 ${
        isExpired
          ? 'border-red-500/40 dark:border-red-500/20 bg-red-500/5'
          : currentPlan === 'trial'
          ? 'border-amber-500/40 dark:border-amber-500/20 bg-amber-500/5'
          : 'border-indigo-500/40 dark:border-indigo-500/20 bg-indigo-500/5'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
            isExpired ? 'bg-red-500/15' : 'bg-indigo-500/15'
          }`}>
            {isExpired
              ? <AlertTriangle className="h-4 w-4 text-red-400" />
              : <Crown className="h-4 w-4 text-indigo-400" />
            }
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground dark:text-white">
              {isExpired ? 'Plano expirado' : `Plano atual: ${planLabel}`}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {isExpired
                ? 'Escolha um plano abaixo para renovar o acesso.'
                : currentPlan === 'trial'
                ? daysRemaining !== null
                  ? `Período de teste — ${daysRemaining} dia(s) restante(s)`
                  : 'Período de teste gratuito'
                : planExpiresAt
                ? `Válido até ${new Date(planExpiresAt).toLocaleDateString('pt-BR')}`
                : 'Plano ativo'
              }
            </p>
          </div>
        </div>
        {currentPlan === 'trial' && !isExpired && daysRemaining !== null && (
          <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full">
            <Clock className="h-3 w-3" />
            {daysRemaining}d restantes
          </div>
        )}
      </div>

      {/* Mensal / Anual toggle */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-xl border border-border dark:border-zinc-800/60 bg-zinc-100 dark:bg-zinc-900/60 p-1 gap-1">
          <button
            onClick={() => setTab('mensal')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === 'mensal'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-550 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            Mensal
          </button>
          <button
            onClick={() => setTab('anual')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              tab === 'anual'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-550 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            Anual
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
              -20%
            </span>
          </button>
        </div>
      </div>

      {/* Plan cards */}
      {planos.length === 0 ? (
        <div className="text-center py-12 text-zinc-600 text-sm">
          Planos anuais em breve.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {planos.map((plano) => (
            <PlanCard
              key={plano.id}
              plano={plano}
              isCurrent={currentPlan === plano.slug && !isExpired}
              isAnnual={tab === 'anual'}
            />
          ))}
        </div>
      )}

      {/* FAQ */}
      <div className="rounded-xl border border-border dark:border-zinc-800/60 bg-card dark:bg-zinc-900/40 p-5 space-y-3">
        <h3 className="text-sm font-bold text-foreground dark:text-zinc-300">Dúvidas frequentes</h3>
        <div className="space-y-2 text-xs text-zinc-500 leading-relaxed">
          <p>
            <span className="text-foreground dark:text-zinc-400 font-bold">Como funciona o período de teste?</span>{' '}
            Todo novo cadastro recebe 7 dias gratuitos para explorar a plataforma.
          </p>
          <p>
            <span className="text-foreground dark:text-zinc-400 font-bold">O plano anual é cobrado de uma vez?</span>{' '}
            Sim. O valor total é cobrado no ato da contratação e o acesso fica ativo por 365 dias.
          </p>
          <p>
            <span className="text-foreground dark:text-zinc-400 font-bold">Posso cancelar a qualquer momento?</span>{' '}
            Sim. O acesso fica ativo até o final do período pago.
          </p>
          <p>
            <span className="text-foreground dark:text-zinc-400 font-bold">E se eu quiser mudar de plano?</span>{' '}
            Entre em contato com o suporte — fazemos a migração manualmente até a integração com o gateway de pagamento estar ativa.
          </p>
          <p>
            <span className="text-foreground dark:text-zinc-400 font-bold">Os itens marcados "em breve" já estão disponíveis?</span>{' '}
            Ainda não — estão em desenvolvimento e serão liberados nos próximos ciclos. Quem já é assinante recebe automaticamente assim que ficarem prontos.
          </p>
        </div>
      </div>
    </div>
  );
}

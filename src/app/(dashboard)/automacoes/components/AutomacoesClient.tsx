'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ExternalLink, ShoppingBag, Info } from 'lucide-react';
import Link from 'next/link';
import { saveAutomationRule } from '../actions';

interface AutomationRule {
  id: string;
  marketplace: string;
  rule_type: 'fetch' | 'dispatch';
  is_active: boolean;
  interval_minutes: number;
  start_hour: number;
  end_hour: number;
  target_group_ids: string[];
  last_run_at: string | null;
  products_found_today: number;
}

interface DispatchGroupOption {
  id: string;
  name: string;
  marketplaces: string[];
}

interface AutomacoesClientProps {
  rules: AutomationRule[];
  groups: DispatchGroupOption[];
  connectedMarketplaces: string[];
  stats: {
    pending: number;
    fetchedToday: number;
    lastDispatchAt: string | null;
  };
}

const MARKETPLACES = [
  { key: 'amazon', label: 'Amazon BR', color: '#ff5a00' },
  { key: 'mercadolivre', label: 'Mercado Livre', color: '#f59e0b' },
  { key: 'shopee', label: 'Shopee', color: '#ef4444' },
  { key: 'aliexpress', label: 'AliExpress', color: '#f43f5e' },
  { key: 'kabum', label: 'KaBuM!', color: '#3b82f6' },
  { key: 'temu', label: 'Temu', color: '#ea580c' },
  { key: 'shein', label: 'Shein', color: '#000000' },
] as const;

const MARKETPLACE_COLOR_MAP: Record<string, string> = {
  amazon: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  mercadolivre: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  shopee: 'bg-red-500/20 text-red-400 border-red-500/30',
  aliexpress: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  kabum: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  temu: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  shein: 'bg-zinc-950/10 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-300 border-zinc-900/20 dark:border-zinc-800/10',
};

const FETCH_INTERVALS = [
  { value: 60, label: 'A cada 1h' },
  { value: 120, label: 'A cada 2h' },
  { value: 240, label: 'A cada 4h' },
  { value: 360, label: 'A cada 6h' },
  { value: 720, label: 'A cada 12h' },
  { value: 1440, label: 'A cada 24h' },
];

const DISPATCH_INTERVALS = [
  { value: 5, label: 'A cada 5 min' },
  { value: 10, label: 'A cada 10 min' },
  { value: 15, label: 'A cada 15 min' },
  { value: 20, label: 'A cada 20 min' },
  { value: 30, label: 'A cada 30 min' },
];

function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return 'Nunca';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Agora';
  if (diffMins < 60) return `${diffMins} min atras`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h atras`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d atras`;
}

function formatDateTime(isoString: string | null): string {
  if (!isoString) return 'Nunca';
  const date = new Date(isoString);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${min}`;
}

function ToggleSwitch({
  isActive,
  onChange,
  disabled,
}: {
  isActive: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={isActive}
      disabled={disabled}
      onClick={() => onChange(!isActive)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed ${
        isActive ? 'bg-indigo-600' : 'bg-zinc-700'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
          isActive ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

const SELECT_CLASS =
  'text-sm bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none w-full';

function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] text-zinc-600 mt-1 leading-relaxed">{children}</p>
  );
}

interface FetchCardState {
  is_active: boolean;
  interval_minutes: number;
}

interface DispatchCardState {
  is_active: boolean;
  interval_minutes: number;
  start_hour: number;
  end_hour: number;
  target_group_ids: string[];
}

function FetchCard({
  marketplace,
  initialRule,
}: {
  marketplace: string;
  initialRule: AutomationRule | undefined;
}) {
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<FetchCardState>({
    is_active: initialRule?.is_active ?? false,
    interval_minutes: initialRule?.interval_minutes ?? 120,
  });

  function save(updates: Partial<FetchCardState>) {
    const next = { ...state, ...updates };
    setState(next);
    startTransition(async () => {
      const result = await saveAutomationRule({
        marketplace,
        rule_type: 'fetch',
        is_active: next.is_active,
        interval_minutes: next.interval_minutes,
      });
      if (result.success) {
        toast.success('Regra de busca salva!');
      } else {
        toast.error(result.error ?? 'Erro ao salvar regra');
        setState(state);
      }
    });
  }

  const lastRun = initialRule?.last_run_at ?? null;
  const foundToday = initialRule?.products_found_today ?? 0;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/60 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-white">Busca Automatica</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Busca novas ofertas no marketplace periodicamente
          </p>
        </div>
        <ToggleSwitch
          isActive={state.is_active}
          onChange={(val) => save({ is_active: val })}
          disabled={isPending}
        />
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-zinc-400 font-medium mb-1.5">
            Intervalo de busca
          </label>
          <select
            value={state.interval_minutes}
            onChange={(e) => save({ interval_minutes: Number(e.target.value) })}
            disabled={isPending}
            className={SELECT_CLASS}
          >
            {FETCH_INTERVALS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <FieldHint>
            Com que frequencia o sistema varre o marketplace em busca de novas ofertas.
            Intervalos menores = mais ofertas encontradas, mas usam mais cota da API.
          </FieldHint>
        </div>
      </div>

      <div className="pt-1 border-t border-zinc-200 dark:border-zinc-800/60 space-y-1">
        <p className="text-xs text-zinc-600">
          Ultima busca:{' '}
          <span className="text-zinc-500">{formatDateTime(lastRun)}</span>
        </p>
        <p className="text-xs text-zinc-600">
          <span className="text-zinc-500">{foundToday}</span> produtos encontrados hoje
        </p>
      </div>
    </div>
  );
}

function DispatchCard({
  marketplace,
  initialRule,
  groups,
}: {
  marketplace: string;
  initialRule: AutomationRule | undefined;
  groups: DispatchGroupOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<DispatchCardState>({
    is_active: initialRule?.is_active ?? false,
    interval_minutes: initialRule?.interval_minutes ?? 15,
    start_hour: initialRule?.start_hour ?? 8,
    end_hour: initialRule?.end_hour ?? 22,
    target_group_ids: initialRule?.target_group_ids ?? [],
  });

  function save(updates: Partial<DispatchCardState>) {
    const next = { ...state, ...updates };
    setState(next);
    startTransition(async () => {
      const result = await saveAutomationRule({
        marketplace,
        rule_type: 'dispatch',
        is_active: next.is_active,
        interval_minutes: next.interval_minutes,
        start_hour: next.start_hour,
        end_hour: next.end_hour,
        target_group_ids: next.target_group_ids,
      });
      if (result.success) {
        toast.success('Regra de disparo salva!');
      } else {
        toast.error(result.error ?? 'Erro ao salvar regra');
        setState(state);
      }
    });
  }

  function toggleGroup(groupId: string) {
    const ids = state.target_group_ids;
    const next = ids.includes(groupId)
      ? ids.filter((id) => id !== groupId)
      : [...ids, groupId];
    save({ target_group_ids: next });
  }

  const compatibleGroups = groups.filter(
    (g) => g.marketplaces.length === 0 || g.marketplaces.includes(marketplace)
  );

  const lastRun = initialRule?.last_run_at ?? null;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/60 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-white">Disparo Automatico</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Envia ofertas pendentes para os grupos selecionados
          </p>
        </div>
        <ToggleSwitch
          isActive={state.is_active}
          onChange={(val) => save({ is_active: val })}
          disabled={isPending}
        />
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs text-zinc-400 font-medium mb-1.5">
            Intervalo de envio
          </label>
          <select
            value={state.interval_minutes}
            onChange={(e) => save({ interval_minutes: Number(e.target.value) })}
            disabled={isPending}
            className={SELECT_CLASS}
          >
            {DISPATCH_INTERVALS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <FieldHint>
            A cada X minutos, o sistema envia 1 oferta por marketplace para cada grupo configurado — dentro da janela de horario definida abaixo.
          </FieldHint>
        </div>

        <div>
          <label className="block text-xs text-zinc-400 font-medium mb-1.5">
            Janela de horario (BRT)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={state.start_hour}
              onChange={(e) => save({ start_hour: Number(e.target.value) })}
              disabled={isPending}
              className={SELECT_CLASS}
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {formatHour(i)}
                </option>
              ))}
            </select>
            <select
              value={state.end_hour}
              onChange={(e) => save({ end_hour: Number(e.target.value) })}
              disabled={isPending}
              className={SELECT_CLASS}
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {formatHour(i)}
                </option>
              ))}
            </select>
          </div>
          <FieldHint>
            Fora desse horario, nenhum disparo acontece — mesmo que haja ofertas pendentes.
            O grupo pode restringir ainda mais com horarios especificos (ex: 08h, 12h, 18h).
          </FieldHint>
        </div>

        <div>
          <label className="block text-xs text-zinc-400 font-medium mb-1.5">
            Grupos de destino
          </label>
          {compatibleGroups.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-zinc-600 italic py-2">
              <Info className="h-3.5 w-3.5 shrink-0" />
              Nenhum grupo compativel com este marketplace.{' '}
              <Link href="/grupos" className="text-indigo-400 hover:text-indigo-300">
                Criar grupo
              </Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {compatibleGroups.map((g) => {
                const checked = state.target_group_ids.includes(g.id);
                return (
                  <label
                    key={g.id}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                      checked
                        ? 'border-indigo-500/30 bg-indigo-500/5'
                        : 'border-zinc-300 dark:border-zinc-700/50 bg-zinc-100/50 dark:bg-zinc-800/30 hover:border-zinc-400 dark:hover:border-zinc-600/60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleGroup(g.id)}
                      disabled={isPending}
                      className="h-3.5 w-3.5 rounded accent-indigo-500"
                    />
                    <span className={`text-xs font-medium ${checked ? 'text-zinc-200' : 'text-zinc-400'}`}>
                      {g.name}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          <FieldHint>
            Selecione um ou mais grupos. Cada grupo tem seu proprio template, limite diario
            e horarios de pico — uma automacao pode alimentar varios grupos ao mesmo tempo.
          </FieldHint>
        </div>
      </div>

      <div className="pt-1 border-t border-zinc-200 dark:border-zinc-800/60">
        <p className="text-xs text-zinc-600">
          Ultimo disparo:{' '}
          <span className="text-zinc-500">{formatDateTime(lastRun)}</span>
        </p>
      </div>
    </div>
  );
}

function MarketplaceSection({
  mpKey,
  label,
  color,
  isConnected,
  fetchRule,
  dispatchRule,
  groups,
}: {
  mpKey: string;
  label: string;
  color: string;
  isConnected: boolean;
  fetchRule: AutomationRule | undefined;
  dispatchRule: AutomationRule | undefined;
  groups: DispatchGroupOption[];
}) {
  const colorClass = MARKETPLACE_COLOR_MAP[mpKey] ?? 'bg-zinc-800/60 text-zinc-400 border-zinc-700/40';
  const isActive = (fetchRule?.is_active || dispatchRule?.is_active) && isConnected;

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/50 backdrop-blur-md overflow-hidden shadow-lg">
      {/* Marketplace header */}
      <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between bg-zinc-50/50 dark:bg-black/20">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">{label}</p>
          </div>
        </div>
        {isConnected ? (
          isActive ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
              Ativo
            </span>
          ) : (
            <span className="text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-300 dark:border-zinc-700/40 px-2.5 py-1 rounded-full">
              Inativo
            </span>
          )
        ) : (
          <span className="text-xs text-zinc-550 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800/60 border border-border dark:border-zinc-700/40 px-2.5 py-1 rounded-full">
            Nao conectado
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-5">
        {!isConnected ? (
          <div className="flex items-center gap-3 py-4 text-sm text-zinc-500">
            <ShoppingBag className="h-4 w-4 shrink-0 text-zinc-600" />
            <span>Marketplace nao conectado.</span>
            <Link
              href="/marketplaces"
              className="text-indigo-650 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 inline-flex items-center gap-1 font-semibold"
            >
              Conectar <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <FetchCard marketplace={mpKey} initialRule={fetchRule} />
              <DispatchCard marketplace={mpKey} initialRule={dispatchRule} groups={groups} />
            </div>

            {/* Como funciona */}
            <details className="group">
              <summary className="cursor-pointer text-xs text-zinc-600 hover:text-zinc-400 flex items-center gap-1 list-none select-none">
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                Como funciona?
              </summary>
              <div className="mt-3 space-y-3 pl-4 border-l border-zinc-200 dark:border-zinc-800/60">
                <p className="text-xs text-zinc-500">
                  <span className="text-zinc-300 font-medium">1. Busca Automatica</span>{' '}
                  — roda no intervalo configurado e salva novas ofertas como pendentes na fila.
                </p>
                <p className="text-xs text-zinc-500">
                  <span className="text-zinc-300 font-medium">2. Disparo Automatico</span>{' '}
                  — a cada intervalo configurado, dentro da janela de horario, pega ofertas
                  pendentes e envia para cada grupo selecionado.
                </p>
                <p className="text-xs text-zinc-500">
                  <span className="text-zinc-300 font-medium">3. Regras do grupo</span>{' '}
                  — cada grupo tem horarios de pico, limite diario e intervalo minimo entre mensagens.
                  Essas regras sao respeitadas independentemente do que esta configurado aqui.
                </p>
                <p className="text-xs text-zinc-600 italic">
                  Exemplo: automacao verifica a cada 15 min entre 08h–22h, mas o grupo
                  &quot;Achadinhos&quot; so aceita disparos as 08h e 12h com limite de 20/dia.
                  Resultado: mensagens sao enviadas nos picos de 08h e 12h, ate 20 por dia.
                </p>
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

export function AutomacoesClient({
  rules,
  groups,
  connectedMarketplaces,
  stats,
}: AutomacoesClientProps) {
  function getRuleFor(marketplace: string, ruleType: 'fetch' | 'dispatch') {
    return rules.find((r) => r.marketplace === marketplace && r.rule_type === ruleType);
  }

  const lastDispatchLabel = stats.lastDispatchAt
    ? formatRelativeTime(stats.lastDispatchAt)
    : 'Nunca';

  return (
    <div className="max-w-5xl space-y-8 md:px-2 md:py-2">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-white tracking-tight">Automações</h1>
        <p className="text-sm text-zinc-400 mt-2">
          Configure busca e disparo automático por marketplace. Um marketplace pode alimentar vários grupos simultaneamente.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div
          className="rounded-xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-sm p-4 relative overflow-hidden group text-center"
          title="Ofertas encontradas que ainda nao foram enviadas para nenhum grupo"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />
          <p className="text-2xl font-bold text-amber-400">{stats.pending}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Frescos p/ enviar</p>
        </div>
        <div
          className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 backdrop-blur-sm p-4 relative overflow-hidden group text-center"
          title="Total de ofertas buscadas nos marketplaces hoje (soma de todos os marketplaces ativos)"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />
          <p className="text-2xl font-bold text-emerald-400">{stats.fetchedToday}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Buscados hoje</p>
        </div>
        <div
          className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 backdrop-blur-sm p-4 relative overflow-hidden group text-center"
          title="Quando foi o ultimo envio automatico realizado"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />
          <p className="text-sm font-bold text-indigo-400 leading-tight pt-1">{lastDispatchLabel}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Último disparo</p>
        </div>
      </div>

      {/* Marketplace sections */}
      <div className="space-y-6">
        {MARKETPLACES.map((mp) => (
          <MarketplaceSection
            key={mp.key}
            mpKey={mp.key}
            label={mp.label}
            color={mp.color}
            isConnected={connectedMarketplaces.includes(mp.key)}
            fetchRule={getRuleFor(mp.key, 'fetch')}
            dispatchRule={getRuleFor(mp.key, 'dispatch')}
            groups={groups}
          />
        ))}
      </div>
    </div>
  );
}

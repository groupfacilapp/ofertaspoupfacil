'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Play,
  Pause,
  Settings2,
  Trash2,
  Zap,
  ShoppingBag,
  MessageSquare,
  Loader2,
  Bot,
  BotOff,
  AlertTriangle,
  X,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toggleGroup, deleteGroup, triggerManualDispatch } from '../actions';
import { cn } from '@/lib/utils';

interface GroupCardProps {
  group: {
    id: string;
    name: string;
    marketplaces: string[];
    is_active: boolean;
    daily_limit: number;
    min_discount: number;
    destinations_count: number;
    dispatched_today: number;
    automation_active: boolean;
    has_automation_rule: boolean;
  };
  onEdit: () => void;
}

const MARKETPLACE_COLORS: Record<string, string> = {
  amazon: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 dark:border-orange-500/10',
  mercadolivre: 'bg-yellow-500/10 text-amber-600 dark:text-yellow-400 border-yellow-500/20 dark:border-yellow-500/10',
  shopee: 'bg-red-500/10 text-red-650 dark:text-red-400 border-red-500/20 dark:border-red-500/10',
  aliexpress: 'bg-rose-500/10 text-rose-650 dark:text-rose-400 border-rose-500/20 dark:border-rose-500/10',
  kabum: 'bg-blue-500/10 text-blue-650 dark:text-blue-400 border-blue-500/20 dark:border-blue-500/10',
  temu: 'bg-orange-500/10 text-orange-655 dark:text-orange-400 border-orange-500/20 dark:border-orange-500/10',
  shein: 'bg-zinc-950/10 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-300 border-zinc-950/20 dark:border-zinc-800/10',
};

const MARKETPLACE_SHORT: Record<string, string> = {
  amazon: 'AMZ',
  mercadolivre: 'ML',
  shopee: 'SHP',
  aliexpress: 'ALI',
  kabum: 'KBM',
  temu: 'TEMU',
  shein: 'SHN',
};

export function GroupCard({ group, onEdit }: GroupCardProps) {
  const router = useRouter();

  // Manual loading states — avoids useTransition that can discard state updates
  // when revalidatePath triggers a concurrent router refresh
  const [isDispatchPending, setIsDispatchPending] = useState(false);
  const [isTogglePending, setIsTogglePending] = useState(false);
  const [isDeletePending, setIsDeletePending] = useState(false);

  const [dispatchResult, setDispatchResult] = useState<{ text: string; ok: boolean } | null>(null);
  const [optimisticActive, setOptimisticActive] = useState(group.is_active);
  const [dispatchedToday, setDispatchedToday] = useState(group.dispatched_today);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Only sync dispatched count when server re-renders (e.g. after navigation)
  // Not synced via router.refresh() to avoid overwriting optimistic updates
  useEffect(() => {
    setDispatchedToday(group.dispatched_today);
  }, [group.dispatched_today]);

  async function handleToggle() {
    const next = !optimisticActive;
    setOptimisticActive(next); // immediate visual update
    setIsTogglePending(true);
    try {
      // Timeout of 10s to prevent spinner getting stuck if server action hangs
      await Promise.race([
        toggleGroup(group.id, next),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
      ]);
    } catch {
      // On error/timeout: revert optimistic update
      setOptimisticActive(!next);
    } finally {
      setIsTogglePending(false);
    }
  }

  async function handleDelete() {
    setShowDeleteConfirm(false);
    setIsDeletePending(true);
    try {
      const result = await deleteGroup(group.id);
      if (result?.error) {
        setDispatchResult({ text: result.error, ok: false });
      } else {
        router.refresh();
      }
    } finally {
      setIsDeletePending(false);
    }
  }

  async function handleManualDispatch() {
    setIsDispatchPending(true);
    setDispatchResult(null);
    try {
      const res = await triggerManualDispatch(group.id);
      if (!res.ok) {
        setDispatchResult({ text: res.error ?? 'Erro no disparo', ok: false });
      } else if (res.dispatched && res.dispatched > 0) {
        setDispatchedToday((prev) => prev + res.dispatched!); // immediate bar update
        setDispatchResult({ text: `✓ ${res.dispatched} oferta(s) enviada(s)`, ok: true });
      } else if (res.errors && res.errors.length > 0) {
        setDispatchResult({ text: res.errors[0], ok: false });
      } else {
        setDispatchResult({ text: 'Sem novas ofertas para enviar', ok: false });
      }
    } finally {
      setIsDispatchPending(false);
      setTimeout(() => setDispatchResult(null), 6000);
    }
  }

  const progressPct = Math.min(
    100,
    Math.round((dispatchedToday / group.daily_limit) * 100)
  );

  const isBusy = isTogglePending || isDeletePending;

  return (
    <div
      className={cn(
        'relative group overflow-hidden rounded-2xl border bg-card dark:bg-zinc-900/40 dark:backdrop-blur-xl p-6 transition-all duration-300',
        optimisticActive 
          ? 'border-indigo-500/50 dark:border-indigo-500/30 hover:shadow-[0_0_30px_rgba(99,102,241,0.15)] hover:border-indigo-500/50' 
          : 'border-border dark:border-zinc-800/60 opacity-80 grayscale-[20%] hover:grayscale-0 hover:opacity-100'
      )}
    >
      {/* Background active glow */}
      {optimisticActive && (
        <div className="absolute -top-32 -right-32 h-64 w-64 rounded-full blur-[100px] bg-gradient-to-tr from-indigo-500/10 to-transparent opacity-60 transition-opacity group-hover:opacity-100" />
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-5 relative z-10">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              {optimisticActive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
              <span className={cn(
                "relative inline-flex rounded-full h-2.5 w-2.5",
                optimisticActive ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-zinc-600"
              )}></span>
            </span>
            <p className="text-base font-bold text-zinc-900 dark:text-white tracking-tight truncate">
              {group.name}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {group.marketplaces.map((mp) => (
              <span
                key={mp}
                className={cn(
                  'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider border',
                  MARKETPLACE_COLORS[mp] ??
                    'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                )}
              >
                {MARKETPLACE_SHORT[mp] ?? mp}
              </span>
            ))}
            {group.has_automation_rule ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider border shadow-sm',
                  group.automation_active
                    ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.2)]'
                    : 'bg-zinc-100 dark:bg-zinc-700/30 text-zinc-500 border-zinc-200 dark:border-zinc-700/40'
                )}
                title={group.automation_active ? 'Automação ativa' : 'Automação pausada'}
              >
                {group.automation_active ? (
                  <Bot className="h-3 w-3" />
                ) : (
                  <BotOff className="h-3 w-3" />
                )}
                Auto
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider border bg-amber-500/10 text-amber-500 border-amber-500/20"
                title="Nenhuma automação configurada para este grupo"
              >
                <BotOff className="h-3 w-3" />
                Sem auto
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 ml-3 shrink-0 bg-zinc-100/40 dark:bg-black/20 rounded-lg p-1 border border-border dark:border-white/5">
          {/* Toggle pause/play */}
          <button
            onClick={handleToggle}
            disabled={isBusy}
            className={cn(
              'rounded-md p-1.5 transition-all',
              isBusy
                ? 'text-zinc-600 cursor-not-allowed'
                : optimisticActive ? 'text-zinc-400 hover:text-amber-400 hover:bg-amber-400/10' : 'text-zinc-400 hover:text-emerald-400 hover:bg-emerald-400/10'
            )}
            title={optimisticActive ? 'Pausar grupo' : 'Ativar grupo'}
          >
            {isTogglePending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : optimisticActive ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4 fill-emerald-400/20 text-emerald-400" />
            )}
          </button>

          {/* Edit */}
          <button
            onClick={onEdit}
            disabled={isBusy}
            className="rounded-md p-1.5 text-zinc-400 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-all"
            title="Editar configurações"
          >
            <Settings2 className="h-4 w-4" />
          </button>

          {/* Delete */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isBusy}
            className="rounded-md p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
            title="Excluir grupo"
          >
            {isDeletePending ? (
              <Loader2 className="h-4 w-4 animate-spin text-rose-400" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 mb-4 mt-2 relative z-10 bg-zinc-100/40 dark:bg-black/20 rounded-xl p-3 border border-border dark:border-white/5">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20">
            <MessageSquare className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Destinos</p>
            <p className="text-sm font-semibold text-zinc-900 dark:text-white leading-none mt-0.5">{group.destinations_count}</p>
          </div>
        </div>
        <div className="w-px h-8 bg-white/5 mx-1" />
        <div className="flex items-center gap-2">
          <div className="bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20">
            <ShoppingBag className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Desconto Mín.</p>
            <p className="text-sm font-semibold text-zinc-900 dark:text-white leading-none mt-0.5">{group.min_discount}%+</p>
          </div>
        </div>
      </div>

      {/* Daily progress */}
      <div className="mb-5 relative z-10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Progresso Diário</span>
          <span className="text-xs font-bold text-zinc-900 dark:text-white">
            <span className={cn(dispatchedToday > 0 ? "text-indigo-400" : "text-zinc-500")}>{dispatchedToday}</span>
            <span className="text-zinc-600 font-medium">/{group.daily_limit} enviadas</span>
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-zinc-200/80 dark:bg-black/40 border border-border dark:border-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Action / Delete Area */}
      <div className="relative z-10 mt-auto">
        {showDeleteConfirm ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 shadow-inner">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-300">Excluir "{group.name}"? Ação irreversível.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-700/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all bg-zinc-50 dark:bg-zinc-900/50"
              >
                <X className="h-3.5 w-3.5" />
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-[0_4px_14px_0_rgba(225,29,72,0.39)] transition-all"
              >
                <Check className="h-3.5 w-3.5" />
                Excluir
              </button>
            </div>
          </div>
        ) : dispatchResult ? (
          <p
            className={cn(
              'text-xs font-medium text-center py-3 px-4 rounded-xl border shadow-inner',
              dispatchResult.ok
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
            )}
          >
            {dispatchResult.text}
          </p>
        ) : (
          <Button
            variant="outline"
            className="w-full h-11 rounded-xl font-semibold border-zinc-300 dark:border-zinc-700/60 bg-zinc-100 dark:bg-zinc-800/40 text-zinc-600 dark:text-zinc-300 hover:bg-indigo-600 hover:border-indigo-500 hover:text-white transition-all shadow-sm hover:shadow-[0_4px_14px_0_rgba(79,70,229,0.39)]"
            onClick={handleManualDispatch}
            disabled={isDispatchPending || !optimisticActive || isBusy}
          >
            {isDispatchPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Pesquisando e Enviando...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                {optimisticActive ? 'Disparar agora' : 'Ative para disparar'}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

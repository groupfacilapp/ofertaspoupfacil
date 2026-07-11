'use client';

import { useState, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { HistoricoList, type LogEntry } from './HistoricoList';

type FilterPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'all';

const PERIOD_LABELS: Record<FilterPeriod, string> = {
  today: 'Hoje',
  yesterday: 'Ontem',
  week: 'Esta semana',
  month: 'Este mês',
  all: 'Tudo',
};

const PAGE_SIZE = 20;

// BRT date string for N days ago: UTC-3 → subtract 3h then take ISO date
function brtDateStr(daysAgo = 0): string {
  return new Date(Date.now() - 3 * 3600000 - daysAgo * 86400000).toISOString().split('T')[0];
}

function matchesPeriod(dispatched_date: string, period: FilterPeriod): boolean {
  if (period === 'all') return true;
  if (period === 'today') return dispatched_date === brtDateStr(0);
  if (period === 'yesterday') return dispatched_date === brtDateStr(1);
  if (period === 'week') return dispatched_date >= brtDateStr(6);
  if (period === 'month') {
    const firstOfMonth = brtDateStr(0).slice(0, 7) + '-01';
    return dispatched_date >= firstOfMonth;
  }
  return true;
}

interface HistoricoClientProps {
  logs: LogEntry[];
  total: number;
  sent: number;
  failed: number;
}

export function HistoricoClient({ logs, total, sent, failed }: HistoricoClientProps) {
  const [period, setPeriod] = useState<FilterPeriod>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'failed'>('all');
  const [page, setPage] = useState(1);

  const filteredLogs = useMemo(() => {
    let result = logs;

    // Period filter — compare dispatched_date (BRT date string) directly
    if (period !== 'all') {
      result = result.filter((log) => matchesPeriod(log.dispatched_date, period));
    }

    // Status filter
    if (statusFilter === 'sent') {
      result = result.filter((log) =>
        ['sent', 'delivered', 'read'].includes(log.status)
      );
    } else if (statusFilter === 'failed') {
      result = result.filter((log) => log.status === 'failed');
    }

    return result;
  }, [logs, period, statusFilter]);

  // Reset page when filter changes
  const totalFiltered = filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageLogs = filteredLogs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handlePeriod(p: FilterPeriod) {
    setPeriod(p);
    setPage(1);
  }

  function handleStatus(s: 'all' | 'sent' | 'failed') {
    setStatusFilter(s);
    setPage(1);
  }

  const filteredSent = filteredLogs.filter((l) =>
    ['sent', 'delivered', 'read'].includes(l.status)
  ).length;
  const filteredFailed = filteredLogs.filter((l) => l.status === 'failed').length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/60 p-4">
          <p className="text-xs text-zinc-500 mb-1">Total</p>
          <p className="text-2xl font-semibold text-zinc-900 dark:text-white">{total}</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">todos os tempos</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-xs text-zinc-500 mb-1">Enviados</p>
          <p className="text-2xl font-semibold text-emerald-400">{sent}</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">total histórico</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-xs text-zinc-500 mb-1">Falhas</p>
          <p className="text-2xl font-semibold text-red-400">{failed}</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">total histórico</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Period chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Calendar className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
          {(Object.keys(PERIOD_LABELS) as FilterPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => handlePeriod(p)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                period === p
                  ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30'
                  : 'bg-zinc-800/40 text-zinc-500 border-zinc-700/40 hover:text-zinc-300 hover:border-zinc-600/60'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1.5 sm:ml-auto">
          {(['all', 'sent', 'failed'] as const).map((s) => {
            const labels = { all: 'Todos', sent: 'Enviados', failed: 'Falhas' };
            return (
              <button
                key={s}
                onClick={() => handleStatus(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  statusFilter === s
                    ? s === 'sent'
                      ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30'
                      : s === 'failed'
                      ? 'bg-red-600/20 text-red-300 border-red-500/30'
                      : 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30'
                    : 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 border-zinc-200 dark:border-zinc-700/40 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600/60'
                }`}
              >
                {labels[s]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Result info */}
      {totalFiltered !== total && (
        <p className="text-xs text-zinc-600">
          {totalFiltered} resultado(s) — {filteredSent} enviados · {filteredFailed} falhas
        </p>
      )}

      {/* List */}
      {pageLogs.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/40 p-10 text-center">
          <p className="text-sm text-zinc-500">Nenhum disparo neste período.</p>
        </div>
      ) : (
        <HistoricoList logs={pageLogs} />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-zinc-600">
            Página {safePage} de {totalPages} · {totalFiltered} total
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700/60 bg-zinc-100 dark:bg-zinc-800/40 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700/60 bg-zinc-100 dark:bg-zinc-800/40 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Próxima
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

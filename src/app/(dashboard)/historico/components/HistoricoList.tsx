'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, Clock, Package, TrendingDown, ExternalLink, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';

const MARKETPLACE_LABEL: Record<string, string> = {
  amazon: 'Amazon BR',
  mercadolivre: 'Mercado Livre',
  shopee: 'Shopee',
  aliexpress: 'AliExpress',
  kabum: 'KaBuM!',
};

const MARKETPLACE_COLOR: Record<string, string> = {
  amazon: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  mercadolivre: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  shopee: 'bg-red-500/15 text-red-400 border-red-500/20',
  aliexpress: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
  kabum: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
};

function StatusBadge({ status }: { status: string }) {
  if (status === 'sent' || status === 'delivered' || status === 'read') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400">
        <CheckCircle2 className="h-3 w-3" /> Enviado
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-400">
        <XCircle className="h-3 w-3" /> Falhou
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400">
      <Clock className="h-3 w-3" /> Pendente
    </span>
  );
}

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function timeAgo(date: string) {
  const ts = new Date(date).getTime();
  if (isNaN(ts)) return '—';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  // For older dates show BRT date+time
  const brt = new Date(ts - 3 * 3600000);
  return brt.toISOString().slice(0, 16).replace('T', ' ') + ' BRT';
}

export interface LogEntry {
  id: string;
  status: string;
  error_message: string | null;
  dispatched_at: string;
  dispatched_date: string;
  message: string;
  offer: {
    title: string | null;
    marketplace: string | null;
    current_price: number | null;
    discount_percent: number | null;
    image_url: string | null;
    affiliate_link: string | null;
    product_url: string | null;
  } | null;
  group_name: string | null;
}

function LogRow({ log }: { log: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const mp = log.offer?.marketplace ?? 'unknown';
  const link = log.offer?.affiliate_link || log.offer?.product_url;

  return (
    <div className="divide-y divide-zinc-800/40">
      {/* Main row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/20 transition-colors text-left"
      >
        {/* Product image */}
        <div className="h-12 w-12 shrink-0 rounded-lg bg-zinc-800/60 border border-zinc-700/40 overflow-hidden flex items-center justify-center">
          {log.offer?.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={log.offer.image_url}
              alt={log.offer.title ?? ''}
              className="h-full w-full object-cover"
            />
          ) : (
            <Package className="h-5 w-5 text-zinc-700" />
          )}
        </div>

        {/* Title + group */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-zinc-200 truncate">
            {log.offer?.title ?? '—'}
          </p>
          <p className="text-[10px] text-zinc-600 mt-0.5">{log.group_name ?? '—'}</p>
        </div>

        {/* Price */}
        <div className="shrink-0 text-right hidden sm:block">
          {log.offer?.current_price ? (
            <p className="text-xs font-semibold text-zinc-100">
              {formatPrice(log.offer.current_price)}
            </p>
          ) : null}
          {log.offer?.discount_percent ? (
            <p className="text-[10px] text-emerald-400 flex items-center justify-end gap-0.5 mt-0.5">
              <TrendingDown className="h-2.5 w-2.5" />
              {log.offer.discount_percent}% OFF
            </p>
          ) : null}
        </div>

        {/* Marketplace badge */}
        <div className="shrink-0 hidden md:block">
          <span className={`inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full border ${MARKETPLACE_COLOR[mp] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
            {MARKETPLACE_LABEL[mp] ?? mp}
          </span>
        </div>

        {/* Status + time + expand icon */}
        <div className="shrink-0 text-right space-y-0.5">
          <StatusBadge status={log.status} />
          <p className="text-[10px] text-zinc-600">{timeAgo(log.dispatched_at)}</p>
        </div>

        <div className="shrink-0 text-zinc-600">
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 pt-3 bg-zinc-900/40 space-y-3">
          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {link && (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/60 bg-zinc-800/60 px-3 py-1.5 text-xs text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700/60 transition-all"
              >
                <ExternalLink className="h-3 w-3" />
                Abrir produto
              </a>
            )}
            <div className="inline-flex items-center gap-1.5 text-[10px] text-zinc-600">
              <MessageSquare className="h-3 w-3" /> Mensagem enviada
            </div>
          </div>

          {/* Message preview */}
          <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/60 px-4 py-3">
            <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
              {log.message}
            </pre>
          </div>

          {/* Error if failed */}
          {log.status === 'failed' && log.error_message && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {log.error_message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function HistoricoList({ logs }: { logs: LogEntry[] }) {
  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 overflow-hidden divide-y divide-zinc-800/40">
      {logs.map((log) => (
        <LogRow key={log.id} log={log} />
      ))}
    </div>
  );
}

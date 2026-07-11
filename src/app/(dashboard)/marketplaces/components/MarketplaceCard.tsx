'use client';

import { useState } from 'react';
import { CheckCircle2, AlertCircle, Clock, Settings2, ExternalLink, ShoppingCart, Handshake, ShoppingBag, Globe, Zap, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CredentialSheet } from './CredentialSheet';
import { disconnectMarketplace } from '../actions';
import { cn } from '@/lib/utils';

export type MarketplaceStatus = {
  marketplace: 'amazon' | 'mercadolivre' | 'shopee' | 'aliexpress' | 'kabum' | 'temu' | 'shein';
  is_valid: boolean | null;
  last_validated_at: string | null;
  validation_error: string | null;
  encrypted_credentials: string | null;
  last_fetch_error: string | null;
  last_fetch_error_at: string | null;
  last_fetch_success_at: string | null;
};

const MARKETPLACE_META = {
  amazon: {
    label: 'Amazon BR',
    icon: ShoppingCart,
    description: 'Tag de afiliado + cookies SiteStripe (opcional)',
    color: 'from-orange-400 to-orange-600',
    border: 'border-orange-500 dark:border-orange-500/50',
    shadow: 'shadow-[0_0_20px_-5px_rgba(249,115,22,0.25)]',
    hoverShadow: 'hover:shadow-[0_0_25px_0px_rgba(249,115,22,0.35)]',
    accent: 'text-orange-600 dark:text-orange-400',
    badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 dark:border-orange-500/10 group-hover:bg-orange-500/20',
    docsUrl: 'https://associados.amazon.com.br',
    docsLabel: 'Amazon Associates',
    bulletColor: '#ff5a00',
  },
  mercadolivre: {
    label: 'Mercado Livre',
    icon: Handshake,
    description: 'Tag de afiliado + cookie de sessão do painel',
    color: 'from-amber-350 to-yellow-550',
    border: 'border-amber-400 dark:border-yellow-500/50',
    shadow: 'shadow-[0_0_20px_-5px_rgba(245,158,11,0.25)]',
    hoverShadow: 'hover:shadow-[0_0_25px_0px_rgba(245,158,11,0.35)]',
    accent: 'text-amber-600 dark:text-yellow-450',
    badge: 'bg-amber-500/10 text-amber-600 dark:text-yellow-450 border-amber-500/25 dark:border-yellow-500/10 group-hover:bg-amber-500/20',
    docsUrl: 'https://www.mercadolivre.com.br/afiliados/linkbuilder',
    docsLabel: 'Painel de Afiliados',
    bulletColor: '#f59e0b',
  },
  shopee: {
    label: 'Shopee',
    icon: ShoppingBag,
    description: 'AppID + Secret da API de Afiliados',
    color: 'from-rose-500 to-red-600',
    border: 'border-rose-500 dark:border-rose-500/50',
    shadow: 'shadow-[0_0_20px_-5px_rgba(244,63,94,0.25)]',
    hoverShadow: 'hover:shadow-[0_0_25px_0px_rgba(244,63,94,0.35)]',
    accent: 'text-rose-650 dark:text-rose-450',
    badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 dark:border-rose-500/10 group-hover:bg-rose-500/20',
    docsUrl: 'https://open-api.affiliate.shopee.com.br',
    docsLabel: 'Shopee Affiliate',
    bulletColor: '#ef4444',
  },
  aliexpress: {
    label: 'AliExpress',
    icon: Globe,
    description: 'App Key + Secret + TrackingID da Plataforma Open',
    color: 'from-red-500 to-rose-700',
    border: 'border-red-550 dark:border-red-500/50',
    shadow: 'shadow-[0_0_20px_-5px_rgba(239,68,68,0.25)]',
    hoverShadow: 'hover:shadow-[0_0_25px_0px_rgba(239,68,68,0.35)]',
    accent: 'text-red-650 dark:text-red-400',
    badge: 'bg-red-500/10 text-red-600 dark:text-red-500 border-red-500/20 dark:border-red-500/10 group-hover:bg-red-500/20',
    docsUrl: 'https://portals.aliexpress.com',
    docsLabel: 'AliExpress Open Platform',
    bulletColor: '#f43f5e',
  },
  kabum: {
    label: 'KaBuM!',
    icon: Zap,
    description: 'Publisher ID Awin (sem cookies — só o ID basta)',
    color: 'from-blue-400 to-indigo-600',
    border: 'border-blue-500 dark:border-blue-500/50',
    shadow: 'shadow-[0_0_20px_-5px_rgba(59,130,246,0.25)]',
    hoverShadow: 'hover:shadow-[0_0_25px_0px_rgba(59,130,246,0.35)]',
    accent: 'text-blue-600 dark:text-blue-400',
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 dark:border-blue-500/10 group-hover:bg-blue-500/20',
    docsUrl: 'https://www.awin.com/br',
    docsLabel: 'Awin Brasil',
    bulletColor: '#3b82f6',
  },
  temu: {
    label: 'Temu',
    icon: ShoppingBag,
    description: 'Share ID do painel de afiliados Temu',
    color: 'from-orange-500 to-red-500',
    border: 'border-orange-550 dark:border-orange-500/50',
    shadow: 'shadow-[0_0_20px_-5px_rgba(249,115,22,0.25)]',
    hoverShadow: 'hover:shadow-[0_0_25px_0px_rgba(249,115,22,0.35)]',
    accent: 'text-orange-600 dark:text-orange-400',
    badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 dark:border-orange-500/10 group-hover:bg-orange-500/20',
    docsUrl: 'https://partner.temu.com',
    docsLabel: 'Temu Partner',
    bulletColor: '#ea580c',
  },
  shein: {
    label: 'Shein',
    icon: ShoppingBag,
    description: 'Publisher ID + Website ID do CJ Affiliate',
    color: 'from-zinc-600 to-zinc-800',
    border: 'border-zinc-800 dark:border-zinc-700/50',
    shadow: 'shadow-[0_0_20px_-5px_rgba(0,0,0,0.25)]',
    hoverShadow: 'hover:shadow-[0_0_25px_0px_rgba(0,0,0,0.35)]',
    accent: 'text-zinc-900 dark:text-zinc-400',
    badge: 'bg-zinc-950/10 text-zinc-900 dark:text-zinc-300 border-zinc-900/20 dark:border-zinc-800/10 group-hover:bg-zinc-950/20',
    docsUrl: 'https://members.cj.com',
    docsLabel: 'CJ Affiliate',
    bulletColor: '#000000',
  },
} as const;

const LOGO_URLS: Record<string, string> = {
  temu: 'https://udlmqdwtisolgutzdylw.supabase.co/storage/v1/object/public/imagens/temu.png',
  shopee: 'https://udlmqdwtisolgutzdylw.supabase.co/storage/v1/object/public/imagens/shopee.png',
  shein: 'https://udlmqdwtisolgutzdylw.supabase.co/storage/v1/object/public/imagens/shein.png',
  mercadolivre: 'https://udlmqdwtisolgutzdylw.supabase.co/storage/v1/object/public/imagens/mercadolivre.png',
  kabum: 'https://udlmqdwtisolgutzdylw.supabase.co/storage/v1/object/public/imagens/kabum_logo.jfif',
  amazon: 'https://udlmqdwtisolgutzdylw.supabase.co/storage/v1/object/public/imagens/amazon.png',
  aliexpress: 'https://udlmqdwtisolgutzdylw.supabase.co/storage/v1/object/public/imagens/aliexpress.png',
};

function MarketplaceLogo({ marketplace, className }: { marketplace: string; className?: string }) {
  const url = LOGO_URLS[marketplace];
  if (!url) return null;
  return (
    <img
      src={url}
      alt={marketplace}
      className={cn(className, 'w-full h-full object-contain')}
    />
  );
}

function StatusBadge({ status }: { status: MarketplaceStatus }) {
  if (!status.last_validated_at) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800/50 px-2 py-0.5 rounded-full ring-1 ring-zinc-300 dark:ring-zinc-700/50">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
        Não configurado
      </span>
    );
  }

  const lastValidated = new Date(status.last_validated_at);
  const formattedDate = lastValidated.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });

  // Mercado Livre cookies expire frequently (weekly), but other marketplaces (Shopee API, Amazon Tag) are stable.
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const isStaleSession = status.marketplace === 'mercadolivre' && lastValidated.getTime() < sevenDaysAgo;

  if (status.is_valid) {
    return (
      <div className="flex flex-col gap-1.5 items-start">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-full ring-1 ring-emerald-500/30">
          <CheckCircle2 className="h-3 w-3" />
          Conectado
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] text-zinc-400 font-medium flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" /> Validado em {formattedDate}
          </span>
          {isStaleSession && (
            <span className="text-[9px] text-amber-500/80 font-medium flex items-center gap-1">
              <AlertCircle className="h-2.5 w-2.5" /> Sessão antiga: Recomenda-se atualizar
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 items-start">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-400 uppercase tracking-wider bg-rose-500/10 px-2 py-0.5 rounded-full ring-1 ring-rose-500/30">
        <AlertCircle className="h-3 w-3" />
        Erro de Conexão
      </span>
      <span className="text-[9px] text-rose-400/60 font-medium flex items-center gap-1">
        <Clock className="h-2.5 w-2.5" /> Último teste: {formattedDate}
      </span>
    </div>
  );
}

export function MarketplaceCard({ status }: { status: MarketplaceStatus }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const meta = MARKETPLACE_META[status.marketplace];
  // Connected = has saved credentials, regardless of last validation result.
  // Validation errors are surfaced as warnings inside the card, not as "disconnected".
  const isConnected = !!status.encrypted_credentials;
  const IconProps = meta.icon;

  async function handleDisconnect() {
    setDisconnecting(true);
    await disconnectMarketplace(status.marketplace);
    // Reload to reflect new state — same pattern used after saving credentials
    window.location.reload();
  }

  return (
    <>
      <div
        className={cn(
          'relative flex flex-col rounded-2xl bg-card dark:bg-zinc-900/40 dark:backdrop-blur-xl p-6 transition-all duration-300 group overflow-hidden',
          isConnected 
            ? `border ${meta.border} ${meta.shadow} ${meta.hoverShadow}`
            : 'border border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-xl'
        )}
      >
        {/* Background ambient glow if connected */}
        {isConnected && (
          <div className={cn('absolute -top-24 -right-24 h-48 w-48 rounded-full blur-[80px] bg-gradient-to-tr opacity-20 transition-opacity group-hover:opacity-30', meta.color)} />
        )}

        {/* Top row */}
        <div className="flex items-start justify-between mb-5 relative z-10">
          <div className="flex gap-4">
            <div className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl overflow-hidden ring-1 ring-zinc-200 dark:ring-white/10 bg-white shadow-sm",
              (status.marketplace === 'mercadolivre' || status.marketplace === 'aliexpress') ? 'p-0' : 'p-1.5'
            )}>
              <MarketplaceLogo 
                marketplace={status.marketplace} 
                className={cn(
                  "h-full w-full",
                  (status.marketplace === 'mercadolivre' || status.marketplace === 'aliexpress') ? 'object-cover' : 'object-contain'
                )} 
              />
            </div>
            <div className="flex flex-col gap-1 items-start justify-center">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: meta.bulletColor }} />
                <p className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">{meta.label}</p>
              </div>
              <StatusBadge status={status} />
            </div>
          </div>
          <a
            href={meta.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition-colors bg-zinc-100 dark:bg-zinc-800/50 p-2 rounded-lg ring-1 ring-zinc-200 dark:ring-white/5 hover:bg-zinc-200 dark:hover:bg-zinc-700/50"
            title={meta.docsLabel}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        {/* Description */}
        <p className="text-sm text-zinc-400 mb-6 leading-relaxed flex-1 relative z-10">
          {meta.description}
        </p>

        {/* Alerts / Status Section */}
        <div className="space-y-3 mb-6 relative z-10">
          {/* Credential error */}
          {status.validation_error && !status.is_valid && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 shadow-inner">
              <div className="flex gap-2 items-start mb-1">
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <p className="text-sm text-rose-400 font-medium">Erro de Autenticação</p>
              </div>
              <p className="text-xs text-rose-400/80 pl-6">{status.validation_error}</p>
            </div>
          )}

          {/* Fetch health */}
          {status.last_fetch_error && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 shadow-inner">
              <div className="flex gap-2 items-start mb-1">
                <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-400 font-medium tracking-wide">Desafio no Último Fetch</p>
              </div>
              <p className="text-xs text-amber-300/80 leading-relaxed pl-6">{status.last_fetch_error}</p>
              {status.last_fetch_error_at && (
                <p className="text-[10px] text-amber-500/60 font-semibold pl-6 mt-2">
                  {new Date(status.last_fetch_error_at).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
          )}
          
          {!status.last_fetch_error && status.last_fetch_success_at && (
            <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/10 w-max px-3 py-1.5 rounded-lg">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <p className="text-xs font-medium text-emerald-400/90">
                Última sincronização: {new Date(status.last_fetch_success_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="relative z-10 mt-auto pt-2 flex flex-col gap-2">
          <Button
            variant="outline"
            className={cn(
              "w-full rounded-xl transition-all font-semibold shadow-sm h-11",
              isConnected
                ? "bg-zinc-100 dark:bg-zinc-900/60 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white"
                : "bg-indigo-600 border-indigo-500 hover:bg-indigo-500 text-white shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)]"
            )}
            onClick={() => setOpen(true)}
          >
            <Settings2 className="h-4 w-4 mr-2" />
            {isConnected ? 'Editar credenciais' : 'Configurar marketplace'}
          </Button>

          {isConnected && !confirming && (
            <Button
              variant="ghost"
              className="w-full rounded-xl h-9 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all text-sm font-medium"
              onClick={() => setConfirming(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Desconectar
            </Button>
          )}

          {isConnected && confirming && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl h-9 border-rose-500/50 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 text-sm font-semibold transition-all"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? 'Desconectando...' : 'Confirmar'}
              </Button>
              <Button
                variant="ghost"
                className="flex-1 rounded-xl h-9 text-zinc-400 hover:text-white text-sm transition-all"
                onClick={() => setConfirming(false)}
                disabled={disconnecting}
              >
                Cancelar
              </Button>
            </div>
          )}
        </div>
      </div>

      <CredentialSheet
        open={open}
        onOpenChange={setOpen}
        marketplace={status.marketplace}
      />
    </>
  );
}

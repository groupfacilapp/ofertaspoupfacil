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

function MarketplaceLogo({ marketplace, className }: { marketplace: string; className?: string }) {
  if (marketplace === 'amazon') {
    return (
      <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M48.2 24.3c-7 0-12.8 2.2-16 6.3-2 2.6-2.5 5.5-2.5 8.7 0 7.8 5 12.2 12.8 12.2 4.4 0 8.2-1.8 11.2-5v3.8c0 4.3-2.3 6.8-6.5 6.8-3.5 0-6.7-1.7-8.3-4.8l-7.7 4.7c3.3 5.8 9.5 8.8 16 8.8 10 0 16.5-5.5 16.5-16.7v-25c-3.2 3.2-7.5 5.2-12.5 5.2zm-2.3 22.8c-4 0-6.2-2.3-6.2-6 0-3.8 2.2-6.2 6.2-6.2 3.8 0 6.2 2.4 6.2 6.2 0 3.7-2.4 6-6.2 6z" fill="#000"/>
        <path d="M12 70c20 12 45 15 68 8 3.5-1 6.5 2.5 3.5 5-18 14-49 15-70 1-2.5-1.5-4-5-1.5-14z" fill="#ff9900"/>
        <path d="M82.8 74.2c-1.2-1.5-4-.8-3.2 1.2.8 2 2.2 5 2.2 7 0 1.2-.8 1.8-2 1.8-2 0-6-3-8.8-5.8-1.5-1.5-3.5.5-2.2 2 4.2 4.2 9.5 7.2 12.5 7.2 3 0 5-2 5-5 0-3-1.8-6.2-3.5-8.4z" fill="#ff9900"/>
      </svg>
    );
  }
  if (marketplace === 'mercadolivre') {
    return (
      <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="46" fill="#FFE600"/>
        <path d="M30 52c3-4 8-10 13-10s8 3 10 5l12-10c3-2.5 7 1.5 4 4L57 53c-2 2-6 4-9 1s-6-5-9-5c-2 0-5 3-7 5l-2-2z" fill="#2D3280"/>
        <path d="M70 48c-3 4-8 10-13 10s-8-3-10-5L35 63c-3 2.5-7-1.5-4-4l12-12c2-2 6-4 9-1s6 5 9 5c2 0 5-3 7-5l2 2z" fill="#2D3280"/>
      </svg>
    );
  }
  if (marketplace === 'shopee') {
    return (
      <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="15" y="25" width="70" height="60" rx="12" fill="#EE4D2D"/>
        <path d="M38 25c0-10 8-15 12-15s12 5 12 15" stroke="#EE4D2D" strokeWidth="8" fill="none"/>
        <path d="M50 40c-6 0-10 3-10 7s3 6 8 8c6 2 9 4 9 8s-4 7-9 7-9-3-10-6m2-24l16 16" stroke="#fff" strokeWidth="6" strokeLinecap="round" fill="none"/>
      </svg>
    );
  }
  if (marketplace === 'aliexpress') {
    return (
      <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="15" y="25" width="70" height="60" rx="15" fill="#E62E04"/>
        <path d="M35 30c0-8 6-12 15-12s15 4 15 12" stroke="#fff" strokeWidth="6" fill="none"/>
        <ellipse cx="50" cy="55" rx="18" ry="12" fill="#fff"/>
        <ellipse cx="50" cy="50" rx="18" ry="12" fill="#E62E04"/>
      </svg>
    );
  }
  if (marketplace === 'kabum') {
    return (
      <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="10" width="80" height="80" rx="16" fill="#0060EE"/>
        <path d="M58 20L32 54h18l-8 32 30-38H52l6-28z" fill="#FFF"/>
      </svg>
    );
  }
  if (marketplace === 'temu') {
    return (
      <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="10" width="80" height="80" rx="16" fill="#FF5700"/>
        <path d="M22 30h16M30 30v40M45 42c0-8 6-12 12-12s12 4 12 12v28H45V42zM75 30v40c0 5-3 8-7 8s-7-3-7-8V30" stroke="#FFF" strokeWidth="7" strokeLinecap="round" fill="none"/>
      </svg>
    );
  }
  if (marketplace === 'shein') {
    return (
      <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="10" width="80" height="80" rx="16" fill="#000000"/>
        <path d="M60 32c-3-3-8-4-12-4s-10 2-10 6 3 5 8 7c8 3 14 5 14 12s-6 11-14 11c-9 0-14-4-16-9" stroke="#FFF" strokeWidth="8" strokeLinecap="round" fill="none"/>
      </svg>
    );
  }
  return null;
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
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl overflow-hidden ring-1 ring-zinc-200 dark:ring-white/10 bg-white shadow-sm p-1.5">
              <MarketplaceLogo marketplace={status.marketplace} className="h-full w-full object-contain" />
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

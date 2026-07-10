'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { Loader2, Crown, ChevronDown, Check, Zap, Pencil, Shield, ShieldOff, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { adminSetPlan, adminUpdateUser } from './actions';
import type { PlanType } from '@/lib/plans';
import type { PlanOption } from './actions';

function slugToLabel(slug: string): string {
  return slug.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export interface UserRow {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  is_admin: boolean;
  plan: PlanType;
  plan_started_at: string | null;
  plan_expires_at: string | null;
  plan_is_expired: boolean;
  subscription_id: string | null;
  daily_dispatch_count: number;
}

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

const EXPIRY_OPTIONS = [
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
  { label: '1 ano', days: 365 },
  { label: 'Sem expiração', days: null },
];

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

const PLAN_BADGE_CLASS: Record<string, string> = {
  trial: 'text-zinc-400 bg-zinc-800/60 border-zinc-700/40',
  basico: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  basico_anual: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  profissional: 'text-indigo-300 bg-indigo-500/15 border-indigo-500/25',
  profissional_anual: 'text-indigo-300 bg-indigo-500/15 border-indigo-500/25',
  premium: 'text-violet-300 bg-violet-500/15 border-violet-500/25',
  premium_anual: 'text-violet-300 bg-violet-500/15 border-violet-500/25',
};

function getPlanBadgeClass(slug: string): string {
  return PLAN_BADGE_CLASS[slug] ?? 'text-zinc-400 bg-zinc-800/60 border-zinc-700/40';
}

function PlanDropdown({
  currentPlan,
  plans,
  isPending,
  onSetPlan,
}: {
  currentPlan: PlanType;
  plans: PlanOption[];
  isPending: boolean;
  onSetPlan: (plan: PlanType, days: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const activePlans = plans.filter((p) => p.ativo);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 text-xs rounded-lg border border-zinc-700/60 bg-zinc-800/60 px-3 py-1.5 text-zinc-300 hover:text-white hover:bg-zinc-700/60 hover:border-zinc-600 transition-all disabled:opacity-50 whitespace-nowrap"
      >
        {isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <>
            Alterar plano
            <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-1 z-50 w-64 rounded-xl border border-zinc-700/60 bg-zinc-900 shadow-2xl max-h-80 overflow-y-auto">
          <div className="px-3 py-2 border-b border-zinc-800/60 sticky top-0 bg-zinc-900">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium">Definir plano</p>
          </div>

          {activePlans.map((plan) => (
            <div key={plan.slug}>
              <div className="px-3 pt-2 pb-1 border-t border-zinc-800/40 first:border-t-0">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wide">{plan.nome} por...</p>
              </div>
              {EXPIRY_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => { onSetPlan(plan.slug, opt.days); setOpen(false); }}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs text-indigo-400/80 hover:bg-indigo-500/10 hover:text-indigo-300 transition-colors"
                >
                  <span>{plan.nome} — {opt.label}</span>
                  {currentPlan === plan.slug && <Check className="h-3 w-3 text-indigo-400" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EditUserSheet({
  user,
  open,
  onOpenChange,
}: {
  user: UserRow;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [displayName, setDisplayName] = useState('');
  const [isAdmin, setIsAdmin] = useState(user.is_admin);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await adminUpdateUser(user.id, {
        display_name: displayName || undefined,
        is_admin: isAdmin,
      });
      if (res.ok) {
        onOpenChange(false);
      } else {
        setError(res.error ?? 'Erro desconhecido');
      }
    });
  }

  const fieldClass =
    'bg-zinc-800/60 border-zinc-700/60 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-0 focus-visible:border-zinc-500 transition-colors text-sm';
  const labelClass = 'text-[11px] font-medium text-zinc-400 uppercase tracking-wide';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-sm bg-zinc-950 border-zinc-800/60">
        <SheetHeader className="mb-5">
          <SheetTitle className="text-white text-base">Editar usuário</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
            <div className="space-y-1.5">
              <Label className={labelClass}>E-mail</Label>
              <Input value={user.email} disabled className={`${fieldClass} opacity-50 cursor-not-allowed`} />
            </div>

            <div className="space-y-1.5">
              <Label className={labelClass}>Nome de exibição</Label>
              <Input
                value={displayName}
                onChange={(e) => { setDisplayName(e.target.value); setError(null); }}
                placeholder="Nome do usuário"
                className={fieldClass}
              />
              <p className="text-[10px] text-zinc-600">Deixe vazio para não alterar.</p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Permissões</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-200 font-medium">Acesso admin</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">
                  Libera o painel /admin para este usuário.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAdmin((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  isAdmin
                    ? 'bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25'
                    : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700/60'
                }`}
              >
                {isAdmin ? (
                  <><Shield className="h-3.5 w-3.5" /> Admin</>
                ) : (
                  <><ShieldOff className="h-3.5 w-3.5" /> Comum</>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="flex-1 border-zinc-700/60 bg-zinc-800/40 text-zinc-300 hover:bg-zinc-700/60 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="flex-1 bg-zinc-100 text-zinc-900 hover:bg-white font-medium"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function UserPlanRow({ user, plans }: { user: UserRow; plans: PlanOption[] }) {
  const [isPending, startTransition] = useTransition();
  const [currentPlan, setCurrentPlan] = useState<PlanType>(user.plan);
  const [startedAt, setStartedAt] = useState<string | null>(user.plan_started_at);
  const [expiresAt, setExpiresAt] = useState<string | null>(user.plan_expires_at);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  function handleSetPlan(plan: PlanType, days: number | null) {
    const expiry = days !== null ? addDays(days) : null;
    const now = new Date().toISOString();
    startTransition(async () => {
      const res = await adminSetPlan(user.id, plan, expiry);
      if (res.ok) {
        setCurrentPlan(plan);
        setExpiresAt(expiry);
        setStartedAt(now);
        setFeedback(`✓ ${slugToLabel(plan)} ativado`);
      } else {
        setFeedback(`Erro: ${res.error}`);
      }
      setTimeout(() => setFeedback(null), 3000);
    });
  }

  const isPaid = currentPlan !== 'trial';
  const badgeClass = getPlanBadgeClass(currentPlan);

  return (
    <>
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-4 space-y-3 hover:border-zinc-700/60 transition-colors">

        {/* Row 1: email + badges + actions */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {user.is_admin && (
                <span className="shrink-0 text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded uppercase">
                  Admin
                </span>
              )}
              <p className="text-sm text-zinc-100 truncate font-medium">{user.email}</p>
            </div>
            <p className="text-[10px] text-zinc-600 mt-0.5">
              Cadastro: {fmt(user.created_at)}
              {user.last_sign_in_at && (
                <> · Último login: {fmt(user.last_sign_in_at)}</>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditOpen(true)}
              className="h-7 px-2 text-zinc-500 hover:text-white hover:bg-zinc-800/60"
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold border px-2.5 py-1 rounded-full ${badgeClass}`}>
              {isPaid && <Crown className="h-3 w-3" />}
              {slugToLabel(currentPlan)}
            </span>
          </div>
        </div>

        {/* Row 2: plan details */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-zinc-800/40 px-3 py-2">
            <p className="text-[9px] text-zinc-600 uppercase tracking-wide mb-0.5">Ativação</p>
            <p className="text-xs text-zinc-300">{fmt(startedAt)}</p>
          </div>
          <div className="rounded-lg bg-zinc-800/40 px-3 py-2">
            <p className="text-[9px] text-zinc-600 uppercase tracking-wide mb-0.5">Expira em</p>
            <p className={`text-xs ${user.plan_is_expired ? 'text-amber-400' : 'text-zinc-300'}`}>
              {expiresAt ? fmt(expiresAt) : isPaid ? 'Nunca' : '—'}
              {user.plan_is_expired && ' ⚠'}
            </p>
          </div>
          <div className="rounded-lg bg-zinc-800/40 px-3 py-2">
            <p className="text-[9px] text-zinc-600 uppercase tracking-wide mb-0.5">Disparos hoje</p>
            <p className="text-xs text-zinc-300 flex items-center gap-1">
              <Zap className="h-2.5 w-2.5 text-zinc-600" />
              {user.daily_dispatch_count}
            </p>
          </div>
        </div>

        {/* Row 3: subscription ID + plan action */}
        <div className="flex items-center justify-between gap-3 pt-0.5">
          <div className="min-w-0 flex-1">
            {user.subscription_id ? (
              <p className="text-[10px] text-zinc-600 font-mono truncate">
                ID: {user.subscription_id}
              </p>
            ) : (
              <p className="text-[10px] text-zinc-700">Sem ID de pagamento</p>
            )}
          </div>
          {feedback ? (
            <span className={`text-xs shrink-0 ${feedback.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>
              {feedback}
            </span>
          ) : (
            <PlanDropdown
              currentPlan={currentPlan}
              plans={plans}
              isPending={isPending}
              onSetPlan={handleSetPlan}
            />
          )}
        </div>
      </div>

      <EditUserSheet user={user} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { Pencil, Trash2, Users, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlanFormSheet } from './PlanFormSheet';
import { adminUpdatePlan, adminDeletePlan, type AdminPlanRow } from './actions';

const PERIODO_LABEL: Record<string, string> = {
  free: 'Gratuito',
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
};

function LimitBadge({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-zinc-800/50 px-3 py-2 min-w-[64px]">
      <span className="text-[9px] text-zinc-600 uppercase tracking-wide mb-0.5">{label}</span>
      <span className="text-xs font-semibold text-zinc-300 flex items-center gap-0.5">
        {value === null ? <span className="text-zinc-500 text-sm">∞</span> : value}
      </span>
    </div>
  );
}

export function PlanRow({ plan }: { plan: AdminPlanRow }) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [currentAtivo, setCurrentAtivo] = useState(plan.ativo);
  const [isPending, startTransition] = useTransition();

  function handleToggleAtivo() {
    startTransition(async () => {
      await adminUpdatePlan(plan.id, { ativo: !currentAtivo });
      setCurrentAtivo((v) => !v);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await adminDeletePlan(plan.id);
      if (res.ok) {
        setConfirmDelete(false);
      } else {
        setDeleteError(res.error ?? 'Erro ao excluir');
        setConfirmDelete(false);
      }
    });
  }

  const canDelete = plan.user_count === 0;

  return (
    <>
      <div
        className={`rounded-xl border bg-zinc-900/60 p-4 space-y-3 transition-colors ${
          currentAtivo
            ? 'border-zinc-800/60 hover:border-zinc-700/60'
            : 'border-zinc-800/30 opacity-60'
        }`}
      >
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-white">{plan.nome}</p>
              {plan.destaque && (
                <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase tracking-wide">
                  Destaque
                </span>
              )}
              {!currentAtivo && (
                <span className="text-[9px] font-bold text-zinc-600 bg-zinc-800/60 border border-zinc-700/30 px-1.5 py-0.5 rounded uppercase">
                  Inativo
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[10px] text-zinc-600 font-mono bg-zinc-800/60 px-1.5 py-0.5 rounded">
                {plan.slug}
              </span>
              <span className="text-[10px] text-zinc-500">
                {PERIODO_LABEL[plan.tipo_periodo] ?? plan.tipo_periodo}
              </span>
              {plan.periodo_dias && (
                <span className="text-[10px] text-zinc-600">{plan.periodo_dias}d</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* User count */}
            <div className="flex items-center gap-1 text-xs text-zinc-500 bg-zinc-800/60 px-2 py-1 rounded-lg">
              <Users className="h-3 w-3" />
              <span>{plan.user_count}</span>
            </div>
            {/* Valor */}
            <span className="text-sm font-semibold text-zinc-200">
              {plan.tipo_periodo === 'free'
                ? 'Grátis'
                : `R$ ${Number(plan.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            </span>
          </div>
        </div>

        {/* Limits */}
        <div className="flex gap-2 flex-wrap">
          <LimitBadge label="Grupos" value={plan.max_grupos} />
          <LimitBadge label="Markets" value={plan.max_marketplaces} />
          <LimitBadge label="Destinos/grupo" value={plan.max_destinos_grupo} />
        </div>

        {/* Delete error */}
        {deleteError && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            {deleteError}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800/40">
          {/* Toggle ativo */}
          <button
            type="button"
            onClick={handleToggleAtivo}
            disabled={isPending}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all disabled:opacity-50 ${
              currentAtivo
                ? 'border-zinc-700/60 bg-zinc-800/40 text-zinc-400 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
            }`}
          >
            {currentAtivo ? 'Inativar' : 'Ativar'}
          </button>

          <div className="flex items-center gap-2">
            {/* Edit */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditOpen(true)}
              className="h-8 px-3 text-zinc-400 hover:text-white hover:bg-zinc-800/60 text-xs"
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Editar
            </Button>

            {/* Delete */}
            {!confirmDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!canDelete) {
                    setDeleteError(
                      `${plan.user_count} usuário(s) estão neste plano. Mova-os para outro plano antes de excluir.`
                    );
                    return;
                  }
                  setDeleteError(null);
                  setConfirmDelete(true);
                }}
                className="h-8 px-3 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 text-xs"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Excluir
              </Button>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-500">Confirmar?</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="h-7 px-2.5 text-[11px] font-semibold border border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                >
                  Sim, excluir
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                  className="h-7 px-2.5 text-[11px] text-zinc-500 hover:text-white"
                >
                  Não
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <PlanFormSheet open={editOpen} onOpenChange={setEditOpen} plan={plan} />
    </>
  );
}

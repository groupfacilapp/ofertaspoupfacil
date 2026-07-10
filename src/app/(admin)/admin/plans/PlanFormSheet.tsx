'use client';

import { useState, useTransition } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { adminCreatePlan, adminUpdatePlan, type PlanFormData, type AdminPlanRow } from './actions';

const fieldClass =
  'bg-zinc-800/60 border-zinc-700/60 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-0 focus-visible:border-zinc-500 transition-colors text-sm';
const labelClass = 'text-[11px] font-medium text-zinc-400 uppercase tracking-wide';

const TIPO_PERIODO_OPTIONS = ['free', 'mensal', 'trimestral', 'semestral', 'anual'];

function numOrNull(v: string): number | null {
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

function floatOrNull(v: string): number | null {
  const n = parseFloat(v.replace(',', '.'));
  return isNaN(n) ? null : n;
}

type FormState = {
  slug: string;
  nome: string;
  descricao: string;
  valor: string;
  tipo_periodo: string;
  link_checkout: string;
  recursos: string;
  ativo: boolean;
  destaque: boolean;
  ordem_exibicao: string;
  max_grupos: string;
  max_marketplaces: string;
  max_destinos_grupo: string;
  periodo_dias: string;
  valor_mensal_equiv: string;
};

function planToForm(plan: AdminPlanRow): FormState {
  return {
    slug: plan.slug,
    nome: plan.nome,
    descricao: plan.descricao,
    valor: String(plan.valor),
    tipo_periodo: plan.tipo_periodo,
    link_checkout: plan.link_checkout,
    recursos: plan.recursos.join('\n'),
    ativo: plan.ativo,
    destaque: plan.destaque,
    ordem_exibicao: String(plan.ordem_exibicao),
    max_grupos: plan.max_grupos !== null ? String(plan.max_grupos) : '',
    max_marketplaces: plan.max_marketplaces !== null ? String(plan.max_marketplaces) : '',
    max_destinos_grupo: plan.max_destinos_grupo !== null ? String(plan.max_destinos_grupo) : '',
    periodo_dias: plan.periodo_dias !== null ? String(plan.periodo_dias) : '',
    valor_mensal_equiv: plan.valor_mensal_equiv !== null ? String(plan.valor_mensal_equiv) : '',
  };
}

const EMPTY_FORM: FormState = {
  slug: '', nome: '', descricao: '', valor: '0', tipo_periodo: 'mensal',
  link_checkout: '', recursos: '', ativo: true, destaque: false,
  ordem_exibicao: '10', max_grupos: '', max_marketplaces: '',
  max_destinos_grupo: '', periodo_dias: '30', valor_mensal_equiv: '',
};

function formToData(f: FormState): PlanFormData {
  return {
    slug: f.slug.trim().toLowerCase().replace(/\s+/g, '_'),
    nome: f.nome.trim(),
    descricao: f.descricao.trim(),
    valor: floatOrNull(f.valor) ?? 0,
    tipo_periodo: f.tipo_periodo,
    link_checkout: f.link_checkout.trim(),
    recursos: f.recursos.split('\n').map((s) => s.trim()).filter(Boolean),
    ativo: f.ativo,
    destaque: f.destaque,
    ordem_exibicao: numOrNull(f.ordem_exibicao) ?? 1,
    max_grupos: numOrNull(f.max_grupos),
    max_marketplaces: numOrNull(f.max_marketplaces),
    max_destinos_grupo: numOrNull(f.max_destinos_grupo),
    periodo_dias: numOrNull(f.periodo_dias),
    valor_mensal_equiv: floatOrNull(f.valor_mensal_equiv),
  };
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plan?: AdminPlanRow;
}

export function PlanFormSheet({ open, onOpenChange, plan }: Props) {
  const isEdit = !!plan;
  const [form, setForm] = useState<FormState>(plan ? planToForm(plan) : EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function set(key: keyof FormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.slug || !form.nome) {
      setError('Slug e Nome são obrigatórios.');
      return;
    }
    startTransition(async () => {
      const data = formToData(form);
      const res = isEdit
        ? await adminUpdatePlan(plan.id, data)
        : await adminCreatePlan(data);
      if (res.ok) {
        onOpenChange(false);
      } else {
        setError(res.error ?? 'Erro desconhecido');
      }
    });
  }

  const ToggleBtn = ({
    active,
    onToggle,
    labelOn,
    labelOff,
  }: {
    active: boolean;
    onToggle: () => void;
    labelOn: string;
    labelOff: string;
  }) => (
    <button
      type="button"
      onClick={onToggle}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
        active
          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
          : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-500 hover:text-zinc-300'
      }`}
    >
      {active ? labelOn : labelOff}
    </button>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-lg bg-zinc-950 border-zinc-800/60 overflow-y-auto"
      >
        <SheetHeader className="mb-5">
          <SheetTitle className="text-white text-base">
            {isEdit ? `Editar — ${plan.nome}` : 'Novo Plano'}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Identidade */}
          <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Identidade</p>

            <div className="space-y-1.5">
              <Label className={labelClass}>Slug (identificador único)</Label>
              <Input
                value={form.slug}
                onChange={(e) => set('slug', e.target.value)}
                placeholder="ex: profissional_anual"
                disabled={isEdit}
                className={`${fieldClass} ${isEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
              {isEdit && (
                <p className="text-[10px] text-zinc-600">Imutável — altera quebraria usuários existentes.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className={labelClass}>Nome exibido</Label>
              <Input
                value={form.nome}
                onChange={(e) => set('nome', e.target.value)}
                placeholder="ex: Profissional Anual"
                className={fieldClass}
              />
            </div>

            <div className="space-y-1.5">
              <Label className={labelClass}>Descrição curta</Label>
              <Input
                value={form.descricao}
                onChange={(e) => set('descricao', e.target.value)}
                placeholder="ex: Melhor custo-benefício"
                className={fieldClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className={labelClass}>Tipo de período</Label>
                <select
                  value={form.tipo_periodo}
                  onChange={(e) => set('tipo_periodo', e.target.value)}
                  className="w-full rounded-md border border-zinc-700/60 bg-zinc-800/60 text-zinc-100 text-sm px-3 py-2 focus:outline-none focus:border-zinc-500 transition-colors"
                >
                  {TIPO_PERIODO_OPTIONS.map((o) => (
                    <option key={o} value={o} className="bg-zinc-900">
                      {o}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className={labelClass}>Valor (R$)</Label>
                <Input
                  value={form.valor}
                  onChange={(e) => set('valor', e.target.value)}
                  placeholder="39.90"
                  className={fieldClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className={labelClass}>Valor mensal equiv. (R$)</Label>
                <Input
                  value={form.valor_mensal_equiv}
                  onChange={(e) => set('valor_mensal_equiv', e.target.value)}
                  placeholder="vazio = não mostrar"
                  className={fieldClass}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={labelClass}>Ordem exibição</Label>
                <Input
                  value={form.ordem_exibicao}
                  onChange={(e) => set('ordem_exibicao', e.target.value)}
                  placeholder="1"
                  className={fieldClass}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <ToggleBtn
                active={form.ativo}
                onToggle={() => set('ativo', !form.ativo)}
                labelOn="Ativo"
                labelOff="Inativo"
              />
              <ToggleBtn
                active={form.destaque}
                onToggle={() => set('destaque', !form.destaque)}
                labelOn="Destaque ✦"
                labelOff="Sem destaque"
              />
            </div>
          </section>

          {/* Limites */}
          <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              Limites <span className="text-zinc-700 normal-case font-normal">(vazio = ilimitado)</span>
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className={labelClass}>Máx. grupos</Label>
                <Input
                  value={form.max_grupos}
                  onChange={(e) => set('max_grupos', e.target.value)}
                  placeholder="∞"
                  className={fieldClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label className={labelClass}>Máx. marketplaces</Label>
                <Input
                  value={form.max_marketplaces}
                  onChange={(e) => set('max_marketplaces', e.target.value)}
                  placeholder="∞"
                  className={fieldClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label className={labelClass}>Máx. destinos/grupo</Label>
                <Input
                  value={form.max_destinos_grupo}
                  onChange={(e) => set('max_destinos_grupo', e.target.value)}
                  placeholder="∞"
                  className={fieldClass}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className={labelClass}>Período (dias)</Label>
              <Input
                value={form.periodo_dias}
                onChange={(e) => set('periodo_dias', e.target.value)}
                placeholder="30"
                className={fieldClass}
              />
              <p className="text-[10px] text-zinc-600">
                Usado para calcular data de expiração automaticamente ao ativar o plano.
              </p>
            </div>
          </section>

          {/* Marketing */}
          <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Marketing</p>

            <div className="space-y-1.5">
              <Label className={labelClass}>Link checkout</Label>
              <Input
                value={form.link_checkout}
                onChange={(e) => set('link_checkout', e.target.value)}
                placeholder="https://pay.hotmart.com/..."
                className={fieldClass}
              />
            </div>

            <div className="space-y-1.5">
              <Label className={labelClass}>Recursos (um por linha)</Label>
              <Textarea
                value={form.recursos}
                onChange={(e) => set('recursos', e.target.value)}
                placeholder={'Até 10 Grupos\nDisparos ilimitados\nSuporte por WhatsApp'}
                rows={5}
                className={`${fieldClass} resize-none`}
              />
            </div>
          </section>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
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
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isEdit ? (
                'Salvar alterações'
              ) : (
                'Criar plano'
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

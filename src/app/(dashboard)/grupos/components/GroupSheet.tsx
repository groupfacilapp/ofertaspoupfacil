'use client';

import { useState, useTransition, useEffect } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, Loader2, SlidersHorizontal, ChevronDown, ChevronUp, Clock, Store, MessageSquare, Users, Bot, Plus, X, Search } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createGroup, updateGroup, validateTelegramChatForGroup } from '../actions';
import type { GroupFormData } from '../actions';
import { TemplatePreview } from './TemplatePreview';

const fieldClass =
  'bg-zinc-800/60 border-zinc-700/60 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-0 focus-visible:border-zinc-500 transition-colors';
const labelClass = 'text-[10px] font-semibold text-zinc-500 uppercase tracking-widest';

const DEFAULT_TEMPLATE = `🔥 *{titulo}*

De ~R$ {preco_antigo}~ por *R$ {preco}* ({desconto}% OFF) 👊{cupom_line}{parcelamento_line}

Loja oficial — {marketplace}:
{link}
---
😱 *CORRE, VAI ACABAR!*

{titulo}

De ~R$ {preco_antigo}~ por apenas *R$ {preco}* 👊{cupom_line}{parcelamento_line}

{marketplace}: {link}
---
💡 Você viu essa oferta?

*{titulo}*

Por *R$ {preco}* ({desconto}% OFF) 👊{cupom_line}{parcelamento_line}

{marketplace} 👉 {link}`;

const MARKETPLACE_OPTIONS = [
  { value: 'amazon', label: 'Amazon BR', color: 'orange' },
  { value: 'mercadolivre', label: 'Mercado Livre', color: 'yellow' },
  { value: 'shopee', label: 'Shopee', color: 'red' },
  { value: 'aliexpress', label: 'AliExpress', color: 'rose' },
  { value: 'kabum', label: 'KaBuM!', color: 'blue' },
  { value: 'temu', label: 'Temu', color: 'orange' },
  { value: 'shein', label: 'Shein', color: 'pink' },
] as const;

const MP_STYLES: Record<string, { dot: string; border: string; bg: string; text: string }> = {
  amazon:       { dot: 'bg-orange-400', border: 'border-orange-500/40', bg: 'bg-orange-500/10', text: 'text-orange-300' },
  mercadolivre: { dot: 'bg-yellow-400', border: 'border-yellow-500/40', bg: 'bg-yellow-500/10', text: 'text-yellow-300' },
  shopee:       { dot: 'bg-red-400',    border: 'border-red-500/40',    bg: 'bg-red-500/10',    text: 'text-red-300'    },
  aliexpress:   { dot: 'bg-rose-400',   border: 'border-rose-500/40',   bg: 'bg-rose-500/10',   text: 'text-rose-300'   },
  kabum:        { dot: 'bg-blue-400',   border: 'border-blue-500/40',   bg: 'bg-blue-500/10',   text: 'text-blue-300'   },
  temu:         { dot: 'bg-orange-400', border: 'border-orange-500/40', bg: 'bg-orange-500/10', text: 'text-orange-300' },
  shein:        { dot: 'bg-pink-400',   border: 'border-pink-500/40',   bg: 'bg-pink-500/10',   text: 'text-pink-300'   },
};


interface GroupSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectedMarketplaces: string[];
  hasTelegramConnected: boolean;
  editGroup?: {
    id: string;
    name: string;
    marketplaces: string[];
    min_discount: number;
    min_price: number | null;
    max_price: number | null;
    min_sales: number;
    daily_limit: number;
    template_text: string | null;
    keywords: string[] | null;
    blocked_keywords: string[] | null;
    destinations: Array<{ target_id: string; target_name: string | null; channel_type: string }>;
  };
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-800/80 border border-zinc-700/40">
        <Icon className="h-3 w-3 text-zinc-400" />
      </div>
      <p className={labelClass}>{title}</p>
    </div>
  );
}

export function GroupSheet({ open, onOpenChange, connectedMarketplaces, hasTelegramConnected, editGroup }: GroupSheetProps) {
  const isEdit = !!editGroup;

  const [name, setName] = useState('');
  const [marketplaces, setMarketplaces] = useState<string[]>([]);
  const [useFilters, setUseFilters] = useState(true);
  const [minDiscount, setMinDiscount] = useState(20);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minSales, setMinSales] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(10);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [keywords, setKeywords] = useState('');
  const [blockedKeywords, setBlockedKeywords] = useState('');

  // WhatsApp Destinations
  const [waGroups, setWaGroups] = useState<Array<{ id: string; subject: string; size: number }>>([]);
  const [selectedDestinations, setSelectedDestinations] = useState<Record<string, string>>({});

  // Telegram Destinations
  const [selectedTgDestinations, setSelectedTgDestinations] = useState<Record<string, string>>({});
  const [tgChatInput, setTgChatInput] = useState('');
  const [tgValidating, setTgValidating] = useState(false);
  const [tgValidateError, setTgValidateError] = useState<string | null>(null);

  // Reset form whenever the sheet opens or editGroup changes
  useEffect(() => {
    if (!open) return;
    if (editGroup) {
      setName(editGroup.name);
      setMarketplaces(editGroup.marketplaces);
      setMinDiscount(editGroup.min_discount);
      setMinPrice(editGroup.min_price ? String(editGroup.min_price / 100) : '');
      setMaxPrice(editGroup.max_price ? String(editGroup.max_price / 100) : '');
      setMinSales(editGroup.min_sales);
      setDailyLimit(editGroup.daily_limit);
      setTemplate(editGroup.template_text ?? DEFAULT_TEMPLATE);
      setKeywords((editGroup.keywords ?? []).join(', '));
      setBlockedKeywords((editGroup.blocked_keywords ?? []).join(', '));
      setSelectedDestinations(
        Object.fromEntries(
          editGroup.destinations
            .filter((d) => d.channel_type !== 'telegram')
            .map((d) => [d.target_id, d.target_name ?? ''])
        )
      );
      setSelectedTgDestinations(
        Object.fromEntries(
          editGroup.destinations
            .filter((d) => d.channel_type === 'telegram')
            .map((d) => [d.target_id, d.target_name ?? ''])
        )
      );
      setUseFilters(
        editGroup.min_discount > 0 ||
        editGroup.min_price != null ||
        editGroup.max_price != null ||
        editGroup.min_sales > 0 ||
        (editGroup.keywords?.length ?? 0) > 0 ||
        (editGroup.blocked_keywords?.length ?? 0) > 0
      );
    } else {
      // New group defaults
      setName('');
      setMarketplaces(connectedMarketplaces.length > 0 ? connectedMarketplaces : ['amazon']);
      setMinDiscount(20);
      setMinPrice('');
      setMaxPrice('');
      setMinSales(0);
      setDailyLimit(10);
      setTemplate(DEFAULT_TEMPLATE);
      setKeywords('');
      setBlockedKeywords('');
      setSelectedDestinations({});
      setSelectedTgDestinations({});
      setTgChatInput('');
      setTgValidateError(null);
      setUseFilters(true);
      setWaGroupSearch('');
    }
  }, [open, editGroup]); // eslint-disable-line react-hooks/exhaustive-deps
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [waGroupSearch, setWaGroupSearch] = useState('');
  const [waInviteInput, setWaInviteInput] = useState('');
  const [waInviteLoading, setWaInviteLoading] = useState(false);
  const [waInviteError, setWaInviteError] = useState<string | null>(null);

  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showPreview, setShowPreview] = useState(false);

  async function loadWaGroups() {
    setLoadingGroups(true);
    setGroupsError(null);
    try {
      const res = await fetch('/api/grupos/whatsapp-groups');
      const data = await res.json();
      if (!res.ok || 'error' in data) {
        setGroupsError(data.error ?? 'Erro ao buscar grupos');
      } else {
        setWaGroups(data);
      }
    } catch (err) {
      setGroupsError(err instanceof Error ? err.message : 'Erro ao buscar grupos');
    }
    setLoadingGroups(false);
  }

  useEffect(() => {
    if (open) loadWaGroups();
  }, [open]);

  async function addGroupByInvite() {
    if (!waInviteInput.trim()) return;
    setWaInviteLoading(true);
    setWaInviteError(null);
    try {
      const res = await fetch(`/api/grupos/whatsapp-invite?link=${encodeURIComponent(waInviteInput.trim())}`);
      const data = await res.json();
      if (!res.ok || 'error' in data) {
        setWaInviteError(data.error ?? 'Erro ao buscar grupo pelo link');
      } else {
        toggleDestination(data.id, data.subject);
        setWaInviteInput('');
      }
    } catch (err) {
      setWaInviteError(err instanceof Error ? err.message : 'Erro ao buscar grupo pelo link');
    }
    setWaInviteLoading(false);
  }

  function toggleMarketplace(mp: string) {
    setMarketplaces((prev) =>
      prev.includes(mp) ? prev.filter((m) => m !== mp) : [...prev, mp]
    );
  }

  function toggleDestination(jid: string, subject: string) {
    setSelectedDestinations((prev) => {
      if (jid in prev) {
        const next = { ...prev };
        delete next[jid];
        return next;
      }
      return { ...prev, [jid]: subject };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const formData: GroupFormData = {
      name: name.trim(),
      marketplaces: marketplaces as Array<'amazon' | 'mercadolivre' | 'shopee' | 'aliexpress' | 'kabum' | 'temu' | 'shein'>,
      min_discount: useFilters ? minDiscount : 0,
      min_price: useFilters && minPrice ? Math.round(parseFloat(minPrice) * 100) : null,
      max_price: useFilters && maxPrice ? Math.round(parseFloat(maxPrice) * 100) : null,
      min_sales: useFilters ? minSales : 0,
      daily_limit: dailyLimit,
      template_text: template,
      keywords: useFilters
        ? keywords.split(',').map((k) => k.trim()).filter(Boolean)
        : [],
      blocked_keywords: useFilters
        ? blockedKeywords.split(',').map((k) => k.trim()).filter(Boolean)
        : [],
      destination_ids: Object.keys(selectedDestinations),
      destination_names: selectedDestinations,
      telegram_destination_ids: Object.keys(selectedTgDestinations),
      telegram_destination_names: selectedTgDestinations,
    };

    startTransition(async () => {
      const res = isEdit
        ? await updateGroup(editGroup!.id, formData)
        : await createGroup(formData);

      if (res.ok) {
        setResult({ ok: true, message: isEdit ? 'Grupo atualizado!' : 'Grupo criado com sucesso!' });
        setTimeout(() => {
          onOpenChange(false);
          setResult(null);
        }, 1200);
      } else {
        setResult({ ok: false, message: res.error ?? 'Erro ao salvar' });
      }
    });
  }

  // Filter MARKETPLACE_OPTIONS to only connected ones (or all if none connected)
  const availableMarketplaces = connectedMarketplaces.length > 0
    ? MARKETPLACE_OPTIONS.filter((mp) => connectedMarketplaces.includes(mp.value))
    : MARKETPLACE_OPTIONS;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[500px] sm:max-w-[500px] overflow-y-auto bg-zinc-950 border-zinc-800/60 flex flex-col gap-0 p-0">
        {/* Header */}
        <div className="relative border-b border-zinc-800/60 px-6 pt-8 pb-5">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />
          <SheetHeader className="text-left space-y-1">
            <SheetTitle className="text-base font-semibold text-indigo-400">
              {isEdit ? 'Editar grupo' : 'Novo grupo de disparo'}
            </SheetTitle>
            <SheetDescription className="text-xs text-zinc-500">
              Configure marketplaces, filtros, template e horários de disparo.
            </SheetDescription>
          </SheetHeader>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 px-6 pt-5 pb-6 space-y-6">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label className={labelClass}>Nome do grupo *</Label>
            <Input
              placeholder="ex: Eletrônicos com 30%+ OFF"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={fieldClass}
              required
            />
          </div>

          {/* Marketplaces */}
          <div>
            <SectionHeader icon={Store} title="Marketplaces" />
            {availableMarketplaces.length === 0 ? (
              <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5">
                Nenhum marketplace conectado. Configure em{' '}
                <a href="/marketplaces" className="underline hover:text-amber-300">Marketplaces</a>.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {availableMarketplaces.map((mp) => {
                  const s = MP_STYLES[mp.value];
                  const active = marketplaces.includes(mp.value);
                  return (
                    <button
                      key={mp.value}
                      type="button"
                      onClick={() => toggleMarketplace(mp.value)}
                      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-xs font-medium transition-all ${
                        active
                          ? `${s.border} ${s.bg} ${s.text}`
                          : 'border-zinc-800/60 bg-zinc-900/30 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400'
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full shrink-0 ${active ? s.dot : 'bg-zinc-700'}`} />
                      {mp.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Filtros */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <SectionHeader icon={SlidersHorizontal} title="Filtros de oferta" />
              <button
                type="button"
                onClick={() => setUseFilters((v) => !v)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all ${
                  useFilters
                    ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400'
                    : 'border-zinc-700/60 bg-zinc-800/40 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {useFilters ? (
                  <><ChevronUp className="h-3 w-3" /> Com filtros</>
                ) : (
                  <><ChevronDown className="h-3 w-3" /> Sem filtros</>
                )}
              </button>
            </div>

            {useFilters && (
              <div className="space-y-3 rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-500">Desconto mín. (%)</Label>
                    <Input
                      type="number" min="0" max="99"
                      value={minDiscount}
                      onChange={(e) => setMinDiscount(Number(e.target.value))}
                      className={fieldClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-500">Vendas mínimas</Label>
                    <Input
                      type="number" min="0"
                      value={minSales}
                      onChange={(e) => setMinSales(Number(e.target.value))}
                      className={fieldClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-500">Preço mín. (R$)</Label>
                    <Input
                      type="number" min="0" step="0.01"
                      placeholder="sem limite"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-500">Preço máx. (R$)</Label>
                    <Input
                      type="number" min="0" step="0.01"
                      placeholder="sem limite"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-500">
                    Keywords obrigatórias <span className="text-zinc-600">(vírgula)</span>
                  </Label>
                  <Input
                    placeholder="fone, celular, notebook"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-500">
                    Keywords bloqueadas <span className="text-zinc-600">(vírgula)</span>
                  </Label>
                  <Input
                    placeholder="livro, digital, ebook"
                    value={blockedKeywords}
                    onChange={(e) => setBlockedKeywords(e.target.value)}
                    className={fieldClass}
                  />
                </div>
              </div>
            )}

            {!useFilters && (
              <p className="text-xs text-zinc-600 bg-zinc-900/40 border border-zinc-800/60 rounded-lg px-3 py-2.5">
                Todas as ofertas disponíveis serão consideradas, sem restrição de desconto, preço ou categoria.
              </p>
            )}
          </div>

          {/* Volume */}
          <div>
            <SectionHeader icon={Clock} title="Volume" />
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-500">Máx. ofertas/dia</Label>
                <Input
                  type="number" min="1" max="500"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(Number(e.target.value))}
                  className={fieldClass}
                />
                <p className="text-[10px] text-zinc-600">O intervalo entre disparos é configurado em <a href="/automacoes" className="text-indigo-400 hover:text-indigo-300">Automações</a>.</p>
              </div>
            </div>
          </div>

          {/* Template */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <SectionHeader icon={MessageSquare} title="Template da mensagem" />
              <button
                type="button"
                onClick={() => setShowPreview((v) => !v)}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                {showPreview ? 'Ocultar preview' : 'Ver preview'}
              </button>
            </div>
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4 space-y-3">
              {/* Preset templates */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">Templates prontos</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    {
                      label: '🔥 Oferta direta',
                      value: `🔥 *{titulo}*\n\n💰 De ~R$ {preco_antigo}~ por *R$ {preco}* ({desconto}% OFF){cupom_line}{parcelamento_line}\n\n🛍️ {marketplace}\n🔗 {link}`,
                    },
                    {
                      label: '😱 Urgência',
                      value: `😱 *CORRE, VAI ACABAR!*\n\n{titulo}\n\nDe ~R$ {preco_antigo}~ por apenas *R$ {preco}* 👊{cupom_line}{parcelamento_line}\n\n{marketplace}: {link}`,
                    },
                    {
                      label: '💡 Casual',
                      value: `💡 Você viu essa oferta?\n\n*{titulo}*\n\nPor *R$ {preco}* ({desconto}% OFF) 👊{cupom_line}{parcelamento_line}\n\n{marketplace} 👉 {link}`,
                    },
                    {
                      label: '📦 Simples',
                      value: `📦 *{titulo}*\n\n💵 *R$ {preco}* ({desconto}% OFF){cupom_line}\n\n🔗 {link}`,
                    },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setTemplate(preset.value)}
                      className="text-left rounded-lg border border-zinc-700/60 bg-zinc-800/40 px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-700/60 hover:text-zinc-200 hover:border-zinc-600 transition-all"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setTemplate(DEFAULT_TEMPLATE)}
                  className="w-full text-left rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-3 py-2 text-xs text-indigo-400 hover:bg-indigo-500/10 transition-all"
                >
                  🎲 3 variantes aleatórias (recomendado) — evita mensagem repetida
                </button>
              </div>

              <Textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                rows={8}
                className={`${fieldClass} font-mono text-xs resize-y min-h-[160px]`}
              />
              <div className="flex flex-wrap gap-1">
                {['{titulo}', '{preco}', '{preco_antigo}', '{desconto}', '{link}', '{marketplace}', '{parcelamento_line}', '{cupom_line}', '{cupom}'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setTemplate((t) => t + v)}
                    className="rounded px-1.5 py-0.5 text-[10px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700/60 hover:bg-zinc-700 transition-colors"
                  >
                    {v}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-zinc-600 leading-relaxed">
                Separe variantes com <code className="bg-zinc-800 px-1 rounded">---</code> em linha própria — o sistema escolhe uma aleatoriamente por disparo.{' '}
                <code className="bg-zinc-800 px-1 rounded">{'{cupom_line}'}</code> aparece só quando houver cupom · <code className="bg-zinc-800 px-1 rounded">{'{parcelamento_line}'}</code> aparece só quando houver parcelamento.
              </p>
              {showPreview && <TemplatePreview template={template} />}
            </div>
          </div>

          {/* Grupos WhatsApp destino */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <SectionHeader icon={Users} title="Grupos WhatsApp destino" />
              <button
                type="button"
                onClick={loadWaGroups}
                disabled={loadingGroups}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <RefreshCw className={`h-3 w-3 ${loadingGroups ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>

            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4 space-y-2">
              {groupsError && (
                <>
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 space-y-1">
                    <p className="text-xs text-amber-400 font-medium">Muitos grupos — busca automática indisponível</p>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Sua conta tem muitos grupos no WhatsApp e a busca excedeu o tempo limite. Adicione grupos manualmente usando o link de convite do grupo.
                    </p>
                  </div>
                  {/* Manual invite link input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={waInviteInput}
                      onChange={(e) => { setWaInviteInput(e.target.value); setWaInviteError(null); }}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addGroupByInvite())}
                      placeholder="https://chat.whatsapp.com/..."
                      className="flex-1 rounded-lg border border-zinc-700/60 bg-zinc-800/60 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/60 transition-colors font-mono"
                    />
                    <button
                      type="button"
                      disabled={waInviteLoading || !waInviteInput.trim()}
                      onClick={addGroupByInvite}
                      className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400 hover:bg-emerald-500/15 transition-all disabled:opacity-50"
                    >
                      {waInviteLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      Adicionar
                    </button>
                  </div>
                  {waInviteError && (
                    <p className="text-xs text-red-400">{waInviteError}</p>
                  )}
                  <p className="text-[10px] text-zinc-600 leading-relaxed">
                    Abra o grupo no WhatsApp → Informações do grupo → Link de convite → Copie e cole aqui.
                  </p>
                </>
              )}

              {loadingGroups && (
                <div className="flex items-center gap-2 py-4 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                  <span className="text-xs text-zinc-500">Carregando grupos...</span>
                </div>
              )}

              {!loadingGroups && waGroups.length > 0 && (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
                    <input
                      type="text"
                      value={waGroupSearch}
                      onChange={(e) => setWaGroupSearch(e.target.value)}
                      placeholder="Pesquisar grupo..."
                      className="w-full rounded-lg border border-zinc-700/60 bg-zinc-800/60 pl-8 pr-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                    {waGroups
                      .filter((g) => g.subject.toLowerCase().includes(waGroupSearch.toLowerCase()))
                      .map((g) => {
                        const selected = g.id in selectedDestinations;
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => toggleDestination(g.id, g.subject)}
                            className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-all ${
                              selected
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                                : 'border-zinc-800/60 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
                            }`}
                          >
                            <span className="truncate text-left">{g.subject}</span>
                            <span className="shrink-0 text-zinc-600 ml-2">{g.size} membros</span>
                          </button>
                        );
                      })}
                    {waGroups.filter((g) => g.subject.toLowerCase().includes(waGroupSearch.toLowerCase())).length === 0 && (
                      <p className="text-xs text-zinc-600 text-center py-3">Nenhum grupo encontrado.</p>
                    )}
                  </div>
                </>
              )}

              {!loadingGroups && waGroups.length === 0 && !groupsError && (
                <p className="text-xs text-zinc-600 text-center py-3">
                  WhatsApp não conectado ou sem grupos disponíveis.
                </p>
              )}

              {/* Selected destinations (shown in all states) */}
              {Object.keys(selectedDestinations).length > 0 && (
                <div className="space-y-1 pt-1">
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">Grupos selecionados</p>
                  {Object.entries(selectedDestinations).map(([gid, gname]) => (
                    <div
                      key={gid}
                      className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs"
                    >
                      <span className="text-emerald-300 truncate">{gname || gid}</span>
                      <button
                        type="button"
                        onClick={() => toggleDestination(gid, gname)}
                        className="text-zinc-600 hover:text-red-400 transition-colors ml-2 shrink-0"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <p className="text-xs text-emerald-400">
                    {Object.keys(selectedDestinations).length} grupo(s) selecionado(s)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Grupos Telegram destino */}
          <div>
            <SectionHeader icon={Bot} title="Grupos / Canais Telegram" />
            {!hasTelegramConnected ? (
              <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4">
                <p className="text-xs text-zinc-500">
                  Bot Telegram não conectado.{' '}
                  <a href="/canais" className="text-sky-400 hover:text-sky-300 underline">
                    Configure em Canais →
                  </a>
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4 space-y-3">
                {/* Add chat by ID */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tgChatInput}
                    onChange={(e) => { setTgChatInput(e.target.value); setTgValidateError(null); }}
                    placeholder="-100123456789 ou @meucanal"
                    className="flex-1 rounded-lg border border-zinc-700/60 bg-zinc-800/60 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-sky-500/60 transition-colors font-mono"
                  />
                  <button
                    type="button"
                    disabled={tgValidating || !tgChatInput.trim()}
                    onClick={async () => {
                      setTgValidating(true);
                      setTgValidateError(null);
                      const res = await validateTelegramChatForGroup(tgChatInput.trim());
                      setTgValidating(false);
                      if (res.ok && res.title) {
                        const savedId = res.resolvedId ?? tgChatInput.trim();
                        setSelectedTgDestinations((prev) => ({ ...prev, [savedId]: res.title! }));
                        setTgChatInput('');
                      } else {
                        setTgValidateError(res.error ?? 'Chat não encontrado');
                      }
                    }}
                    className="flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-400 hover:bg-sky-500/15 transition-all disabled:opacity-50"
                  >
                    {tgValidating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    Adicionar
                  </button>
                </div>
                {tgValidateError && (
                  <p className="text-xs text-red-400">
                    {tgValidateError}
                    {tgValidateError.toLowerCase().includes('not found') && (
                      <span className="block mt-1 text-zinc-500">
                        Certifique-se de usar o ID do <strong className="text-zinc-400">grupo/canal</strong>, não o username do bot. O bot precisa ser admin do grupo.
                      </span>
                    )}
                  </p>
                )}
                <div className="rounded-lg border border-sky-500/10 bg-sky-500/5 p-2.5 space-y-1">
                  <p className="text-[10px] text-sky-400 font-medium">Como adicionar:</p>
                  <ol className="text-[10px] text-zinc-500 leading-relaxed list-decimal list-inside space-y-0.5">
                    <li>Adicione o bot <code className="bg-zinc-800 px-1 rounded text-zinc-400">@achadinhos_poupofertas_bot</code> ao seu grupo/canal</li>
                    <li>Torne-o administrador do grupo</li>
                    <li>Cole aqui o ID do <strong className="text-zinc-400">grupo</strong> (ex: <code className="bg-zinc-800 px-1 rounded">-1001234567890</code>), @username de canal público, ou link <code className="bg-zinc-800 px-1 rounded">t.me/username</code></li>
                  </ol>
                </div>
                {/* Selected Telegram destinations */}
                {Object.entries(selectedTgDestinations).length > 0 && (
                  <div className="space-y-1">
                    {Object.entries(selectedTgDestinations).map(([chatId, title]) => (
                      <div
                        key={chatId}
                        className="flex items-center justify-between rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-xs"
                      >
                        <div>
                          <span className="text-sky-300 font-medium">{title}</span>
                          <span className="text-zinc-600 ml-2 font-mono">{chatId}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTgDestinations((prev) => {
                              const next = { ...prev };
                              delete next[chatId];
                              return next;
                            });
                          }}
                          className="text-zinc-600 hover:text-red-400 transition-colors ml-2"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {result && (
            <div
              className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm ${
                result.ok
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}
            >
              {result.ok ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              )}
              {result.message}
            </div>
          )}

          <SheetFooter className="pt-2">
            <Button
              type="submit"
              disabled={isPending || marketplaces.length === 0}
              className="w-full bg-zinc-100 text-zinc-900 hover:bg-white font-medium transition-colors"
            >
              {isPending ? (
                <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Salvando...</>
              ) : (
                <>{isEdit ? 'Salvar alterações' : 'Criar grupo'}</>
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

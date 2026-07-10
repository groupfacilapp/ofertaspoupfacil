'use client';

import { useState, useTransition } from 'react';
import { Search, Zap, Loader2, AlertCircle, CheckCircle2, ImageOff, Tag, ShoppingCart, ExternalLink, Eye } from 'lucide-react';
import { fetchProductByUrl, sendManualDispatch } from '../actions';
import { formatMessage } from '@/lib/format-message';
import type { NormalizedOffer } from '@/lib/connectors/types';

interface Group {
  id: string;
  name: string;
  destinations_count: number;
  template_text?: string | null;
}

const MARKETPLACE_LABELS: Record<string, string> = {
  mercadolivre: 'Mercado Livre',
  amazon: 'Amazon BR',
  shopee: 'Shopee',
  aliexpress: 'AliExpress',
  kabum: 'KaBuM!',
};

function fmt(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

// Renders WhatsApp markdown to HTML (for preview)
function renderWhatsAppMarkdown(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
    .replace(/~(.*?)~/g, '<del>$1</del>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

function ProductPreview({ offer }: { offer: NormalizedOffer }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 overflow-hidden">
      <div className="flex gap-4 p-4">
        {/* Image */}
        <div className="flex-shrink-0 h-24 w-24 rounded-lg overflow-hidden bg-zinc-800/60 border border-zinc-800 flex items-center justify-center">
          {offer.imageUrl && !imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={offer.imageUrl}
              alt={offer.title}
              className="h-full w-full object-contain"
              onError={() => setImgError(true)}
            />
          ) : (
            <ImageOff className="h-6 w-6 text-zinc-600" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="text-sm font-medium text-zinc-100 leading-snug line-clamp-2">{offer.title}</p>

          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-xl font-bold text-white">R$ {fmt(offer.currentPrice)}</span>
            {offer.originalPrice && offer.originalPrice > offer.currentPrice && (
              <span className="text-xs text-zinc-500 line-through">R$ {fmt(offer.originalPrice)}</span>
            )}
            {offer.discountPercent && offer.discountPercent > 0 && (
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                -{offer.discountPercent}%
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-[10px] text-zinc-600">
            <span className="flex items-center gap-1">
              <ShoppingCart className="h-3 w-3" />
              {MARKETPLACE_LABELS[offer.marketplace] ?? offer.marketplace}
            </span>
            {offer.condition && (
              <span className="capitalize">{offer.condition}</span>
            )}
            {offer.sales && (
              <span>{offer.sales} vendidos</span>
            )}
          </div>

          <a
            href={offer.affiliateLink ?? offer.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <ExternalLink className="h-2.5 w-2.5" />
            Ver produto
          </a>
        </div>
      </div>

      {offer.affiliateLink && offer.affiliateLink !== offer.productUrl && (
        <div className="px-4 py-2 border-t border-zinc-800/60 flex items-center gap-1.5">
          <Tag className="h-3 w-3 text-emerald-400" />
          <span className="text-[10px] text-emerald-400">Link de afiliado gerado</span>
        </div>
      )}
    </div>
  );
}

function MessagePreview({ message }: { message: string }) {
  if (!message.trim()) return null;
  return (
    <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/40 p-3 space-y-1.5">
      <div className="flex items-center gap-1.5 mb-2">
        <Eye className="h-3 w-3 text-zinc-500" />
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Pré-visualização</p>
      </div>
      {/* WhatsApp-style bubble */}
      <div className="bg-[#1a2c35] rounded-xl rounded-tl-none px-3 py-2.5 max-w-xs">
        <div
          className="text-[12px] text-[#e9edef] leading-relaxed break-words"
          dangerouslySetInnerHTML={{ __html: renderWhatsAppMarkdown(message) }}
        />
      </div>
    </div>
  );
}

// Default template for manual dispatch — single variant, shows discount when available
const MANUAL_TEMPLATE = '{titulo}\n\n{preco_completo}{cupom_line}{parcelamento_line}\n\n{link}';

export function ManualDispatchClient({ groups }: { groups: Group[] }) {
  const [url, setUrl] = useState('');
  const [offer, setOffer] = useState<NormalizedOffer | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isFetching, startFetch] = useTransition();

  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [customMessage, setCustomMessage] = useState('');
  const [isSending, startSend] = useTransition();
  const [sendResult, setSendResult] = useState<{ sent: number; errors: string[] } | null>(null);

  function handleFetch(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setOffer(null);
    setFetchError(null);
    setSendResult(null);
    setCustomMessage('');
    setSelectedGroups(new Set());

    startFetch(async () => {
      const res = await fetchProductByUrl(url.trim());
      if (res.ok && res.offer) {
        setOffer(res.offer);
        if (groups.length > 0) {
          setCustomMessage(formatMessage(MANUAL_TEMPLATE, res.offer));
        }
      } else {
        setFetchError(res.error ?? 'Erro desconhecido');
      }
    });
  }

  function toggleGroup(id: string) {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!offer || selectedGroups.size === 0) return;
    setSendResult(null);

    startSend(async () => {
      const res = await sendManualDispatch(offer, Array.from(selectedGroups), customMessage);
      if (res.ok) {
        setSendResult({ sent: res.sent, errors: res.errors });
        if (res.sent > 0) {
          setTimeout(() => {
            setOffer(null);
            setUrl('');
            setSelectedGroups(new Set());
            setCustomMessage('');
            setSendResult(null);
          }, 3000);
        }
      }
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Disparo Manual</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Cole a URL de um produto e dispare para seus grupos agora.
        </p>
      </div>

      {/* URL Input */}
      <form onSubmit={handleFetch} className="space-y-3">
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://shopee.com.br/produto-i.123.456"
            className="flex-1 rounded-xl border border-zinc-700/60 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/60 transition-colors"
            required
          />
          <button
            type="submit"
            disabled={isFetching || !url.trim()}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-3 transition-colors disabled:opacity-50 shrink-0"
          >
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar
          </button>
        </div>
        <p className="text-[11px] text-zinc-600">
          Suportado: Mercado Livre · Amazon · Shopee · AliExpress · KaBuM
        </p>
      </form>

      {/* Fetch Error */}
      {fetchError && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{fetchError}</p>
        </div>
      )}

      {/* Product Preview + Dispatch Form */}
      {offer && (
        <form onSubmit={handleSend} className="space-y-5">
          {/* Product */}
          <div>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">Produto encontrado</p>
            <ProductPreview offer={offer} />
          </div>

          {/* Message editor + preview */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Mensagem</p>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={7}
              className="w-full rounded-xl border border-zinc-700/60 bg-zinc-900/60 px-4 py-3 text-xs text-zinc-100 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/60 transition-colors resize-y"
              placeholder="Personalize a mensagem ou deixe em branco para usar o template do grupo..."
            />
            <p className="text-[10px] text-zinc-600">Suporta *negrito*, ~tachado~, _itálico_, emojis. Deixe em branco para usar o template de cada grupo.</p>

            {/* Live preview */}
            {customMessage.trim() && (
              <MessagePreview message={customMessage} />
            )}
          </div>

          {/* Group selection */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Enviar para</p>
            {groups.length === 0 ? (
              <p className="text-xs text-zinc-600 rounded-xl border border-zinc-800/60 bg-zinc-900/30 px-4 py-3">
                Nenhum grupo ativo. <a href="/grupos" className="text-indigo-400 hover:text-indigo-300">Crie um grupo</a>.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {groups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGroup(g.id)}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition-all text-left ${
                      selectedGroups.has(g.id)
                        ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300'
                        : 'border-zinc-800/60 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                    }`}
                  >
                    <span className="font-medium truncate">{g.name}</span>
                    <span className="text-[10px] text-zinc-600 shrink-0 ml-2">
                      {g.destinations_count} destino{g.destinations_count !== 1 ? 's' : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Send result */}
          {sendResult && (
            <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
              sendResult.sent > 0
                ? 'border-emerald-500/20 bg-emerald-500/5'
                : 'border-red-500/20 bg-red-500/5'
            }`}>
              {sendResult.sent > 0
                ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                : <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              }
              <div className="space-y-1">
                {sendResult.sent > 0 && (
                  <p className="text-sm text-emerald-400">
                    {sendResult.sent} mensagem{sendResult.sent !== 1 ? 's' : ''} enviada{sendResult.sent !== 1 ? 's' : ''}!
                  </p>
                )}
                {sendResult.errors.length > 0 && (
                  <ul className="space-y-0.5">
                    {sendResult.errors.map((e, i) => (
                      <li key={i} className="text-xs text-red-400">{e}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Send button */}
          <button
            type="submit"
            disabled={isSending || selectedGroups.size === 0}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-6 py-3.5 transition-colors disabled:opacity-50"
          >
            {isSending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
            ) : (
              <><Zap className="h-4 w-4" /> Disparar agora</>
            )}
          </button>
          {selectedGroups.size === 0 && (
            <p className="text-xs text-zinc-600 text-center -mt-3">Selecione ao menos um grupo para enviar</p>
          )}
        </form>
      )}
    </div>
  );
}

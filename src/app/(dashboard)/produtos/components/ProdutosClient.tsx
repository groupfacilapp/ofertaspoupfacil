'use client';

import { useState, useMemo, useTransition, useEffect } from 'react';
import { Package, Loader2, ExternalLink, Trash2, Search, RefreshCw, Send, X, Eye, LayoutGrid, List, CheckSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { sendProduct, clearSentProducts, searchProducts, removeProduct, removeProducts } from '../actions';

interface ProductItem {
  id: string;
  marketplace: string;
  title: string;
  current_price: number;
  original_price: number | null;
  discount_percent: number | null;
  image_url: string | null;
  product_url: string;
  affiliate_link: string | null;
  fetched_at: string;
  status: 'pending' | 'sent' | 'failed';
  last_dispatched_at?: string | null;
  last_dispatched_status?: string | null;
}

interface DispatchGroup {
  id: string;
  name: string;
  marketplaces: string[];
  template_text: string | null;
  destinationsCount: number;
}

interface ProdutosClientProps {
  products: ProductItem[];
  stats: { total: number; pending: number; sentToday: number };
  groups: DispatchGroup[];
  connectedMarketplaces: string[];
  totalItems: number;
  currentPage: number;
  pageSize: number;
  initialFilters: { marketplace: string; status: string; search: string };
}

const MARKETPLACE_LABEL: Record<string, string> = {
  amazon: 'Amazon',
  mercadolivre: 'Mercado Livre',
  shopee: 'Shopee',
  aliexpress: 'AliExpress',
  kabum: 'KaBuM!',
};

const MARKETPLACE_COLOR: Record<string, string> = {
  amazon: 'bg-orange-500/15 text-orange-400 border border-orange-500/20',
  mercadolivre: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20',
  shopee: 'bg-red-500/15 text-red-400 border border-red-500/20',
  aliexpress: 'bg-rose-500/15 text-rose-400 border border-rose-500/20',
  kabum: 'bg-blue-500/15 text-blue-400 border border-blue-500/20',
};

const ALL_MARKETPLACE_OPTIONS = [
  { value: 'amazon', label: 'Amazon BR' },
  { value: 'mercadolivre', label: 'Mercado Livre' },
  { value: 'shopee', label: 'Shopee' },
  { value: 'aliexpress', label: 'AliExpress' },
  { value: 'kabum', label: 'KaBuM!' },
] as const;

const ML_CATEGORIES = [
  { value: 'all', label: 'Todas as categorias' },
  { value: 'Computadores', label: 'Computadores' },
  { value: 'Celulares', label: 'Celulares' },
  { value: 'Eletrônicos', label: 'Eletrônicos' },
  { value: 'Casa e Decoração', label: 'Casa e Decoração' },
  { value: 'Esportes', label: 'Esportes' },
  { value: 'Beleza', label: 'Beleza' },
  { value: 'Games', label: 'Games' },
  { value: 'Brinquedos', label: 'Brinquedos' },
  { value: 'Roupas', label: 'Roupas e Moda' },
  { value: 'Eletrodomésticos', label: 'Eletrodomésticos' },
];

const SEARCH_LIMITS = [10, 20, 50];

const DEFAULT_PREVIEW_TEMPLATE = `🔥 *{titulo}*\n\n💰 De ~R$ {preco_antigo}~ por *R$ {preco}* ({desconto}% OFF)\n\n🛍️ {marketplace}\n🔗 {link}`;

const MP_LABEL: Record<string, string> = {
  amazon: 'Amazon BR',
  mercadolivre: 'Mercado Livre',
  shopee: 'Shopee',
  aliexpress: 'AliExpress',
  kabum: 'KaBuM!',
};

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function buildPreviewMessage(template: string | null, product: ProductItem): string {
  const t = template || DEFAULT_PREVIEW_TEMPLATE;
  // Use first variant only for preview
  const chosen = t.split(/\n---\n/)[0].trim();
  const preco = (product.current_price / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const precoAntigo = product.original_price
    ? (product.original_price / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    : preco;
  const link = product.affiliate_link ?? product.product_url;
  return chosen
    .replace(/\{titulo\}/g, product.title)
    .replace(/\{preco\}/g, preco)
    .replace(/\{preco_antigo\}/g, precoAntigo)
    .replace(/\{desconto\}/g, String(product.discount_percent ?? 0))
    .replace(/\{link\}/g, link)
    .replace(/\{marketplace\}/g, MP_LABEL[product.marketplace] ?? product.marketplace)
    .replace(/\{cupom\}/g, '')
    .replace(/\{cupom_line\}/g, '')
    .replace(/\{pix_line\}/g, '')
    .replace(/\{parcelamento_line\}/g, '');
}

export function ProdutosClient({
  products: initialProducts,
  stats,
  groups,
  connectedMarketplaces,
  totalItems,
  currentPage,
  pageSize,
  initialFilters,
}: ProdutosClientProps) {
  const hasGroups = groups.length > 0;
  const router = useRouter();
  const searchParams = useSearchParams();

  // Local copies for optimistic updates (re-initialized via key prop on navigation)
  const [products, setProducts] = useState(initialProducts);
  const [currentStats, setCurrentStats] = useState(stats);

  // Search input — local state, debounced to URL
  const [searchInput, setSearchInput] = useState(initialFilters.search);

  // Filter values come from URL (via initialFilters prop)
  const marketplaceFilter = initialFilters.marketplace;
  const statusFilter = initialFilters.status as 'all' | 'pending' | 'sent';

  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const [clearing, setClearing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [removingBulk, setRemovingBulk] = useState(false);

  // Preview modal state
  const [previewProduct, setPreviewProduct] = useState<ProductItem | null>(null);

  // Manual search section state
  const [searchMp, setSearchMp] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchCategory, setSearchCategory] = useState('all');
  const [searchLimit, setSearchLimit] = useState(20);
  const [searchQuickFilter, setSearchQuickFilter] = useState<'none' | 'price50' | 'price100' | 'disc30' | 'disc50'>('none');
  const [isSearching, startSearchTransition] = useTransition();
  const [lastSearchResult, setLastSearchResult] = useState<string | null>(null);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const itemStart = totalItems === 0 ? 0 : Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const itemEnd = Math.min(currentPage * pageSize, totalItems);

  // Marketplace filter options: show connected ones + any present in current page
  const presentMarketplaces = useMemo(() => {
    const all = new Set(connectedMarketplaces);
    for (const p of products) all.add(p.marketplace);
    return Array.from(all).sort();
  }, [connectedMarketplaces, products]);

  const hasSentProducts = products.some((p) => p.status === 'sent') || currentStats.sentToday > 0;

  // ── URL navigation helper ──────────────────────────────────────────────────
  function navigate(updates: { mp?: string; status?: string; q?: string; page?: number }) {
    const params = new URLSearchParams(searchParams.toString());
    if ('mp' in updates) {
      if (!updates.mp || updates.mp === 'all') params.delete('mp');
      else params.set('mp', updates.mp);
    }
    if ('status' in updates) {
      if (!updates.status || updates.status === 'all') params.delete('status');
      else params.set('status', updates.status);
    }
    if ('q' in updates) {
      if (!updates.q) params.delete('q');
      else params.set('q', updates.q);
    }
    if ('page' in updates) {
      if (!updates.page || updates.page === 1) params.delete('page');
      else params.set('page', String(updates.page));
    }
    // Changing filters always resets to page 1
    if (!('page' in updates)) params.delete('page');
    const qs = params.toString();
    router.push(qs ? `/produtos?${qs}` : '/produtos');
  }

  // Debounce search navigation (400 ms)
  useEffect(() => {
    const currentQ = searchParams.get('q') ?? '';
    if (searchInput === currentQ) return;
    const timer = setTimeout(() => navigate({ q: searchInput || undefined }), 400);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleSend(product: ProductItem) {
    setPreviewProduct(product);
  }

  function handleSentSuccess(productId: string) {
    setProducts((prev) => prev.map((p) => p.id === productId ? { ...p, status: 'sent' as const } : p));
    setCurrentStats((prev) => ({
      ...prev,
      sentToday: prev.sentToday + 1,
      pending: Math.max(0, prev.pending - 1),
    }));
    setPreviewProduct(null);
  }

  async function handleRemove(product: ProductItem) {
    if (removing.has(product.id)) return;
    setRemoving((prev) => new Set(prev).add(product.id));
    try {
      const result = await removeProduct(product.id);
      if (result.success) {
        setProducts((prev) => prev.filter((p) => p.id !== product.id));
        setCurrentStats((prev) => {
          const isSent = product.status === 'sent';
          return {
            ...prev,
            total: prev.total - 1,
            sentToday: isSent ? Math.max(0, prev.sentToday - 1) : prev.sentToday,
            pending: isSent ? prev.pending : Math.max(0, prev.pending - 1),
          };
        });
        toast.success('Produto removido da fila');
      } else {
        toast.error(result.error ?? 'Erro ao remover produto');
      }
    } catch {
      toast.error('Erro inesperado');
    } finally {
      setRemoving((prev) => { const next = new Set(prev); next.delete(product.id); return next; });
    }
  }

  async function handleClear() {
    if (clearing || !hasSentProducts) return;
    setClearing(true);
    try {
      const result = await clearSentProducts();
      if (result.error) {
        toast.error(result.error);
      } else {
        setProducts((prev) => prev.filter((p) => p.status !== 'sent'));
        setCurrentStats((prev) => ({
          ...prev,
          total: prev.total - result.deleted,
          sentToday: Math.max(0, prev.sentToday - result.deleted),
        }));
        toast.success(result.deleted > 0 ? `${result.deleted} produto(s) removido(s)` : 'Nenhum para limpar');
      }
    } catch {
      toast.error('Erro ao limpar produtos enviados');
    } finally {
      setClearing(false);
    }
  }

  function handleToggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleSelectAll() {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  }

  function handleClearSelection() {
    setSelectedIds(new Set());
  }

  async function handleRemoveSelected() {
    if (removingBulk || selectedIds.size === 0) return;
    setRemovingBulk(true);
    try {
      const ids = Array.from(selectedIds);
      const result = await removeProducts(ids);
      if (result.success) {
        const removed = result.removed || ids.length;
        const removedProds = products.filter((p) => ids.includes(p.id));
        const sentCount = removedProds.filter((p) => p.status === 'sent').length;
        const pendingCount = removedProds.filter((p) => p.status !== 'sent').length;
        setProducts((prev) => prev.filter((p) => !ids.includes(p.id)));
        setCurrentStats((prev) => ({
          ...prev,
          total: Math.max(0, prev.total - removed),
          sentToday: Math.max(0, prev.sentToday - sentCount),
          pending: Math.max(0, prev.pending - pendingCount),
        }));
        setSelectedIds(new Set());
        toast.success(`${removed} produto(s) removido(s) da fila`);
        navigate({ page: 1 });
      } else {
        toast.error(result.error ?? 'Erro ao remover produtos');
      }
    } catch {
      toast.error('Erro inesperado ao remover produtos');
    } finally {
      setRemovingBulk(false);
    }
  }

  function handleSearch() {
    setLastSearchResult(null);
    const maxPrice =
      searchQuickFilter === 'price50' ? 5000 :
      searchQuickFilter === 'price100' ? 10000 : null;
    const minDiscount =
      searchQuickFilter === 'disc30' ? 30 :
      searchQuickFilter === 'disc50' ? 50 : 0;

    startSearchTransition(async () => {
      const result = await searchProducts({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        marketplace: searchMp as any,
        keyword: searchKeyword.trim() || undefined,
        category: searchMp === 'mercadolivre' && searchCategory !== 'all' ? searchCategory : undefined,
        limit: searchLimit,
        minDiscount,
        maxPrice,
      });
      if (result.error) {
        toast.error(result.error);
        setLastSearchResult(`Erro: ${result.error}`);
      } else {
        const msg = `${result.found} encontrado(s), ${result.added} adicionado(s) à fila`;
        toast.success(msg);
        setLastSearchResult(msg);
        navigate({ page: 1 });
      }
    });
  }

  const selectClass = 'rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-indigo-500/60 transition-colors';

  return (
    <div className="max-w-7xl space-y-6">
      {/* ── Preview Modal ─────────────────────────────────────────────── */}
      {previewProduct && (
        <SendPreviewModal
          product={previewProduct}
          groups={groups.filter((g) => g.marketplaces.includes(previewProduct.marketplace))}
          onClose={() => setPreviewProduct(null)}
          onSentSuccess={handleSentSuccess}
        />
      )}

      {/* ── Buscar Produtos ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card dark:bg-zinc-900/40 dark:backdrop-blur-xl shadow-xl">
        <div className="px-6 py-5 border-b border-border flex items-center gap-2 relative z-10 bg-zinc-100/30 dark:bg-black/20">
          <Search className="h-5 w-5 text-indigo-400" />
          <h2 className="text-base font-bold text-foreground dark:text-white tracking-tight">Buscar Produtos</h2>
          <span className="text-xs font-medium text-muted-foreground ml-2 bg-zinc-100 dark:bg-zinc-800/50 px-2 py-0.5 rounded-full border border-border dark:border-zinc-700/50">busca manual sob demanda</span>
        </div>
        <div className="p-6 space-y-5 relative z-10">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">Marketplace</label>
              <select
                value={searchMp}
                onChange={(e) => { setSearchMp(e.target.value); setSearchCategory('all'); }}
                className={selectClass}
              >
                <option value="all">🌐 Todos os Marketplaces</option>
                {ALL_MARKETPLACE_OPTIONS.filter((mp) => connectedMarketplaces.includes(mp.value)).map((mp) => (
                  <option key={mp.value} value={mp.value}>{mp.label}</option>
                ))}
              </select>
            </div>

            {searchMp === 'mercadolivre' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">Categoria</label>
                <select value={searchCategory} onChange={(e) => setSearchCategory(e.target.value)} className={selectClass}>
                  {ML_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">Palavra-chave</label>
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Ex: fone bluetooth, smartwatch..."
                className="w-full rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-indigo-500/60 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">Qtd.</label>
              <select value={searchLimit} onChange={(e) => setSearchLimit(Number(e.target.value))} className={selectClass}>
                {SEARCH_LIMITS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 transition-colors"
            >
              {isSearching ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" />Buscando...</>
              ) : (
                <><RefreshCw className="h-3.5 w-3.5" />Buscar</>
              )}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider mr-1">Filtro rápido:</span>
            {([
              { key: 'none', label: 'Sem filtro' },
              { key: 'price50', label: '💰 Até R$50' },
              { key: 'price100', label: '💰 Até R$100' },
              { key: 'disc30', label: '🔥 +30% OFF' },
              { key: 'disc50', label: '🔥 +50% OFF' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSearchQuickFilter(key)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  searchQuickFilter === key
                    ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30'
                    : 'bg-zinc-100 dark:bg-zinc-800/40 text-muted-foreground border-border dark:border-zinc-700/40 hover:text-foreground dark:hover:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-600/60'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {lastSearchResult && !isSearching && (
            <p className="text-xs text-zinc-500">{lastSearchResult}</p>
          )}
        </div>
      </section>

      {/* ── Fila de Disparo ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card dark:bg-zinc-900/40 dark:backdrop-blur-xl shadow-xl">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between relative z-10 bg-zinc-100/30 dark:bg-black/20">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-indigo-400" />
            <h2 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">Fila de Disparo</h2>
            <span className="text-xs font-bold text-white bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30 ml-2">{currentStats.total}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700/50 bg-zinc-100 dark:bg-zinc-800/40 p-0.5 gap-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center justify-center h-6 w-6 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-indigo-600/30 text-indigo-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                title="Visualização em grade"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center justify-center h-6 w-6 rounded-md transition-colors ${viewMode === 'list' ? 'bg-indigo-600/30 text-indigo-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                title="Visualização em lista"
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              onClick={handleClear}
              disabled={clearing || !hasSentProducts}
              className="text-xs font-semibold text-zinc-400 hover:text-rose-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 bg-zinc-800/50 hover:bg-rose-500/10 border border-zinc-700/50 hover:border-rose-500/30 px-3 py-1.5 rounded-lg"
            >
              {clearing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Limpando...</> : 'Limpar enviados'}
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 relative z-10">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-zinc-100/40 dark:bg-black/20 backdrop-blur-sm p-4 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1 relative z-10">Total na fila</p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-white relative z-10">{currentStats.total}</p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-sm p-4 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />
              <p className="text-[10px] text-amber-500/70 font-bold uppercase tracking-wider mb-1 relative z-10">Pendentes</p>
              <p className="text-2xl font-bold text-amber-400 relative z-10">{currentStats.pending}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 backdrop-blur-sm p-4 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />
              <p className="text-[10px] text-emerald-500/70 font-bold uppercase tracking-wider mb-1 relative z-10">Enviados hoje</p>
              <p className="text-2xl font-bold text-emerald-400 relative z-10">{currentStats.sentToday}</p>
            </div>
          </div>

          {/* Filter tabs + search input */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {([
                { key: 'all', label: `Todos (${currentStats.total})` },
                { key: 'pending', label: `Pendentes (${currentStats.pending})` },
                { key: 'sent', label: `Enviados (${currentStats.sentToday})` },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => navigate({ status: key })}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    statusFilter === key
                      ? 'bg-indigo-600/15 text-indigo-300 border-indigo-500/20'
                      : 'bg-zinc-100 dark:bg-zinc-800/40 text-muted-foreground border-border dark:border-zinc-700/40 hover:text-foreground dark:hover:text-zinc-300 hover:border-zinc-400'
                  }`}
                >
                  {label}
                </button>
              ))}

              {presentMarketplaces.length > 0 && (
                <span className="border-l border-zinc-200 dark:border-zinc-700/60 mx-0.5 self-stretch" />
              )}

              {presentMarketplaces.map((mp) => (
                <button
                  key={mp}
                  onClick={() => navigate({ mp: marketplaceFilter === mp ? 'all' : mp })}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    marketplaceFilter === mp
                      ? 'bg-indigo-600/15 text-indigo-300 border-indigo-500/20'
                      : 'bg-zinc-100 dark:bg-zinc-800/40 text-muted-foreground border-border dark:border-zinc-700/40 hover:text-foreground dark:hover:text-zinc-300 hover:border-zinc-400'
                  }`}
                >
                  {MARKETPLACE_LABEL[mp] ?? mp}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar na fila..."
              className="rounded-lg border border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none focus:border-indigo-500/60 transition-colors w-full sm:w-52"
            />
          </div>

          {/* Bulk selection bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-indigo-500/20 bg-indigo-600/10 px-4 py-3">
              <div className="flex items-center gap-3">
                <CheckSquare className="h-4 w-4 text-indigo-400" />
                <span className="text-sm font-medium text-indigo-300">
                  {selectedIds.size} produto(s) selecionado(s)
                </span>
                <button
                  onClick={handleSelectAll}
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline transition-colors"
                >
                  {selectedIds.size === products.length ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearSelection}
                  className="text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700/50 bg-zinc-100 dark:bg-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-600/60"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRemoveSelected}
                  disabled={removingBulk}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {removingBulk ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" />Removendo...</>
                  ) : (
                    <><Trash2 className="h-3.5 w-3.5" />Excluir selecionados</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Grid / List / Empty */}
          {products.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/40 bg-zinc-50 dark:bg-zinc-900/20 p-10 text-center">
              <div className="flex justify-center mb-3">
                <div className="rounded-full bg-zinc-200/80 dark:bg-zinc-800/80 p-4">
                  <Package className="h-6 w-6 text-zinc-600" />
                </div>
              </div>
              <p className="text-sm font-medium text-zinc-400 mb-1">Nenhum produto encontrado</p>
              <p className="text-xs text-zinc-600 mb-4">
                {currentStats.total === 0
                  ? 'Use a busca acima ou configure automações para coletar produtos'
                  : 'Tente ajustar os filtros'}
              </p>
              {currentStats.total === 0 && (
                <Link
                  href="/automacoes"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 transition-colors"
                >
                  Configurar automações
                </Link>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAll}
                  className={`flex items-center justify-center h-5 w-5 rounded border transition-all shrink-0 ${
                    selectedIds.size === products.length && products.length > 0
                      ? 'bg-indigo-600 border-indigo-500'
                      : selectedIds.size > 0
                      ? 'bg-indigo-600/40 border-indigo-500/60'
                      : 'bg-zinc-100 dark:bg-zinc-800/60 border-zinc-300 dark:border-zinc-600/60 hover:border-indigo-500/60'
                  }`}
                  title="Marcar / desmarcar todos"
                >
                  {selectedIds.size > 0 && (
                    <span className="text-white text-[10px] font-bold leading-none">
                      {selectedIds.size === products.length ? '✓' : '–'}
                    </span>
                  )}
                </button>
                <span className="text-xs text-zinc-500">
                  {selectedIds.size === products.length && products.length > 0
                    ? 'Todos selecionados'
                    : `Marcar todos (${products.length})`}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    hasGroups={hasGroups}
                    isRemoving={removing.has(product.id)}
                    isSelected={selectedIds.has(product.id)}
                    onSend={() => handleSend(product)}
                    onRemove={() => handleRemove(product)}
                    onToggleSelect={() => handleToggleSelect(product.id)}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-800/40 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-2.5 bg-zinc-100/50 dark:bg-zinc-800/30">
                <button
                  onClick={handleSelectAll}
                  className={`shrink-0 flex items-center justify-center h-5 w-5 rounded border transition-all ${
                    selectedIds.size === products.length && products.length > 0
                      ? 'bg-indigo-600 border-indigo-500'
                      : selectedIds.size > 0
                      ? 'bg-indigo-600/40 border-indigo-500/60'
                      : 'bg-zinc-100 dark:bg-zinc-800/60 border-zinc-300 dark:border-zinc-600/60 hover:border-indigo-500/60'
                  }`}
                  title="Marcar / desmarcar todos"
                >
                  {selectedIds.size > 0 && (
                    <span className="text-white text-[10px] font-bold leading-none">
                      {selectedIds.size === products.length ? '✓' : '–'}
                    </span>
                  )}
                </button>
                <span className="text-xs font-medium text-zinc-500">
                  {selectedIds.size === products.length && products.length > 0
                    ? `Todos selecionados (${products.length})`
                    : `Marcar todos (${products.length})`}
                </span>
              </div>
              {products.map((product) => (
                <ProductListItem
                  key={product.id}
                  product={product}
                  hasGroups={hasGroups}
                  isRemoving={removing.has(product.id)}
                  isSelected={selectedIds.has(product.id)}
                  onSend={() => handleSend(product)}
                  onRemove={() => handleRemove(product)}
                  onToggleSelect={() => handleToggleSelect(product.id)}
                />
              ))}
            </div>
          )}

          {/* ── Paginação ────────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800/40">
              <p className="text-xs text-zinc-500 order-2 sm:order-1">
                Exibindo <span className="text-zinc-900 dark:text-zinc-300 font-medium">{itemStart}–{itemEnd}</span> de{' '}
                <span className="text-zinc-900 dark:text-zinc-300 font-medium">{totalItems}</span> produto(s)
              </p>
              <div className="flex items-center gap-1 order-1 sm:order-2">
                <button
                  onClick={() => navigate({ page: currentPage - 1 })}
                  disabled={currentPage <= 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700/50 bg-zinc-100 dark:bg-zinc-800/40 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Anterior
                </button>

                {/* Page number pills */}
                <div className="flex items-center gap-1 mx-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                      if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
                        acc.push('...');
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      item === '...' ? (
                        <span key={`ellipsis-${idx}`} className="px-1 text-xs text-zinc-600">…</span>
                      ) : (
                        <button
                          key={item}
                          onClick={() => navigate({ page: item as number })}
                          className={`min-w-[28px] h-7 rounded-lg border text-xs font-medium transition-colors ${
                            currentPage === item
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'border-zinc-200 dark:border-zinc-700/50 bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-zinc-600'
                          }`}
                        >
                          {item}
                        </button>
                      )
                    )}
                </div>

                <button
                  onClick={() => navigate({ page: currentPage + 1 })}
                  disabled={currentPage >= totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700/50 bg-zinc-100 dark:bg-zinc-800/40 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Próxima
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ProductCard({
  product,
  hasGroups,
  isRemoving,
  isSelected,
  onSend,
  onRemove,
  onToggleSelect,
}: {
  product: ProductItem;
  hasGroups: boolean;
  isRemoving: boolean;
  isSelected: boolean;
  onSend: () => void;
  onRemove: () => void;
  onToggleSelect: () => void;
}) {
  const isSent = product.status === 'sent';
  const isFailed = product.status === 'failed';
  const isDisabled = isSent || !hasGroups;
  const productLink = product.affiliate_link ?? product.product_url;
  const mpColor = MARKETPLACE_COLOR[product.marketplace] ?? 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/40';

  return (
    <div className={`relative group overflow-hidden rounded-2xl border bg-card dark:bg-zinc-900/40 dark:backdrop-blur-xl transition-all duration-300 hover:border-indigo-500/40 hover:shadow-[0_0_30px_rgba(99,102,241,0.1)] flex flex-col ${isSelected ? 'border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.15)]' : 'border-border dark:border-zinc-800/60'}`}>
      {/* Ambient background glow on hover */}
      <div className="absolute -inset-24 rounded-[50%] blur-[80px] bg-gradient-to-tr from-indigo-500/0 to-violet-500/0 opacity-0 group-hover:from-indigo-500/10 group-hover:to-violet-500/10 group-hover:opacity-100 transition-all duration-700 pointer-events-none" />

      {/* Image */}
      <div className="h-44 bg-zinc-50 dark:bg-black/30 relative flex items-center justify-center overflow-hidden border-b border-border dark:border-zinc-800/60 group-hover:bg-zinc-100 dark:group-hover:bg-black/40 transition-colors">
        {product.image_url ? (
          <img src={product.image_url} alt={product.title} className="h-full w-full object-contain p-4 mix-blend-screen" />
        ) : (
          <Package className="h-10 w-10 text-zinc-700" />
        )}
        {/* Checkbox — top-left, always visible on hover or when selected */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
          className={`absolute top-2.5 left-2.5 flex items-center justify-center h-5 w-5 rounded border transition-all z-10 ${
            isSelected
              ? 'bg-indigo-600 border-indigo-500 opacity-100'
              : 'bg-zinc-100 dark:bg-zinc-900/80 border-zinc-300 dark:border-zinc-600/60 opacity-0 group-hover:opacity-100'
          }`}
          title={isSelected ? 'Desmarcar' : 'Selecionar'}
        >
          {isSelected && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
        </button>
        {/* Marketplace badge */}
        <span className={`absolute top-3 left-9 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md shadow-sm ${mpColor}`}>
          {MARKETPLACE_LABEL[product.marketplace] ?? product.marketplace}
        </span>
        {/* Actions overlay — visible on hover */}
        <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <a
            href={productLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center h-6 w-6 rounded-md bg-zinc-100 dark:bg-zinc-900/90 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
            title="Ver produto"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3" />
          </a>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            disabled={isRemoving}
            className="flex items-center justify-center h-6 w-6 rounded-md bg-zinc-100 dark:bg-zinc-900/90 text-zinc-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-50"
            title="Remover da fila"
          >
            {isRemoving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1 relative z-10">
        <p className="text-xs font-semibold text-foreground dark:text-zinc-200 line-clamp-2 mb-3 leading-relaxed">{product.title}</p>

        {/* Price */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">{formatPrice(product.current_price)}</span>
          {product.original_price && product.original_price > product.current_price && (
            <span className="text-xs font-medium text-zinc-600 line-through">{formatPrice(product.original_price)}</span>
          )}
        </div>

        {/* Discount + status */}
        <div className="flex items-center flex-wrap gap-1.5 mb-4">
          {product.discount_percent && product.discount_percent > 0 ? (
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-1.5 py-0.5 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
              -{product.discount_percent}%
            </span>
          ) : null}
          {isSent && (
            <span className="text-[10px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 border bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
              ✓ Enviado
            </span>
          )}
          {isFailed && (
            <span className="text-[10px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 border bg-rose-500/10 border-rose-500/20 text-rose-400">
              Falhou
            </span>
          )}
          {!isSent && !isFailed && (
            <span className="text-[10px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 border bg-amber-500/10 border-amber-500/20 text-amber-500">
              Pendente
            </span>
          )}
        </div>

        {/* Last Dispatched at (7 day control) */}
        {product.last_dispatched_at && (() => {
          const isRecentlySent = (Date.now() - new Date(product.last_dispatched_at).getTime()) < 7 * 24 * 3600 * 1000;
          return (
            <div className="mb-3">
              <div className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-lg border shadow-sm transition-all ${
                isRecentlySent
                  ? 'bg-zinc-100 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/30 text-zinc-400 dark:text-zinc-500' // Neutral
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' // Available
              }`}>
                <Package className="h-2.5 w-2.5 opacity-60" />
                <span>Envio: {new Date(product.last_dispatched_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                {!isRecentlySent && <span className="ml-1 text-[8px] opacity-70">(Disponível para re-envio)</span>}
              </div>
            </div>
          );
        })()}

        <div className="flex-1" />

        {/* Send button — opens preview modal */}
        <button
          onClick={onSend}
          disabled={isDisabled}
          className={`w-full text-xs font-semibold tracking-wide rounded-xl py-2.5 transition-all flex items-center justify-center gap-1.5 border shadow-sm ${
            isSent
              ? 'bg-zinc-100 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/40 text-zinc-400 dark:text-zinc-500 cursor-default shadow-none'
              : !hasGroups
              ? 'bg-zinc-100 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/40 text-zinc-400 dark:text-zinc-600 cursor-not-allowed shadow-none'
              : 'bg-indigo-600 border-indigo-500 hover:bg-indigo-500 text-white hover:shadow-[0_4px_14px_0_rgba(99,102,241,0.39)]'
          }`}
        >
          {isSent ? (
            'Enviado'
          ) : !hasGroups ? (
            'Configure um grupo'
          ) : (
            <><Eye className="h-3.5 w-3.5" />Preview & Enviar</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Product List Item (list view) ────────────────────────────────────────────

function ProductListItem({
  product,
  hasGroups,
  isRemoving,
  isSelected,
  onSend,
  onRemove,
  onToggleSelect,
}: {
  product: ProductItem;
  hasGroups: boolean;
  isRemoving: boolean;
  isSelected: boolean;
  onSend: () => void;
  onRemove: () => void;
  onToggleSelect: () => void;
}) {
  const isSent = product.status === 'sent';
  const isFailed = product.status === 'failed';
  const isDisabled = isSent || !hasGroups;
  const productLink = product.affiliate_link ?? product.product_url;
  const mpColor = MARKETPLACE_COLOR[product.marketplace] ?? 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/40';

  return (
    <div className={`flex items-center gap-3 px-4 py-3 transition-colors border-b border-border hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 ${isSelected ? 'bg-indigo-600/5' : 'bg-card'}`}>
      {/* Checkbox */}
      <button
        onClick={onToggleSelect}
        className={`shrink-0 flex items-center justify-center h-5 w-5 rounded border transition-all ${
          isSelected
            ? 'bg-indigo-600 border-indigo-500'
            : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-300 dark:border-zinc-600/60 hover:border-indigo-500/60'
        }`}
        title={isSelected ? 'Desmarcar' : 'Selecionar'}
      >
        {isSelected && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
      </button>

      {/* Image */}
      <div className="shrink-0 h-10 w-10 rounded-lg bg-zinc-100/50 dark:bg-black/30 border border-zinc-200 dark:border-zinc-800/60 overflow-hidden flex items-center justify-center">
        {product.image_url ? (
          <img src={product.image_url} alt={product.title} className="h-full w-full object-contain p-1 mix-blend-screen" />
        ) : (
          <Package className="h-4 w-4 text-zinc-700" />
        )}
      </div>

      {/* Title */}
      <p className="flex-1 min-w-0 text-xs font-semibold text-foreground dark:text-zinc-200 line-clamp-1">{product.title}</p>

      {/* Marketplace */}
      <span className={`shrink-0 hidden sm:inline-flex text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${mpColor}`}>
        {MARKETPLACE_LABEL[product.marketplace] ?? product.marketplace}
      </span>

      {/* Price */}
      <div className="shrink-0 text-right hidden md:block">
        <span className="text-sm font-bold text-zinc-900 dark:text-white">{formatPrice(product.current_price)}</span>
        {product.discount_percent && product.discount_percent > 0 ? (
          <span className="ml-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1 py-0.5">
            -{product.discount_percent}%
          </span>
        ) : null}
      </div>

      {/* Status badge */}
      <div className="shrink-0 hidden lg:block">
        {isSent && (
          <span className="text-[10px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 border bg-emerald-500/10 border-emerald-500/20 text-emerald-400">✓ Enviado</span>
        )}
        {isFailed && (
          <span className="text-[10px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 border bg-rose-500/10 border-rose-500/20 text-rose-400">Falhou</span>
        )}
        {!isSent && !isFailed && (
          <span className="text-[10px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 border bg-amber-500/10 border-amber-500/20 text-amber-500">Pendente</span>
        )}
      </div>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-1.5">
        <a
          href={productLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center h-7 w-7 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/40 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
          title="Ver produto"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3 w-3" />
        </a>
        <button
          onClick={onSend}
          disabled={isDisabled}
          className={`flex items-center justify-center h-7 px-2.5 rounded-lg border text-xs font-semibold transition-all ${
            isSent
              ? 'bg-zinc-100 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/40 text-zinc-400 dark:text-zinc-500 cursor-default'
              : !hasGroups
              ? 'bg-zinc-100 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/40 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
              : 'bg-indigo-600 border-indigo-500 hover:bg-indigo-500 text-white'
          }`}
          title={isSent ? 'Já enviado' : !hasGroups ? 'Configure um grupo' : 'Preview & Enviar'}
        >
          {isSent ? <span className="text-[10px]">Enviado</span> : <Eye className="h-3 w-3" />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          disabled={isRemoving}
          className="flex items-center justify-center h-7 w-7 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/40 text-zinc-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-50"
          title="Remover da fila"
        >
          {isRemoving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
}

// ─── Send Preview Modal ────────────────────────────────────────────────────────

function SendPreviewModal({
  product,
  groups,
  onClose,
  onSentSuccess,
}: {
  product: ProductItem;
  groups: DispatchGroup[];
  onClose: () => void;
  onSentSuccess: (id: string) => void;
}) {
  const defaultTemplate = groups[0]?.template_text ?? null;
  const [message, setMessage] = useState(() => buildPreviewMessage(defaultTemplate, product));
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(
    () => new Set(groups.map((g) => g.id))
  );
  const [isSending, startSendTransition] = useTransition();

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function toggleGroup(id: string) {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleSend() {
    if (selectedGroups.size === 0) {
      toast.error('Selecione pelo menos um grupo');
      return;
    }
    startSendTransition(async () => {
      const result = await sendProduct(product.id, {
        groupIds: Array.from(selectedGroups),
        customMessage: message,
      });
      if (result.success) {
        toast.success(result.dispatched ? `Enviado para ${result.dispatched} destino(s)!` : 'Produto enviado!');
        onSentSuccess(product.id);
      } else {
        toast.error(result.error ?? 'Erro ao enviar');
      }
    });
  }

  const destinationsTotal = groups
    .filter((g) => selectedGroups.has(g.id))
    .reduce((acc, g) => acc + g.destinationsCount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-zinc-200 dark:border-zinc-700/60 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/60">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Preview & Enviar</h3>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Product summary */}
          <div className="flex gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-800/30 p-3">
            <div className="h-14 w-14 shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex items-center justify-center">
              {product.image_url
                ? <img src={product.image_url} alt="" className="h-full w-full object-contain p-1" />
                : <Package className="h-6 w-6 text-zinc-600" />}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 line-clamp-2 leading-relaxed">{product.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-bold text-zinc-900 dark:text-white">{formatPrice(product.current_price)}</span>
                {product.discount_percent && product.discount_percent > 0 && (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 rounded px-1.5 py-0.5">
                    -{product.discount_percent}%
                  </span>
                )}
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${MARKETPLACE_COLOR[product.marketplace] ?? 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400'}`}>
                  {MARKETPLACE_LABEL[product.marketplace] ?? product.marketplace}
                </span>
              </div>
            </div>
          </div>

          {/* Message editor */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Mensagem — edite antes de enviar
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700/60 bg-zinc-50 dark:bg-zinc-800/60 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-450 dark:placeholder:text-zinc-600 outline-none focus:border-indigo-500/60 transition-colors resize-none font-mono leading-relaxed"
              placeholder="Mensagem do disparo..."
            />
            <p className="text-[10px] text-zinc-600">
              Suporte WhatsApp: *negrito*, ~tachado~, _itálico_
            </p>
          </div>

          {/* Group selection */}
          {groups.length > 0 ? (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Grupos de destino
              </label>
              <div className="space-y-2">
                {groups.map((g) => (
                  <label
                    key={g.id}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                      selectedGroups.has(g.id)
                        ? 'border-indigo-500/30 bg-indigo-600/10'
                        : 'border-zinc-200 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-800/20 hover:border-zinc-300 dark:hover:border-zinc-700/60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedGroups.has(g.id)}
                      onChange={() => toggleGroup(g.id)}
                      className="rounded border-zinc-600 accent-indigo-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{g.name}</p>
                      <p className="text-[10px] text-zinc-500">
                        {g.destinationsCount} destino(s) WhatsApp
                        {g.marketplaces.length > 0 && ` · ${g.marketplaces.join(', ')}`}
                      </p>
                    </div>
                    {selectedGroups.has(g.id) && (
                      <span className="text-[10px] font-medium text-indigo-400">✓</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-400">
              Nenhum grupo ativo para {MARKETPLACE_LABEL[product.marketplace] ?? product.marketplace}.{' '}
              <Link href="/grupos" className="underline hover:text-amber-300">Criar grupo</Link>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-zinc-200 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/80">
          <p className="text-xs text-zinc-500">
            {selectedGroups.size > 0
              ? `Enviando para ${destinationsTotal} destino(s) em ${selectedGroups.size} grupo(s)`
              : 'Nenhum grupo selecionado'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700/60 bg-zinc-50 dark:bg-zinc-800/60 px-4 py-2 text-xs text-zinc-650 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSend}
              disabled={isSending || selectedGroups.size === 0 || groups.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-semibold px-4 py-2 transition-colors"
            >
              {isSending ? (
                <><Loader2 className="h-3 w-3 animate-spin" />Enviando...</>
              ) : (
                <><Send className="h-3 w-3" />Enviar agora</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

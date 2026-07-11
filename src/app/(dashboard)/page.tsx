export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getDashboardStats, getLast7DaysDispatches, getProductsPerMarketplace } from '@/lib/queries/dashboard-stats';
import {
  MessageSquare,
  ShoppingBag,
  Layers,
  ArrowRight,
  Zap,
  CheckCircle2,
  Package,
  Send,
  Clock,
  XCircle,
  MessageCircle,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';

function getGreeting() {
  const h = new Date().getUTCHours() - 3; // BRT
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

const MARKETPLACE_LABELS: Record<string, string> = {
  amazon: 'Amazon BR',
  mercadolivre: 'Mercado Livre',
  shopee: 'Shopee',
  aliexpress: 'AliExpress',
  kabum: 'KaBuM!',
  temu: 'Temu',
  shein: 'Shein',
};

const MARKETPLACE_BAR_COLORS: Record<string, string> = {
  amazon: 'bg-orange-500',
  mercadolivre: 'bg-yellow-500',
  shopee: 'bg-red-500',
  aliexpress: 'bg-rose-500',
  kabum: 'bg-blue-500',
  temu: 'bg-orange-600',
  shein: 'bg-zinc-800',
};

const WEEKDAY_LABELS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const firstName =
    (user?.user_metadata?.display_name as string | undefined)?.split(' ')[0] ??
    user?.email?.split('@')[0] ??
    'Afiliado';

  const userId = user?.id ?? '';
  const today = new Date(Date.now() - 3 * 3600000).toISOString().split('T')[0]; // BRT date

  const [
    dashStats,
    weekDispatches,
    marketplaceBreakdown,
    { count: connectedMarketplaces },
    { count: activeGroups },
    { data: whatsappInstance },
  ] = await Promise.all([
    getDashboardStats(userId),
    getLast7DaysDispatches(userId),
    getProductsPerMarketplace(userId),
    supabaseAdmin
      .from('marketplace_connections')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_valid', true),
    supabaseAdmin
      .from('dispatch_groups')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true),
    supabaseAdmin
      .from('whatsapp_instances')
      .select('status')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  // --- 7-day bar chart data ---
  const chartDays: Array<{ date: string; label: string; count: number }> = weekDispatches.map((d) => ({
    date: d.date,
    label: WEEKDAY_LABELS_PT[new Date(d.date + 'T12:00:00').getDay()],
    count: d.count,
  }));

  const maxChartCount = Math.max(...chartDays.map(d => d.count), 1);
  const totalWeekDispatches = chartDays.reduce((sum, d) => sum + d.count, 0);
  const allZero = totalWeekDispatches === 0;

  // --- Products per marketplace ---
  const marketplaceCounts: Record<string, number> = Object.fromEntries(
    marketplaceBreakdown.map(({ marketplace, count }) => [marketplace, count])
  );
  const totalOffers = dashStats.totalProducts;
  const maxMarketplaceCount = Math.max(...Object.values(marketplaceCounts), 1);

  // --- Stats (from helpers) ---
  const todayMessages = dashStats.messagesDispatched; // total messages sent today
  const todaySent = dashStats.sentToday;              // unique offers dispatched
  const todayFailed = dashStats.failedCount;
  const pendingCount = dashStats.pending;

  // --- WhatsApp status ---
  const waConnected = whatsappInstance?.status === 'connected';

  // --- Setup steps ---
  const hasMarketplace = (connectedMarketplaces ?? 0) > 0;
  const hasWhatsApp = whatsappInstance !== null && waConnected;
  const hasGroup = (activeGroups ?? 0) > 0;
  const allDone = hasMarketplace && hasWhatsApp && hasGroup;

  const pendingSteps = [
    !hasMarketplace && {
      title: 'Conectar Marketplace',
      desc: 'Configure Amazon, ML, Shopee ou AliExpress',
      href: '/marketplaces',
      icon: ShoppingBag,
    },
    !hasWhatsApp && {
      title: 'Conectar WhatsApp',
      desc: 'Escaneie o QR code ou use código por número',
      href: '/canais',
      icon: MessageSquare,
    },
    !hasGroup && {
      title: 'Criar Grupo de Disparo',
      desc: 'Configure filtros, horários e templates',
      href: '/grupos',
      icon: Layers,
    },
  ].filter(Boolean) as Array<{ title: string; desc: string; href: string; icon: React.ElementType }>;

  return (
    <div className="space-y-6 max-w-5xl md:px-2 md:py-2">
      {/* Section 1: Greeting */}
      <div>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-white tracking-tight">
          {getGreeting()}, {firstName} 👋
        </h1>
      </div>

      {/* Section 2: Glow Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Produtos */}
        <div
          className="rounded-2xl border border-blue-400 dark:border-blue-500/80 bg-card dark:bg-zinc-900/40 dark:backdrop-blur-md p-4 shadow-[0_0_15px_-2px_rgba(59,130,246,0.15)] dark:shadow-[0_0_15px_-2px_rgba(59,130,246,0.3)] relative overflow-hidden group hover:shadow-[0_0_20px_1px_rgba(59,130,246,0.25)] dark:hover:shadow-[0_0_20px_1px_rgba(59,130,246,0.4)] transition-all duration-300"
          title="Total de ofertas coletadas na sua fila."
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-10 group-hover:opacity-10 dark:group-hover:opacity-20 transition-opacity">
            <Package className="h-20 w-20 transform translate-x-4 -translate-y-4 text-blue-500 dark:text-white" />
          </div>
          <div className="flex items-center gap-2 mb-3 relative z-10">
            <div className="rounded-full p-1.5 bg-blue-500/10 ring-1 ring-blue-500/50 text-blue-600 dark:text-blue-400">
              <Package className="h-3.5 w-3.5" />
            </div>
            <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
              Total Produtos
            </p>
          </div>
          <p className="text-3xl font-bold text-zinc-900 dark:text-white relative z-10">{totalOffers}</p>
        </div>

        {/* Enviados hoje */}
        <div
          className="rounded-2xl border border-emerald-400 dark:border-emerald-500/80 bg-card dark:bg-zinc-900/40 dark:backdrop-blur-md p-4 shadow-[0_0_15px_-2px_rgba(16,185,129,0.15)] dark:shadow-[0_0_15px_-2px_rgba(16,185,129,0.3)] relative overflow-hidden group hover:shadow-[0_0_20px_1px_rgba(16,185,129,0.25)] dark:hover:shadow-[0_0_20px_1px_rgba(16,185,129,0.4)] transition-all duration-300"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-10 group-hover:opacity-10 dark:group-hover:opacity-20 transition-opacity">
            <Send className="h-20 w-20 transform translate-x-4 -translate-y-4 text-emerald-500 dark:text-white" />
          </div>
          <div className="flex items-center gap-2 mb-3 relative z-10">
            <div className="rounded-full p-1.5 bg-emerald-500/10 ring-1 ring-emerald-500/50 text-emerald-600 dark:text-emerald-400">
              <Send className="h-3.5 w-3.5" />
            </div>
            <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
              Enviados Hoje
            </p>
          </div>
          <p className="text-3xl font-bold text-zinc-900 dark:text-white relative z-10">{todayMessages}</p>
        </div>

        {/* Pendentes */}
        <div
          className="rounded-2xl border border-amber-400 dark:border-amber-500/80 bg-card dark:bg-zinc-900/40 dark:backdrop-blur-md p-4 shadow-[0_0_15px_-2px_rgba(245,158,11,0.15)] dark:shadow-[0_0_15px_-2px_rgba(245,158,11,0.3)] relative overflow-hidden group hover:shadow-[0_0_20px_1px_rgba(245,158,11,0.25)] dark:hover:shadow-[0_0_20px_1px_rgba(245,158,11,0.4)] transition-all duration-300"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-10 group-hover:opacity-10 dark:group-hover:opacity-20 transition-opacity">
            <Clock className="h-20 w-20 transform translate-x-4 -translate-y-4 text-amber-500 dark:text-white" />
          </div>
          <div className="flex items-center gap-2 mb-3 relative z-10">
            <div className="rounded-full p-1.5 bg-amber-500/10 ring-1 ring-amber-500/50 text-amber-600 dark:text-amber-400">
              <Clock className="h-3.5 w-3.5" />
            </div>
            <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
              Pendentes
            </p>
          </div>
          <p className="text-3xl font-bold text-zinc-900 dark:text-white relative z-10">{pendingCount}</p>
        </div>

        {/* Esta semana */}
        <div
          className="rounded-2xl border border-purple-400 dark:border-purple-500/80 bg-card dark:bg-zinc-900/40 dark:backdrop-blur-md p-4 shadow-[0_0_15px_-2px_rgba(168,85,247,0.15)] dark:shadow-[0_0_15px_-2px_rgba(168,85,247,0.3)] relative overflow-hidden group hover:shadow-[0_0_20px_1px_rgba(168,85,247,0.25)] dark:hover:shadow-[0_0_20px_1px_rgba(168,85,247,0.4)] transition-all duration-300"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-10 group-hover:opacity-10 dark:group-hover:opacity-20 transition-opacity">
            <BarChart3 className="h-20 w-20 transform translate-x-4 -translate-y-4 text-purple-500 dark:text-white" />
          </div>
          <div className="flex items-center gap-2 mb-3 relative z-10">
            <div className="rounded-full p-1.5 bg-purple-500/10 ring-1 ring-purple-500/50 text-purple-600 dark:text-purple-400">
              <BarChart3 className="h-3.5 w-3.5" />
            </div>
            <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
              Esta Semana
            </p>
          </div>
          <p className="text-3xl font-bold text-zinc-900 dark:text-white relative z-10">{totalWeekDispatches}</p>
        </div>

        {/* Falhas */ }
        <div
          className="rounded-2xl border border-rose-400 dark:border-rose-500/50 bg-card dark:bg-zinc-900/40 dark:backdrop-blur-md p-4 shadow-[0_0_15px_-2px_rgba(244,63,94,0.05)] dark:shadow-[0_0_15px_-2px_rgba(244,63,94,0.1)] relative overflow-hidden group hover:shadow-[0_0_20px_1px_rgba(244,63,94,0.15)] dark:hover:shadow-[0_0_20px_1px_rgba(244,63,94,0.2)] transition-all duration-300"
          title="Mensagens que falharam ao ser enviadas hoje."
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <XCircle className="h-20 w-20 transform translate-x-4 -translate-y-4 text-red-500" />
          </div>
          <div className="flex items-center gap-2 mb-3 relative z-10">
            <div className="rounded-full p-1.5 bg-rose-500/10 ring-1 ring-rose-500/50 text-rose-600 dark:text-rose-400">
              <XCircle className="h-3.5 w-3.5" />
            </div>
            <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
              Falhas
            </p>
          </div>
          <p className="text-3xl font-bold text-zinc-900 dark:text-white relative z-10">{todayFailed}</p>
        </div>
      </div>

      {/* Section 3: 7-day bar chart visually upgraded */}
      <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/60 bg-white/80 dark:bg-zinc-900/50 backdrop-blur-xl overflow-hidden shadow-xl ring-1 ring-black/5 dark:ring-white/5 transition-all duration-300">
        <div className="px-6 py-5 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/40">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white tracking-wide">
              Disparos por dia - Últimos 7 dias
            </h2>
          </div>
          <span className="text-xs font-medium text-zinc-650 dark:text-zinc-400 bg-zinc-100/80 dark:bg-zinc-800/50 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700/50">
            {totalWeekDispatches} total
          </span>
        </div>

        <div className="px-6 py-8">
          {allZero ? (
            <div className="h-44 flex items-center justify-center">
              <p className="text-sm text-zinc-500">Nenhum disparo nos últimos 7 dias</p>
            </div>
          ) : (
            <div className="flex items-end justify-between gap-6 h-48 px-2 max-w-4xl mx-auto">
              {chartDays.map((day) => {
                const heightPct = day.count > 0
                  ? Math.max(8, Math.round((day.count / maxChartCount) * 100))
                  : 5;
                const isToday = day.date === today;

                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-3 relative group">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 text-[11px] font-semibold text-white bg-zinc-800 px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                      {day.count} envios
                    </span>
                    <div className="w-full flex items-end justify-center h-40">
                      <div
                        className={`w-12 max-w-[48px] rounded-t-lg transition-all duration-300 ${
                          day.count === 0
                            ? 'bg-zinc-100 dark:bg-zinc-800/30'
                            : 'bg-gradient-to-b from-cyan-400 to-blue-600 shadow-[0_0_15px_-2px_rgba(34,211,238,0.3)] group-hover:brightness-110'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className={`text-[11px] font-medium ${isToday ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-500'}`}>
                      {day.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Section 4: Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Produtos por Marketplace */}
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/60 bg-white/80 dark:bg-zinc-900/50 backdrop-blur-xl overflow-hidden shadow-xl ring-1 ring-black/5 dark:ring-white/5 transition-all duration-300">
          <div className="px-6 py-5 border-b border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-900/40">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white tracking-wide">Produtos por Marketplace</h2>
            <p className="text-xs text-zinc-550 dark:text-zinc-500 mt-1">Distribuição do catálogo</p>
          </div>
          <div className="p-6">
            {totalOffers === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-zinc-500">Nenhum produto coletado ainda</p>
              </div>
            ) : (
              <div className="space-y-5">
                {(Object.keys(marketplaceCounts) as string[]).map((mp) => {
                  const count = marketplaceCounts[mp] ?? 0;
                  const pct = count > 0 ? Math.max(4, Math.round((count / maxMarketplaceCount) * 100)) : 0;
                  // Map specific tailwind gradient classes for a better look
                  const barGradientClass = 
                    mp === 'amazon' ? 'bg-gradient-to-r from-orange-400 to-amber-500 shadow-[0_0_10px_rgba(249,115,22,0.3)]' :
                    mp === 'mercadolivre' ? 'bg-gradient-to-r from-yellow-300 to-amber-400 shadow-[0_0_10px_rgba(253,224,71,0.3)]' :
                    mp === 'shopee' ? 'bg-gradient-to-r from-rose-400 to-red-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]' :
                    mp === 'aliexpress' ? 'bg-gradient-to-r from-pink-500 to-rose-600 shadow-[0_0_10px_rgba(236,72,153,0.3)]' :
                    mp === 'kabum' ? 'bg-gradient-to-r from-blue-400 to-cyan-500 shadow-[0_0_10px_rgba(56,189,248,0.3)]' :
                    mp === 'temu' ? 'bg-gradient-to-r from-orange-500 to-red-500 shadow-[0_0_10px_rgba(249,115,22,0.3)]' :
                    'bg-gradient-to-r from-zinc-600 to-zinc-800 shadow-[0_0_10px_rgba(0,0,0,0.15)]';

                  return (
                    <div key={mp} className="space-y-2 group">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 tracking-wider uppercase">{MARKETPLACE_LABELS[mp]}</span>
                        <span className="text-[11px] font-bold text-zinc-800 dark:text-white bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded">{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                        {count > 0 && (
                          <div
                            className={`h-full rounded-full ${barGradientClass} transition-all duration-500 group-hover:brightness-110`}
                            style={{ width: `${pct}%` }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* WhatsApp Instance */}
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/60 bg-white/80 dark:bg-zinc-900/50 backdrop-blur-xl overflow-hidden shadow-xl ring-1 ring-black/5 dark:ring-white/5 transition-all duration-300">
          <div className="px-6 py-5 border-b border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-900/40">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white tracking-wide">Instância WhatsApp</h2>
            <p className="text-xs text-zinc-550 dark:text-zinc-500 mt-1">Status da conexão</p>
          </div>
          <div className="p-6">
            {waConnected ? (
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-emerald-500/10 p-4 ring-1 ring-emerald-500/20 dark:ring-emerald-500/30">
                  <MessageCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] dark:shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tracking-wide uppercase">Conectado</p>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Instância ativa e comunicando perfeitamente. Pronta para disparos.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-rose-500/10 p-4 ring-1 ring-rose-500/20 dark:ring-rose-500/30">
                  <MessageCircle className="h-6 w-6 text-rose-600 dark:text-rose-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
                    <p className="text-sm font-bold text-rose-600 dark:text-rose-400 tracking-wide uppercase">Desconectado</p>
                  </div>
                  <p className="text-xs text-zinc-655 dark:text-zinc-400 mt-0.5 leading-relaxed">
                    Configure sua instância acessando a aba{' '}
                    <Link href="/canais" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium underline underline-offset-4">
                      Canais
                    </Link>
                  </p>
                </div>
              </div>
            )}

            {/* Quick stats grid */}
            <div className="mt-6 pt-5 border-t border-zinc-100 dark:border-white/5 grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-zinc-50/50 dark:bg-zinc-800/30 border border-zinc-150 dark:border-zinc-800/50 p-4 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors">
                <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-1.5">Grupos Ativos</p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-white">{activeGroups ?? 0}</p>
              </div>
              <div className="rounded-xl bg-zinc-50/50 dark:bg-zinc-800/30 border border-zinc-150 dark:border-zinc-800/50 p-4 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors">
                <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-1.5">Marketplaces Config</p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-white">{connectedMarketplaces ?? 0}<span className="text-sm text-zinc-400 dark:text-zinc-600 font-medium">/5</span></p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 5: Próximos passos */}
      {allDone ? (
        <div className="flex items-center gap-4 rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-500/5 backdrop-blur-md px-6 py-5 shadow-[0_0_20px_-5px_rgba(16,185,129,0.08)] dark:shadow-[0_0_20px_-5px_rgba(16,185,129,0.15)]">
          <div className="rounded-full bg-emerald-500/20 p-2">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Tudo configurado com sucesso!</p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
              Seus disparos estão prontos. Acompanhe a performance pelo{' '}
              <Link href="/historico" className="text-zinc-800 dark:text-white hover:text-indigo-650 dark:hover:text-indigo-300 font-medium underline underline-offset-4 transition-colors">
                histórico
              </Link>.
            </p>
          </div>
        </div>
      ) : (
        <div className="pt-2">
          <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-300 mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            Pendências para começar
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {pendingSteps.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex flex-col gap-3 rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white/80 dark:bg-zinc-900/40 backdrop-blur-md px-5 py-5 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/60 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-[0_0_20px_-5px_rgba(99,102,241,0.15)] dark:hover:shadow-[0_0_20px_-5px_rgba(99,102,241,0.2)] transition-all group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-indigo-500/5 group-hover:to-indigo-500/10 transition-colors" />
                  <div className="flex justify-between items-start relative z-10 hidden">
                  </div>
                  <div className="flex items-center gap-3 relative z-10 mb-1">
                    <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800/80 p-2 group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-colors">
                      <Icon className="h-4 w-4 text-zinc-500 dark:text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-zinc-400 dark:text-zinc-600 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-1 transition-all ml-auto" />
                  </div>
                  <div className="relative z-10">
                    <p className="text-sm font-bold text-zinc-800 group-hover:text-zinc-900 dark:text-zinc-200 dark:group-hover:text-white transition-colors">{action.title}</p>
                    <p className="text-xs text-zinc-500 mt-1 group-hover:text-zinc-750 dark:group-hover:text-zinc-400 transition-colors">{action.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

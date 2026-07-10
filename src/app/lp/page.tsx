export const revalidate = 3600;

import Link from 'next/link';
import {
  Zap, CheckCircle2, ArrowRight, MessageCircle, ShoppingBag,
  BarChart2, Layers, Send, Clock, Shield, Star,
  Repeat2, Filter, Image, Globe,
} from 'lucide-react';
import { BRAND } from '@/config/brand';
import { getActivePlans, type PlanRecord } from '@/lib/plans';

// ─── Data ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Repeat2,
    title: 'Envio 100% Automático',
    desc: `Configure uma vez e o ${BRAND.name} busca e dispara ofertas nos seus grupos sem você precisar fazer nada.`,
  },
  {
    icon: ShoppingBag,
    title: '5 Marketplaces Conectados',
    desc: 'Amazon BR, Mercado Livre, Shopee, AliExpress e KaBuM! integrados com links de afiliado gerados automaticamente.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp + Telegram',
    desc: 'Dispare simultaneamente para grupos do WhatsApp via Evolution API e canais do Telegram com um único clique.',
  },
  {
    icon: Filter,
    title: 'Filtros Inteligentes',
    desc: 'Defina desconto mínimo, faixa de preço, palavras-chave e palavras bloqueadas. Só passa o que você quer.',
  },
  {
    icon: Send,
    title: 'Disparo Manual por URL',
    desc: 'Cole a URL de qualquer produto do Mercado Livre, busca automática do produto, preview e dispara em segundos.',
  },
  {
    icon: Image,
    title: 'Imagem + Mensagem',
    desc: 'Cada disparo inclui a foto do produto e a mensagem formatada com preço, desconto e link de afiliado.',
  },
  {
    icon: BarChart2,
    title: 'Histórico Completo',
    desc: 'Acompanhe todos os disparos enviados, status de entrega e performance de cada grupo.',
  },
  {
    icon: Globe,
    title: 'Templates Personalizados',
    desc: 'Monte o texto ideal para cada grupo. Suporta negrito, tachado, emojis e rotação de variantes.',
  },
];

const STEPS = [
  {
    num: '01',
    title: 'Conecte seus marketplaces',
    desc: 'Informe suas credenciais de afiliado. Amazon, ML, Shopee, AliExpress, KaBuM — tudo em minutos.',
  },
  {
    num: '02',
    title: 'Configure seus grupos',
    desc: 'Adicione seus grupos do WhatsApp e Telegram. Defina filtros, templates e limites diários.',
  },
  {
    num: '03',
    title: 'Ative e lucre',
    desc: `O ${BRAND.name} roda automaticamente, buscando ofertas e disparando para todos os seus grupos.`,
  },
];

type LpPlanVisual = {
  badge: string;
  cta: string;
  ctaStyle: string;
  highlightBadgeStyle: string;
};

const LP_PLAN_VISUAL: Record<string, LpPlanVisual> = {
  basico: {
    badge: '⚡ COMEÇAR',
    cta: 'Começar Agora',
    ctaStyle: 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700',
    highlightBadgeStyle: 'bg-zinc-800/60 border-zinc-700/60 text-zinc-400',
  },
  profissional: {
    badge: '🔥 MAIS ESCOLHIDO',
    cta: 'Escolher Profissional',
    ctaStyle: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-900 font-bold',
    highlightBadgeStyle: 'bg-orange-500/15 border-orange-500/30 text-orange-300',
  },
  premium: {
    badge: '👑 MAIS VANTAJOSO',
    cta: 'Garantir Premium',
    ctaStyle: 'bg-violet-600 hover:bg-violet-500 text-white font-bold',
    highlightBadgeStyle: 'bg-zinc-800/60 border-zinc-700/60 text-zinc-400',
  },
};

function formatLpPrice(valor: number) {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function LpPlanCard({ plano }: { plano: PlanRecord }) {
  const family = plano.slug.replace('_anual', '');
  const vis = LP_PLAN_VISUAL[family] ?? LP_PLAN_VISUAL.basico;
  const badgeStyle = plano.destaque ? vis.highlightBadgeStyle : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-400';
  const checkColor = plano.destaque ? 'text-amber-400' : 'text-emerald-400';

  return (
    <div className={`rounded-2xl border bg-zinc-900 flex flex-col overflow-hidden ${
      plano.destaque
        ? 'border-indigo-500/40 shadow-xl shadow-indigo-500/10 md:-mt-4 md:mb-4'
        : 'border-zinc-800/60'
    }`}>
      <div className="flex justify-center pt-5 pb-0 px-5">
        <span className={`inline-flex items-center text-[10px] font-bold tracking-widest px-3 py-1 rounded-full border ${badgeStyle}`}>
          {vis.badge}
        </span>
      </div>

      <div className="p-6 space-y-5 flex-1 flex flex-col">
        <div>
          <h3 className="text-lg font-bold text-white">{plano.nome}</h3>
          <p className="text-xs text-zinc-500 mt-0.5">{plano.descricao}</p>
        </div>

        <div className="flex items-end gap-1">
          <span className="text-sm text-zinc-500 mb-1">R$</span>
          <span className={`text-4xl font-extrabold tracking-tight ${plano.destaque ? 'text-amber-400' : 'text-white'}`}>
            {formatLpPrice(plano.valor)}
          </span>
          <span className="text-sm text-zinc-500 mb-1">/mês</span>
        </div>

        <div className="border-t border-zinc-800/60" />

        <ul className="space-y-2 flex-1">
          {plano.recursos.map((f, i) => {
            const isSoon = f.includes('(em breve)');
            const text = f.replace(/\s*\(em breve\)/gi, '').trim();
            return (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${isSoon ? 'text-zinc-700' : checkColor}`} />
                <span className={`text-xs leading-snug ${isSoon ? 'text-zinc-600' : 'text-zinc-300'}`}>
                  {text}
                  {isSoon && <span className="ml-1 text-[9px] bg-zinc-800 border border-zinc-700 text-zinc-600 px-1.5 py-0.5 rounded-full">em breve</span>}
                </span>
              </li>
            );
          })}
        </ul>

        <Link
          href={plano.linkCheckout || '/signup'}
          className={`flex items-center justify-center w-full rounded-xl px-5 py-3 text-sm transition-all ${vis.ctaStyle}`}
        >
          {vis.cta}
        </Link>
      </div>
    </div>
  );
}

const FAQS = [
  {
    q: 'Preciso ter conta de afiliado em cada marketplace?',
    a: `Sim. Você precisa ter suas próprias credenciais de afiliado em cada plataforma (Amazon Associates, ML Afiliados, etc.). O ${BRAND.name} usa essas credenciais para gerar os links com seu código de afiliado.`,
  },
  {
    q: 'Como o WhatsApp funciona? Vou ter meu número banido?',
    a: 'Usamos a Evolution API com instâncias dedicadas. O sistema respeita intervalos entre mensagens e limites diários que você configura, reduzindo o risco. Recomendamos usar um número específico para disparos.',
  },
  {
    q: 'Posso testar antes de pagar?',
    a: 'Sim. Todo novo cadastro recebe 7 dias gratuitos com acesso completo à plataforma para você testar e configurar tudo.',
  },
  {
    q: 'Os preços da API batem com o que está no site?',
    a: 'Para preços regulares, sim. Flash sales, promoções de aniversário e preços exclusivos do app podem divergir — são descontos temporários que as APIs de afiliados não expõem em tempo real.',
  },
  {
    q: 'Posso cancelar a qualquer momento?',
    a: 'Sim. Sem fidelidade. O acesso fica ativo até o final do período pago e não é renovado automaticamente.',
  },
];

// ─── Components ───────────────────────────────────────────────────────────────

function GridBg() {
  return (
    <div
      className="absolute inset-0 opacity-[0.025] pointer-events-none"
      style={{
        backgroundImage:
          'linear-gradient(#818cf8 1px, transparent 1px), linear-gradient(to right, #818cf8 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }}
    />
  );
}

function Glow({ className }: { className?: string }) {
  return (
    <div className={`absolute rounded-full blur-3xl pointer-events-none ${className}`} />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LandingPage() {
  const allPlans = await getActivePlans();
  const mensalPlans = allPlans.filter((p) => p.tipoPeriodo === 'mensal');

  return (
    <div className="min-h-screen bg-zinc-950 text-white overflow-x-hidden">

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-zinc-800/60 bg-zinc-950/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 shadow-lg shadow-indigo-500/30">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-bold tracking-tight">
              <span className="text-indigo-400">Dispara</span>
              <span className="text-white">Zap</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors hidden sm:block">
              Entrar
            </Link>
            <Link
              href="/signup"
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 transition-colors"
            >
              Testar grátis
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section className="relative pt-24 pb-28 overflow-hidden">
        <GridBg />
        <Glow className="top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-indigo-600/15" />

        <div className="relative max-w-4xl mx-auto px-5 text-center space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-300 tracking-wide">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Automação de Afiliados para WhatsApp + Telegram
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
            Dispare ofertas<br />
            <span className="text-indigo-400">no automático.</span><br />
            <span className="text-zinc-400 text-3xl sm:text-4xl lg:text-5xl font-bold">Ganhe comissões dormindo.</span>
          </h1>

          <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Conecte seus marketplaces de afiliado, configure seus grupos do WhatsApp e Telegram
            e o {BRAND.name} busca, filtra e dispara as melhores ofertas automaticamente — 24 horas por dia.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-base px-8 py-4 transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30"
            >
              Começar grátis por 7 dias
              <ArrowRight className="h-4 w-4" />
            </Link>
            <span className="text-sm text-zinc-600">Sem cartão de crédito</span>
          </div>

          {/* Social proof strip */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-sm text-zinc-500">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              7 dias grátis
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Sem fidelidade
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Setup em minutos
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Suporte por WhatsApp
            </span>
          </div>
        </div>
      </section>

      {/* ── MARKETPLACES STRIP ──────────────────────────────────────────────── */}
      <section className="border-y border-zinc-800/60 bg-zinc-900/30 py-6">
        <div className="max-w-4xl mx-auto px-5">
          <p className="text-center text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-5">
            Marketplaces integrados
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              { label: 'Amazon BR', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
              { label: 'Mercado Livre', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
              { label: 'Shopee', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
              { label: 'AliExpress', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
              { label: 'KaBuM!', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
            ].map((m) => (
              <span key={m.label} className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-semibold ${m.color}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {m.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────────── */}
      <section className="relative py-24 overflow-hidden">
        <Glow className="top-1/2 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-indigo-600/10" />
        <div className="relative max-w-5xl mx-auto px-5">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">Como funciona</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">3 passos para automatizar</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((s) => (
              <div key={s.num} className="relative rounded-2xl border border-zinc-800/60 bg-zinc-900/60 p-7">
                <div className="text-5xl font-extrabold text-indigo-600/20 mb-4 leading-none">{s.num}</div>
                <h3 className="text-base font-bold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────────────────── */}
      <section className="relative py-24 bg-zinc-900/30 overflow-hidden">
        <GridBg />
        <Glow className="bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/10" />
        <div className="relative max-w-6xl mx-auto px-5">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">Funcionalidades</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">Tudo que você precisa para escalar</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="rounded-2xl border border-zinc-800/60 bg-zinc-900 p-5 space-y-3 hover:border-indigo-500/30 transition-colors">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                    <Icon className="h-5 w-5 text-indigo-400" />
                  </div>
                  <h3 className="text-sm font-bold text-white">{f.title}</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── PROOF / NUMBERS ─────────────────────────────────────────────────── */}
      <section className="py-20 border-y border-zinc-800/60">
        <div className="max-w-4xl mx-auto px-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '5', label: 'Marketplaces integrados' },
              { value: '24h', label: 'Funcionando automaticamente' },
              { value: '7', label: 'Dias grátis para testar' },
              { value: '100%', label: 'Links de afiliado automáticos' },
            ].map((s) => (
              <div key={s.label} className="space-y-1">
                <div className="text-3xl sm:text-4xl font-extrabold text-indigo-400">{s.value}</div>
                <div className="text-xs text-zinc-500 leading-snug">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────────────────────── */}
      <section className="relative py-24 overflow-hidden">
        <Glow className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-indigo-600/10" />
        <div className="relative max-w-5xl mx-auto px-5">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">Planos</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">Simples e transparente</h2>
            <p className="text-sm text-zinc-500 mt-3">Comece grátis. Upgrade quando quiser. Cancele a qualquer hora.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {mensalPlans.map((plano) => (
              <LpPlanCard key={plano.id} plano={plano} />
            ))}
          </div>

          <p className="text-center text-xs text-zinc-600 mt-8">
            Todos os planos incluem 7 dias grátis. Sem cartão de crédito para começar.
          </p>
        </div>
      </section>

      {/* ── TRUST BAR ───────────────────────────────────────────────────────── */}
      <section className="border-y border-zinc-800/60 bg-zinc-900/30 py-8">
        <div className="max-w-4xl mx-auto px-5">
          <div className="flex flex-wrap items-center justify-center gap-8 text-xs text-zinc-500">
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-indigo-400" />
              Credenciais criptografadas com AES-256
            </span>
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-400" />
              Setup em menos de 10 minutos
            </span>
            <span className="flex items-center gap-2">
              <Star className="h-4 w-4 text-indigo-400" />
              Suporte via WhatsApp
            </span>
            <span className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-400" />
              Múltiplos grupos simultâneos
            </span>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-5">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">FAQ</p>
            <h2 className="text-3xl font-bold text-white">Dúvidas frequentes</h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-5">
                <p className="text-sm font-semibold text-white mb-2">{faq.q}</p>
                <p className="text-sm text-zinc-500 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ───────────────────────────────────────────────────────── */}
      <section className="relative py-28 overflow-hidden">
        <GridBg />
        <Glow className="inset-0 m-auto w-[500px] h-[300px] bg-indigo-600/15" />

        <div className="relative max-w-2xl mx-auto px-5 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
            Pronto para colocar<br />
            <span className="text-indigo-400">suas comissões no automático?</span>
          </h2>
          <p className="text-sm text-zinc-400">
            Junte-se aos afiliados que já automatizaram seus disparos. Comece grátis hoje.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-base px-8 py-4 transition-all shadow-lg shadow-indigo-500/25"
            >
              Criar conta grátis
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
              Já tenho conta →
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800/60 py-8">
        <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600">
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-bold">
              <span className="text-indigo-400">Dispara</span>
              <span className="text-white">Zap</span>
            </span>
          </div>
          <p className="text-xs text-zinc-600">
            &copy; {new Date().getFullYear()} {BRAND.name}. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-4 text-xs text-zinc-600">
            <Link href="/login" className="hover:text-zinc-400 transition-colors">Entrar</Link>
            <Link href="/signup" className="hover:text-zinc-400 transition-colors">Cadastrar</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}

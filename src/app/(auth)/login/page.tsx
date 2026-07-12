export const revalidate = 3600;

import Link from 'next/link';
import {
  Zap, ArrowRight, CheckCircle2, Star,
  Search, FileText, Link2, Send,
  Bot, Clock, DollarSign, Gem, MousePointerClick, Headphones,
  ShieldCheck, Lock, CreditCard, XCircle,
} from 'lucide-react';
import { BRAND } from '@/config/brand';
import { getActivePlans, type PlanRecord } from '@/lib/plans';
import { LoginForm } from '@/components/auth/login-form';

function formatPrice(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function GridBg() {
  return (
    <div
      className="absolute inset-0 opacity-[0.03] pointer-events-none"
      style={{
        backgroundImage:
          'linear-gradient(#ff5a00 1px, transparent 1px), linear-gradient(to right, #ff5a00 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}
    />
  );
}

function Glow({ className }: { className?: string }) {
  return (
    <div className={`absolute rounded-full blur-3xl pointer-events-none ${className}`} />
  );
}

function PlanCard({ plano }: { plano: PlanRecord }) {
  const featured = plano.destaque;
  return (
    <div
      className={`rounded-xl border flex items-center gap-4 p-4 transition-all ${
        featured
          ? 'border-brand-500/40 bg-brand-500/5'
          : 'border-zinc-800/60 bg-zinc-900/60'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-bold text-white truncate">{plano.nome}</span>
          {featured && (
            <span className="shrink-0 text-[8px] font-bold tracking-wider bg-brand-500/20 text-brand-400 border border-brand-500/30 px-2 py-0.5 rounded-full">
              🔥 MAIS ESCOLHIDO
            </span>
          )}
        </div>
        <p className="text-[10px] text-zinc-500 truncate">{plano.descricao}</p>
      </div>
      <div className="text-right shrink-0">
        <div className="flex items-baseline gap-0.5 justify-end">
          <span className="text-xs text-zinc-500">R$</span>
          <span className={`text-2xl font-extrabold tracking-tight ${featured ? 'text-brand-400' : 'text-white'}`}>
            {formatPrice(plano.valor)}
          </span>
          <span className="text-xs text-zinc-500">/mês</span>
        </div>
        <Link
          href={plano.linkCheckout || '/signup'}
          className={`mt-2 inline-flex items-center gap-1 text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all ${
            featured
              ? 'bg-brand-500 hover:bg-brand-600 text-white shadow-sm shadow-brand-500/30'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
          }`}
        >
          Começar <ArrowRight className="h-2.5 w-2.5" />
        </Link>
      </div>
    </div>
  );
}

export default async function LoginPage() {
  let mensalPlans: PlanRecord[] = [];
  try {
    const all = await getActivePlans();
    mensalPlans = all.filter((p) => p.tipoPeriodo === 'mensal');
  } catch {
    // If plans fail to load, show empty pricing section
  }

  return (
    /* Full-screen overlay — visually takes over the (auth)/layout */
    <div className="fixed inset-0 z-[100] flex bg-zinc-950 text-white overflow-hidden">

      {/* ════════════════════════════════════════════════════════════════
          LEFT PANEL — LP content (scrollable)
      ════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:block lg:w-[58%] xl:w-[60%] overflow-y-auto border-r border-zinc-800/60">

        {/* ── NAV ──────────────────────────────────────────────────────── */}
        <nav className="sticky top-0 z-50 border-b border-zinc-800/60 bg-zinc-950/95 backdrop-blur-sm">
          <div className="px-8 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 shadow-lg shadow-brand-500/30">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <span className="text-base font-bold tracking-tight">
                <span className="text-brand-400">{BRAND.namePart1}</span>
                <span className="text-white">{BRAND.namePart2}</span>
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-5 text-xs font-medium text-zinc-400">
              <a href="#como-funciona" className="hover:text-white transition-colors">Como funciona</a>
              <a href="#depoimentos" className="hover:text-white transition-colors">Depoimentos</a>
              <a href="#precos" className="hover:text-white transition-colors">Preços</a>
              <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            </div>

            <Link
              href="/signup"
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold px-4 py-2 transition-colors shadow-sm shadow-brand-500/30"
            >
              Quero começar agora <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </nav>

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section className="relative px-10 pt-14 pb-12 overflow-hidden">
          <GridBg />
          <Glow className="top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-72 bg-brand-600/20" />

          <div className="relative">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/25 bg-brand-500/10 px-3 py-1 text-[10px] font-semibold text-brand-400 tracking-widest uppercase mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" />
              Ferramenta de Automação para Afiliados
            </div>

            {/* Headline */}
            <h1 className="text-4xl xl:text-[2.75rem] font-extrabold tracking-tight leading-[1.1] mb-5">
              Automação que<br />
              transforma links<br />
              <span className="text-brand-400">em renda.</span>
            </h1>

            {/* Description */}
            <p className="text-sm text-zinc-400 leading-relaxed max-w-md mb-7">
              O {BRAND.name} encontra produtos em alta, cria todo o conteúdo, gera seus links de
              afiliado e divulga nos seus canais por você. Mais resultado, menos esforço.
            </p>

            {/* 4 mini feature steps */}
            <div className="grid grid-cols-4 gap-2 mb-7">
              {[
                { icon: Search,   label: 'Encontra produtos em alta' },
                { icon: FileText, label: 'Cria conteúdo automático' },
                { icon: Link2,    label: 'Gera links de afiliado' },
                { icon: Send,     label: 'Publica e divulga por você' },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex flex-col items-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800/60 p-3 text-center"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 border border-brand-500/20">
                    <Icon className="h-4 w-4 text-brand-400" />
                  </div>
                  <span className="text-[9px] font-medium text-zinc-400 leading-tight">{label}</span>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex items-center gap-3 mb-7 flex-wrap">
              <Link
                href="/signup"
                className="flex items-center gap-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm px-6 py-3 transition-all shadow-lg shadow-brand-500/25"
              >
                QUERO COMEÇAR AGORA <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/signup"
                className="flex items-center gap-2 rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white text-sm px-5 py-3 transition-all"
              >
                ▶ Ver demonstração
              </Link>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {[
                  { bg: 'bg-orange-500', initial: 'R' },
                  { bg: 'bg-amber-500',  initial: 'J' },
                  { bg: 'bg-rose-500',   initial: 'L' },
                  { bg: 'bg-yellow-500', initial: 'M' },
                  { bg: 'bg-red-500',    initial: 'A' },
                ].map(({ bg, initial }, i) => (
                  <div
                    key={i}
                    className={`h-7 w-7 rounded-full ${bg} border-2 border-zinc-950 flex items-center justify-center text-[10px] font-bold text-white`}
                  >
                    {initial}
                  </div>
                ))}
              </div>
              <p className="text-xs text-zinc-500">
                <span className="text-white font-semibold">+2.500 usuários</span>{' '}
                estão lucrando com o {BRAND.name}
              </p>
            </div>
          </div>
        </section>

        {/* ── MARKETPLACE STRIP ────────────────────────────────────────── */}
        <section className="bg-black border-y border-zinc-800/60 py-5 px-10">
          <p className="text-[9px] font-semibold text-zinc-600 uppercase tracking-widest text-center mb-4">
            Compatível com os principais marketplaces
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {[
              { label: 'Shopee',        color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20' },
              { label: 'amazon',        color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
              { label: 'mercado livre', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
              { label: 'AliExpress',    color: 'text-rose-400',   bg: 'bg-rose-500/10 border-rose-500/20' },
              { label: 'KaBuM!',        color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
            ].map((m) => (
              <span
                key={m.label}
                className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-semibold ${m.color} ${m.bg}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {m.label}
              </span>
            ))}
          </div>
        </section>

        {/* ── COMO FUNCIONA ─────────────────────────────────────────────── */}
        <section id="como-funciona" className="px-10 py-12 relative overflow-hidden">
          <Glow className="top-1/2 right-0 -translate-y-1/2 translate-x-1/2 w-72 h-72 bg-brand-600/10" />
          <div className="relative">
            <div className="text-center mb-8">
              <p className="text-[9px] font-bold text-brand-400 uppercase tracking-widest mb-2">COMO FUNCIONA</p>
              <h2 className="text-2xl font-bold text-white">
                Você relaxa, o <span className="text-brand-400">{BRAND.name}</span> trabalha.
              </h2>
              <p className="text-xs text-zinc-500 mt-2">
                Em 4 passos simples, o sistema faz tudo por você — 24 horas por dia.
              </p>
            </div>

            <div className="grid grid-cols-4 gap-3 relative">
              {[
                {
                  icon: Search,
                  label: 'Encontra produtos em alta',
                  desc: 'O sistema rastreia os principais marketplaces e encontra os mais promissores.',
                  color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
                },
                {
                  icon: FileText,
                  label: 'Cria o conteúdo automático',
                  desc: 'Legendas, textos e descrições prontas e otimizadas para gerar cliques.',
                  color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
                },
                {
                  icon: Link2,
                  label: 'Gera os links de afiliado',
                  desc: 'Cria seus links de afiliado automaticamente, pronto para converter.',
                  color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
                },
                {
                  icon: Send,
                  label: 'Publica e divulga por você',
                  desc: 'Envia nos seus canais automaticamente e mantém tudo trabalhando.',
                  color: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
                },
              ].map(({ icon: Icon, label, desc, color }, i) => (
                <div key={label} className="relative">
                  {i < 3 && (
                    <span className="absolute top-9 right-0 translate-x-1/2 z-10 text-zinc-700 text-lg font-light select-none">
                      →
                    </span>
                  )}
                  <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-4 text-center space-y-3 h-full">
                    <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-xl border ${color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-[11px] font-bold text-white leading-tight">{label}</h3>
                    <p className="text-[9px] text-zinc-500 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES ──────────────────────────────────────────────────── */}
        <section className="relative bg-zinc-900/50 border-y border-zinc-800/60 px-10 py-12 overflow-hidden">
          <GridBg />
          <Glow className="bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-72 h-72 bg-brand-600/10" />

          <div className="relative">
            <div className="text-center mb-8">
              <p className="text-[9px] font-bold text-brand-400 uppercase tracking-widest mb-2">
                POR QUE USAR O {BRAND.name.toUpperCase()}?
              </p>
              <h2 className="text-2xl font-bold text-white">
                Mais resultado.{' '}
                <span className="text-brand-400">Menos esforço.</span>
              </h2>
              <p className="text-xs text-zinc-500 mt-2">
                Tudo que você precisa para viver de renda com afiliados, em um só lugar.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  icon: Bot,
                  title: 'Automação 100%',
                  desc: 'De início ao fim. Você nunca mais vai precisar procurar, criar, copiar ou divulgar.',
                },
                {
                  icon: Clock,
                  title: 'Funciona 24h por dia',
                  desc: 'Enquanto você dorme ou viaja, o sistema continua trabalhando.',
                },
                {
                  icon: DollarSign,
                  title: 'Mais comissões',
                  desc: 'Mais cliques, mais vendas e comissões entrando todos os dias.',
                },
                {
                  icon: Gem,
                  title: 'Renda extra (ou principal)',
                  desc: 'Transforme seu tempo livre em dinheiro com um sistema validado.',
                },
                {
                  icon: MousePointerClick,
                  title: 'Fácil de usar',
                  desc: 'Interface simples e intuitiva. Comece em poucos minutos.',
                },
                {
                  icon: Headphones,
                  title: 'Suporte de verdade',
                  desc: 'Suporte rápido e humanizado sempre que precisar.',
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="rounded-xl border border-zinc-800/60 bg-zinc-900 p-4 space-y-2 hover:border-brand-500/30 transition-colors"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10 border border-brand-500/20">
                    <Icon className="h-4.5 w-4.5 text-brand-400" />
                  </div>
                  <h3 className="text-xs font-bold text-white">{title}</h3>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS ──────────────────────────────────────────────── */}
        <section id="depoimentos" className="px-10 py-12">
          <div className="text-center mb-8">
            <p className="text-[9px] font-bold text-brand-400 uppercase tracking-widest mb-2">DEPOIMENTOS</p>
            <h2 className="text-2xl font-bold text-white">Quem usa, recomenda.</h2>
            <p className="text-xs text-zinc-500 mt-2">
              Veja o que nossos usuários estão dizendo sobre o {BRAND.name}.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              {
                text: 'O PoupOfertas mudou completamente meus resultados. Em uma semana já comecei a ver comissões entrando!',
                name: 'Rafael M.',
                role: 'Afiliado há 8 meses',
                initial: 'R',
                color: 'bg-orange-500',
              },
              {
                text: 'Automatizou tudo e hoje o sistema trabalha por mim. Melhor investimento que já fiz!',
                name: 'Juliana T.',
                role: 'Afiliada há 6 meses',
                initial: 'J',
                color: 'bg-amber-500',
              },
              {
                text: 'É simplesmente a ferramenta que todo afiliado precisava. Recomendo demais!',
                name: 'Lucas A.',
                role: 'Afiliado há 4 meses',
                initial: 'L',
                color: 'bg-rose-500',
              },
            ].map((t) => (
              <div key={t.name} className="rounded-xl border border-zinc-800/60 bg-zinc-900 p-5 space-y-3 flex flex-col">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed flex-1">
                  &ldquo;{t.text}&rdquo;
                </p>
                <div className="flex items-center gap-2.5 pt-1 border-t border-zinc-800/60">
                  <div
                    className={`h-7 w-7 rounded-full ${t.color} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}
                  >
                    {t.initial}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">{t.name}</p>
                    <p className="text-[9px] text-zinc-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── PRICING ───────────────────────────────────────────────────── */}
        <section id="precos" className="relative bg-zinc-900/30 border-t border-zinc-800/60 px-10 py-12 overflow-hidden">
          <Glow className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-64 bg-brand-600/10" />

          <div className="relative grid grid-cols-5 gap-8">
            {/* Left text */}
            <div className="col-span-2 space-y-5">
              <div>
                <p className="text-[9px] font-bold text-brand-400 uppercase tracking-widest mb-2">PLANOS</p>
                <h2 className="text-xl font-extrabold text-white leading-tight">
                  Investimento<br />pequeno,<br />
                  <span className="text-brand-400">retorno gigante.</span>
                </h2>
              </div>
              <ul className="space-y-2">
                {[
                  'Acesso completo a todas funcionalidades',
                  'Automação ilimitada',
                  'Suporte prioritário',
                  'Atualizações constantes',
                  '7 dias de garantia incondicional',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[10px] text-zinc-300">
                    <CheckCircle2 className="h-3 w-3 text-brand-400 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Plan cards */}
            <div className="col-span-3 space-y-3 flex flex-col justify-center">
              {mensalPlans.length > 0 ? (
                mensalPlans.map((plano) => (
                  <PlanCard key={plano.id} plano={plano} />
                ))
              ) : (
                <p className="text-xs text-zinc-600 text-center py-4">Carregando planos…</p>
              )}
              <p className="text-center text-[9px] text-zinc-600 pt-1">
                7 dias grátis • Sem cartão de crédito • Cancele quando quiser
              </p>
            </div>
          </div>

          {/* Guarantee badges */}
          <div className="relative grid grid-cols-4 gap-3 mt-10 pt-8 border-t border-zinc-800/60">
            {[
              {
                icon: ShieldCheck,
                title: 'Garantia 7 dias',
                desc: 'Use o PoupOfertas por 7 dias. Se não ficar satisfeito, devolvemos 100%.',
              },
              {
                icon: Lock,
                title: 'Ambiente seguro',
                desc: 'Seus dados estão sempre protegidos.',
              },
              {
                icon: CreditCard,
                title: 'Pagamento seguro',
                desc: 'Cartão, Pix e Boleto. 100% seguro.',
              },
              {
                icon: XCircle,
                title: 'Cancelamento fácil',
                desc: 'Cancele quando quiser em segundos.',
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex flex-col items-center text-center gap-1.5 p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/10 border border-brand-500/20">
                  <Icon className="h-4 w-4 text-brand-400" />
                </div>
                <p className="text-[10px] font-semibold text-white">{title}</p>
                <p className="text-[9px] text-zinc-600 leading-snug">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── FOOTER ───────────────────────────────────────────────────── */}
        <footer className="border-t border-zinc-800/60 px-10 py-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600">
              <Zap className="h-3 w-3 text-white" />
            </div>
            <span className="text-xs font-bold">
              <span className="text-brand-400">{BRAND.namePart1}</span>
              <span className="text-white">{BRAND.namePart2}</span>
            </span>
          </div>
          <p className="text-[10px] text-zinc-700">
            &copy; {new Date().getFullYear()} {BRAND.name}. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-4 text-[10px] text-zinc-600">
            <Link href="/login" className="hover:text-zinc-400 transition-colors">Entrar</Link>
            <Link href="/signup" className="hover:text-zinc-400 transition-colors">Cadastrar</Link>
          </div>
        </footer>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          RIGHT PANEL — Login form (sticky)
      ════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 bg-white dark:bg-zinc-950 overflow-y-auto">

        {/* Mobile logo (only on small screens) */}
        <Link href="/" className="mb-8 lg:hidden flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 shadow-lg shadow-brand-500/30">
            <Zap className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            <span className="text-brand-400">{BRAND.namePart1}</span>
            <span className="text-zinc-900 dark:text-white">{BRAND.namePart2}</span>
          </span>
        </Link>

        {/* Brand hint for desktop (above form) */}
        <div className="hidden lg:flex items-center gap-2.5 mb-8">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 shadow-lg shadow-brand-500/30">
            <Zap className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="text-base font-bold tracking-tight">
            <span className="text-brand-400">{BRAND.namePart1}</span>
            <span className="text-zinc-900 dark:text-white">{BRAND.namePart2}</span>
          </span>
        </div>

        {/* Form card */}
        <div className="w-full max-w-[400px]">
          <LoginForm />
        </div>

        {/* Trial reminder */}
        <p className="mt-6 text-xs text-zinc-400 dark:text-zinc-600 text-center">
          Não tem conta?{' '}
          <Link href="/signup" className="text-brand-500 hover:text-brand-400 font-semibold transition-colors">
            Comece com 7 dias grátis
          </Link>
        </p>
      </div>

    </div>
  );
}

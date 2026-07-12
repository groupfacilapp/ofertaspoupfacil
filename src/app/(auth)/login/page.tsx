export const revalidate = 3600;

import Image from 'next/image';
import Link from 'next/link';
import {
  Zap, ArrowRight, CheckCircle2, Star,
  Search, FileText, Link2, Send,
  Bot, Clock, DollarSign, Gem, MousePointerClick, Headphones,
  ShieldCheck, Lock, CreditCard, XCircle, Menu,
} from 'lucide-react';
import { BRAND } from '@/config/brand';
import { getActivePlans, type PlanRecord } from '@/lib/plans';
import { LoginForm } from '@/components/auth/login-form';

const PRODUCT_IMAGE = 'https://udlmqdwtisolgutzdylw.supabase.co/storage/v1/object/public/imagens/fotosite.png';

function formatPrice(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function PlanCard({ plano }: { plano: PlanRecord }) {
  const featured = plano.destaque;
  return (
    <div
      className={`rounded-2xl border flex flex-col overflow-hidden transition-all ${
        featured
          ? 'border-brand-500/40 shadow-xl shadow-brand-500/10 scale-[1.02]'
          : 'border-zinc-200'
      }`}
    >
      {featured && (
        <div className="bg-gradient-to-r from-brand-500 to-brand-600 text-white text-center text-[10px] font-bold tracking-widest py-1.5">
          🔥 MAIS ESCOLHIDO
        </div>
      )}
      <div className="bg-white p-6 flex flex-col flex-1 gap-4">
        <div>
          <h3 className="text-base font-bold text-zinc-900">{plano.nome}</h3>
          <p className="text-xs text-zinc-500 mt-0.5">{plano.descricao}</p>
        </div>

        <div className="flex items-end gap-1">
          <span className="text-sm text-zinc-400 mb-1">R$</span>
          <span className={`text-4xl font-extrabold tracking-tight ${featured ? 'text-brand-500' : 'text-zinc-900'}`}>
            {formatPrice(plano.valor)}
          </span>
          <span className="text-sm text-zinc-400 mb-1">/mês</span>
        </div>

        <ul className="space-y-1.5 flex-1">
          {plano.recursos.slice(0, 5).map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-zinc-600">
              <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${featured ? 'text-brand-500' : 'text-emerald-500'}`} />
              {r.replace(/\s*\(em breve\)/gi, '')}
            </li>
          ))}
        </ul>

        <Link
          href={plano.linkCheckout || '/signup'}
          className={`flex items-center justify-center gap-2 w-full rounded-xl px-5 py-3 text-sm font-semibold transition-all ${
            featured
              ? 'bg-brand-500 hover:bg-brand-600 text-white shadow-md shadow-brand-500/30'
              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'
          }`}
        >
          {featured ? 'Começar agora' : 'Escolher plano'}
          <ArrowRight className="h-3.5 w-3.5" />
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
    // silently handle
  }

  return (
    /* Full-screen overlay — visually overrides (auth)/layout */
    <div className="fixed inset-0 z-[100] bg-white text-zinc-900 overflow-y-auto">

      {/* ── NAV ─────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-zinc-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 shadow-md shadow-brand-500/30">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-bold tracking-tight">
              <span className="text-brand-500">{BRAND.namePart1}</span>
              <span className="text-zinc-900">{BRAND.namePart2}</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-500">
            <a href="#como-funciona" className="hover:text-zinc-900 transition-colors">Como funciona</a>
            <a href="#depoimentos" className="hover:text-zinc-900 transition-colors">Depoimentos</a>
            <a href="#precos" className="hover:text-zinc-900 transition-colors">Preços</a>
            <a href="#faq" className="hover:text-zinc-900 transition-colors">FAQ</a>
          </div>

          {/* Auth buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="#entrar"
              className="hidden sm:flex items-center rounded-lg border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-700 hover:text-zinc-900 text-sm font-semibold px-4 py-2 transition-all"
            >
              Entrar
            </a>
            <Link
              href="/signup"
              className="flex items-center gap-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 transition-all shadow-sm shadow-brand-500/20"
            >
              Cadastrar <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button className="sm:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500">
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────── */}
      <section className="relative bg-white pt-16 pb-20 overflow-hidden">
        {/* Subtle grid bg */}
        <div
          className="absolute inset-0 opacity-[0.015] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(#ea580c 1px, transparent 1px), linear-gradient(to right, #ea580c 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        {/* Subtle glow */}
        <div className="absolute top-0 right-1/4 w-[600px] h-[400px] bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            {/* LEFT — Copy */}
            <div className="space-y-7">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/5 px-4 py-1.5 text-xs font-semibold text-brand-600 tracking-wide">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
                Ferramenta de Automação para Afiliados
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl xl:text-[3.25rem] font-extrabold tracking-tight leading-[1.1] text-zinc-900">
                Automação que<br />
                transforma links<br />
                <span className="text-brand-500">em renda.</span>
              </h1>

              {/* Description */}
              <p className="text-base text-zinc-500 leading-relaxed max-w-lg">
                O {BRAND.name} encontra produtos em alta, cria todo o conteúdo, gera seus links de
                afiliado e divulga nos seus canais por você. Mais resultado, menos esforço.
              </p>

              {/* Mini features */}
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { icon: Search,   label: 'Encontra produtos em alta' },
                  { icon: FileText, label: 'Cria conteúdo automático' },
                  { icon: Link2,    label: 'Gera links de afiliado' },
                  { icon: Send,     label: 'Publica e divulga por você' },
                ].map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2.5 rounded-xl bg-zinc-50 border border-zinc-100 px-3.5 py-2.5"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-500/10">
                      <Icon className="h-3.5 w-3.5 text-brand-600" />
                    </div>
                    <span className="text-xs font-medium text-zinc-700">{label}</span>
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href="/signup"
                  className="flex items-center gap-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm px-7 py-3.5 transition-all shadow-lg shadow-brand-500/25"
                >
                  QUERO COMEÇAR AGORA <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#entrar"
                  className="flex items-center gap-2 rounded-xl border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-700 text-sm font-medium px-6 py-3.5 transition-all"
                >
                  Já tenho conta
                </a>
              </div>

              {/* Social proof */}
              <div className="flex items-center gap-3 pt-1">
                <div className="flex -space-x-2">
                  {[
                    { bg: 'bg-orange-500', i: 'R' },
                    { bg: 'bg-amber-500',  i: 'J' },
                    { bg: 'bg-rose-500',   i: 'L' },
                    { bg: 'bg-yellow-500', i: 'M' },
                    { bg: 'bg-red-500',    i: 'A' },
                  ].map(({ bg, i }, idx) => (
                    <div
                      key={idx}
                      className={`h-8 w-8 rounded-full ${bg} border-2 border-white flex items-center justify-center text-[10px] font-bold text-white`}
                    >
                      {i}
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">+2.500 usuários</p>
                  <p className="text-xs text-zinc-400">estão lucrando com o {BRAND.name}</p>
                </div>
              </div>
            </div>

            {/* RIGHT — Product screenshot */}
            <div className="relative flex items-center justify-center">
              <div className="relative w-full max-w-[580px]">
                {/* Glow behind image */}
                <div className="absolute inset-0 -m-4 rounded-3xl bg-gradient-to-br from-brand-500/10 to-orange-500/5 blur-xl" />
                <Image
                  src={PRODUCT_IMAGE}
                  alt={`Dashboard do ${BRAND.name} — automação de ofertas`}
                  width={580}
                  height={380}
                  className="relative rounded-2xl shadow-2xl shadow-zinc-300/60 border border-zinc-100 w-full h-auto object-cover"
                  priority
                />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── MARKETPLACE STRIP ───────────────────────────────────────── */}
      <section className="bg-zinc-50 border-y border-zinc-100 py-7">
        <div className="max-w-5xl mx-auto px-5">
          <p className="text-center text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-5">
            Compatível com os principais marketplaces
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {[
              { label: 'Shopee',        color: 'text-red-600',    bg: 'bg-red-50 border-red-200' },
              { label: 'amazon',        color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
              { label: 'Mercado Livre', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
              { label: 'AliExpress',    color: 'text-rose-600',   bg: 'bg-rose-50 border-rose-200' },
              { label: 'KaBuM!',        color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200' },
            ].map((m) => (
              <span
                key={m.label}
                className={`inline-flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-semibold ${m.color} ${m.bg}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {m.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA ────────────────────────────────────────────── */}
      <section id="como-funciona" className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-5">
          <div className="text-center mb-12">
            <p className="text-xs font-bold text-brand-500 uppercase tracking-widest mb-3">COMO FUNCIONA</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900">
              Você relaxa, o <span className="text-brand-500">{BRAND.name}</span> trabalha.
            </h2>
            <p className="text-sm text-zinc-500 mt-3 max-w-md mx-auto">
              Em 4 passos simples, o sistema faz tudo por você — 24 horas por dia.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {[
              {
                icon: Search,
                label: 'Encontra produtos em alta',
                desc: 'O sistema rastreia os principais marketplaces e encontra os mais promissores.',
                color: 'bg-orange-50 border-orange-100 text-orange-600',
              },
              {
                icon: FileText,
                label: 'Cria o conteúdo automático',
                desc: 'Legendas, textos e descrições prontas e otimizadas para gerar mais cliques.',
                color: 'bg-amber-50 border-amber-100 text-amber-600',
              },
              {
                icon: Link2,
                label: 'Gera os links de afiliado',
                desc: 'Cria seus links de afiliado automaticamente, prontos para converter.',
                color: 'bg-orange-50 border-orange-100 text-orange-600',
              },
              {
                icon: Send,
                label: 'Publica e divulga por você',
                desc: 'Envia nos seus canais automaticamente e mantém tudo funcionando.',
                color: 'bg-violet-50 border-violet-100 text-violet-600',
              },
            ].map(({ icon: Icon, label, desc, color }, i) => (
              <div key={label} className="relative">
                {i < 3 && (
                  <span className="hidden md:block absolute top-10 right-0 translate-x-1/2 z-10 text-zinc-300 text-2xl select-none font-light">
                    →
                  </span>
                )}
                <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm hover:shadow-md p-6 text-center space-y-4 h-full transition-shadow">
                  <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl border ${color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-bold text-zinc-900 leading-snug">{label}</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────── */}
      <section className="bg-zinc-50 border-y border-zinc-100 py-20">
        <div className="max-w-6xl mx-auto px-5">
          <div className="text-center mb-12">
            <p className="text-xs font-bold text-brand-500 uppercase tracking-widest mb-3">FUNCIONALIDADES</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900">
              Mais resultado. <span className="text-brand-500">Menos esforço.</span>
            </h2>
            <p className="text-sm text-zinc-500 mt-3">
              Tudo que você precisa para viver de renda com afiliados, em um só lugar.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
                className="rounded-2xl border border-zinc-200 bg-white shadow-sm hover:shadow-md p-6 space-y-3 transition-all hover:-translate-y-0.5"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/10 border border-brand-500/20">
                  <Icon className="h-5 w-5 text-brand-600" />
                </div>
                <h3 className="text-sm font-bold text-zinc-900">{title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────── */}
      <section id="depoimentos" className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-5">
          <div className="text-center mb-12">
            <p className="text-xs font-bold text-brand-500 uppercase tracking-widest mb-3">DEPOIMENTOS</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900">Quem usa, recomenda.</h2>
            <p className="text-sm text-zinc-500 mt-3">
              Veja o que nossos usuários estão dizendo sobre o {BRAND.name}.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
              <div
                key={t.name}
                className="rounded-2xl border border-zinc-100 bg-white shadow-sm hover:shadow-md p-7 flex flex-col gap-4 transition-shadow"
              >
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-zinc-600 leading-relaxed flex-1">
                  &ldquo;{t.text}&rdquo;
                </p>
                <div className="flex items-center gap-3 pt-2 border-t border-zinc-100">
                  <div
                    className={`h-9 w-9 rounded-full ${t.color} flex items-center justify-center text-xs font-bold text-white shrink-0`}
                  >
                    {t.initial}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">{t.name}</p>
                    <p className="text-xs text-zinc-400">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────────── */}
      <section id="precos" className="bg-zinc-50 border-y border-zinc-100 py-20">
        <div className="max-w-5xl mx-auto px-5">
          <div className="text-center mb-12">
            <p className="text-xs font-bold text-brand-500 uppercase tracking-widest mb-3">PLANOS</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900">
              Investimento pequeno,{' '}
              <span className="text-brand-500">retorno gigante.</span>
            </h2>
            <p className="text-sm text-zinc-500 mt-3">
              Comece grátis por 7 dias. Sem cartão de crédito.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {mensalPlans.length > 0
              ? mensalPlans.map((plano) => (
                  <PlanCard key={plano.id} plano={plano} />
                ))
              : <p className="col-span-3 text-center text-sm text-zinc-400 py-8">Carregando planos…</p>
            }
          </div>

          {/* Guarantee badges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 pt-12 border-t border-zinc-200">
            {[
              { icon: ShieldCheck, title: 'Garantia 7 dias', desc: 'Devolução total sem perguntas.' },
              { icon: Lock,        title: 'Ambiente seguro', desc: 'Seus dados sempre protegidos.' },
              { icon: CreditCard,  title: 'Pagamento seguro', desc: 'Cartão, Pix e Boleto.' },
              { icon: XCircle,     title: 'Cancele quando quiser', desc: 'Sem fidelidade ou multa.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex flex-col items-center text-center gap-2 p-4 rounded-xl bg-white border border-zinc-100">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/10">
                  <Icon className="h-4.5 w-4.5 text-brand-600" />
                </div>
                <p className="text-xs font-semibold text-zinc-900">{title}</p>
                <p className="text-[11px] text-zinc-400 leading-snug">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LOGIN FORM ────────────────────────────────────────────────── */}
      <section id="entrar" className="bg-white py-20">
        <div className="max-w-md mx-auto px-5">
          <div className="text-center mb-8">
            <p className="text-xs font-bold text-brand-500 uppercase tracking-widest mb-3">ACESSO</p>
            <h2 className="text-2xl font-bold text-zinc-900">Bem-vindo de volta</h2>
            <p className="text-sm text-zinc-500 mt-2">Entre na sua conta para continuar</p>
          </div>
          <div className="rounded-2xl border border-zinc-100 bg-white shadow-xl shadow-zinc-100 p-8">
            <LoginForm />
          </div>
          <p className="text-center text-sm text-zinc-400 mt-6">
            Não tem conta?{' '}
            <Link href="/signup" className="text-brand-500 hover:text-brand-600 font-semibold transition-colors">
              Criar conta grátis — 7 dias grátis
            </Link>
          </p>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────── */}
      <footer className="bg-zinc-900 text-white">
        <div className="max-w-7xl mx-auto px-5 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600">
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-bold">
              <span className="text-brand-400">{BRAND.namePart1}</span>
              <span className="text-white">{BRAND.namePart2}</span>
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            &copy; {new Date().getFullYear()} {BRAND.name}. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <a href="#entrar" className="hover:text-zinc-300 transition-colors">Entrar</a>
            <Link href="/signup" className="hover:text-zinc-300 transition-colors">Cadastrar</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}

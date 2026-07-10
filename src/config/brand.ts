/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║                  WHITE-LABEL BRAND CONFIG                       ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  Mude aqui para rebrandear a plataforma completamente.          ║
 * ║  Após salvar, reinicie o servidor de desenvolvimento.           ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * CHECKLIST DE WHITE-LABEL:
 *
 * ✅ Nome da plataforma  → altere `name`, `namePart1`, `namePart2` abaixo
 * ✅ Tagline / descrição → altere `tagline`, `description` abaixo
 * ✅ Período de teste    → altere `trial.enabled` e `trial.days` abaixo
 *                          ⚠️  ATENÇÃO: desabilitar o trial também requer
 *                          alterar a função SQL `on_auth_user_created` no Supabase
 * ✅ Suporte             → altere `support.whatsapp` e/ou `support.email` abaixo
 *
 * ✅ Cores da marca      → edite as variáveis CSS em /src/app/globals.css
 *                          Seção "BRAND COLORS" (--brand-600, --brand-500, --brand-400)
 *                          Isso afeta o componente Logo e os botões primários.
 *                          Lembre de atualizar os SVGs em /public/brand/ com os mesmos hex.
 *
 * ✅ Logos               → substitua os arquivos em /public/brand/
 *                          logo-icon.svg        → ícone 32×32
 *                          logo-full.svg        → logo completa (fundo transparente)
 *                          logo-full-dark-bg.svg→ logo com fundo zinc-950
 *
 * ✅ Favicon             → substitua /src/app/icon.svg
 *                          ⚠️  DEVE ficar em src/app/ — requisito do Next.js App Router
 *                          Mantenha idêntico ao logo-icon.svg
 *
 * Ver guia completo em: /public/brand/README.md
 */

export const BRAND = {
  // ── Identidade ──────────────────────────────────────────────────────────────
  name: 'PoupOfertas',
  namePart1: 'Poup',   // exibido na cor primária (indigo-400)
  namePart2: 'Ofertas',        // exibido em branco

  tagline: 'Automação de Afiliados para WhatsApp + Telegram',
  description: 'Disparo automatizado de ofertas de afiliado. Conecte marketplaces, configure grupos e dispare no automático.',

  // ── Período de teste ────────────────────────────────────────────────────────
  // Para desabilitar o trial:
  //   1. Mude enabled para false (remove UI do trial)
  //   2. No Supabase SQL Editor, edite a função `on_auth_user_created`
  //      e remova o plano 'trial' / ajuste plan_expires_at para null
  trial: {
    enabled: true,
    days: 7,
    label: '7 dias grátis',
    labelShort: '7 dias',
  },

  // ── Suporte ─────────────────────────────────────────────────────────────────
  support: {
    whatsapp: '',   // ex: 'https://wa.me/5511999999999'
    email: '',      // ex: 'suporte@poupofertas.com'
    label: 'Suporte por WhatsApp',
  },

  // ── URLs internas ───────────────────────────────────────────────────────────
  urls: {
    landing: '/lp',
    login: '/login',
    signup: '/signup',
    dashboard: '/',
    plans: '/planos',
  },
} as const;

export type BrandConfig = typeof BRAND;

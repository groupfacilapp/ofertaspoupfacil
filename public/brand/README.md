# /public/brand — Arquivos de Logo e Identidade Visual

Substitua os arquivos aqui para atualizar a identidade visual em toda a plataforma.

## Arquivos desta pasta

| Arquivo | Uso | Dimensões |
|---|---|---|
| `logo-icon.svg` | Favicon, ícone da aba, notificações | 32×32 |
| `logo-full.svg` | OG images, emails, documentos (fundo transparente) | 168×40 |
| `logo-full-dark-bg.svg` | Versão com fundo zinc-950 (capturas de tela, apresentações) | 168×48 |

## Como trocar a logo

1. Substitua o arquivo desejado pelo seu SVG com o **mesmo nome**
2. Para o favicon: atualize também `/src/app/icon.svg` (deve ser idêntico ao `logo-icon.svg`)
3. Reinicie o servidor: `npm run dev`

## Favicon

O Next.js usa automaticamente `/src/app/icon.svg` como favicon da aba e PWA.
**Este arquivo PRECISA ficar em `src/app/`** — é um requisito do Next.js App Router
para detecção automática de favicon. Não é possível movê-lo para cá.

Ao trocar a logo, atualize os dois:
1. `public/brand/logo-icon.svg` (referência/arquivo original)
2. `src/app/icon.svg` (cópia idêntica — usada pelo Next.js como favicon)

## Paleta atual

| Cor | Hex | Tailwind | Uso |
|---|---|---|---|
| Indigo 600 | `#4f46e5` | `indigo-600` | Fundo do ícone, botões primários |
| Indigo 400 | `#818cf8` | `indigo-400` | Primeira parte do nome, acentos |
| Branco | `#ffffff` | `white` | Ícone, segunda parte do nome |
| Zinc 950 | `#09090b` | `zinc-950` | Fundo geral da plataforma |

---

## Guia Completo de White-Label

Para rebrandear a plataforma completamente (trocar o nome, logo e cores):

### 1. Nome e configurações — `src/config/brand.ts`

É o arquivo central. Mude aqui:
- `name` → nome completo (ex: `'MeuBot'`)
- `namePart1` / `namePart2` → partes do nome com cores diferentes
- `tagline` / `description` → slogan e descrição do produto
- `trial.enabled` / `trial.days` → habilitar/desabilitar período de teste
- `support.whatsapp` / `support.email` → links de suporte

> ⚠️ Ao desabilitar o trial (`trial.enabled: false`), lembre de editar também
> a função SQL `on_auth_user_created` no Supabase SQL Editor para remover
> o plano `'trial'` no momento do cadastro.

### 2. Logos — `/public/brand/` e `/src/app/icon.svg`

Substituir os 4 arquivos:
- `public/brand/logo-icon.svg` — ícone 32×32
- `public/brand/logo-full.svg` — logo completa (fundo transparente)
- `public/brand/logo-full-dark-bg.svg` — logo completa (fundo escuro)
- `src/app/icon.svg` — favicon (cópia idêntica do logo-icon.svg)

### 3. Componente de Logo React — `src/components/brand/Logo.tsx`

Usado em toda a plataforma (header, auth, sidebar).
Se trocar por imagens PNG ao invés de SVG inline, atualize este componente.
Atualmente renderiza o ícone com Lucide `Zap` + texto do `BRAND.namePart1`/`BRAND.namePart2`.

### 4. Cores — `src/app/globals.css`

Troque **apenas** as variáveis na seção "BRAND COLORS" no topo do arquivo:

```css
:root {
  --brand-600: #4f46e5;  /* cor principal — fundo do ícone, botões */
  --brand-500: #6366f1;  /* hover, sombras */
  --brand-400: #818cf8;  /* acentos, texto de destaque, nome no logo */
}
```

Isso atualiza automaticamente o componente Logo e qualquer classe `brand-*` no código.
Após mudar o CSS, atualize também os hex nos arquivos SVG desta pasta.

### 5. Metadados SEO — `src/app/layout.tsx`

Já usa `BRAND.name` e `BRAND.description` automaticamente via metadata do Next.js.
Nenhuma mudança necessária se o brand.ts estiver correto.

### 6. Arquivos que usam o nome da plataforma

Todos já usam `BRAND.name` via import — nenhum está hardcoded:

| Arquivo | Uso |
|---|---|
| `src/app/layout.tsx` | `<title>` e meta description |
| `src/app/(auth)/layout.tsx` | Copyright no rodapé |
| `src/app/(auth)/signup/page.tsx` | Texto da página de cadastro |
| `src/components/auth/signup-form.tsx` | "Comece a usar o {nome} hoje" |
| `src/app/(admin)/layout.tsx` | Header do painel admin |
| `src/app/(admin)/admin/page.tsx` | Subtítulo da visão geral |
| `src/app/(dashboard)/historico/page.tsx` | Subtítulo da página de histórico |
| `src/app/lp/page.tsx` | Landing page (textos de marketing) |
| `src/components/brand/Logo.tsx` | Componente de logo reutilizável |

> **Nota:** `src/app/lp/page.tsx` contém copy de marketing com textos mais longos.
> Revise manualmente os textos da landing page ao rebrandear.

### 7. Configuração de planos — verificar no Supabase

Os planos (trial, starter, pro, etc.) estão definidos no banco de dados.
Para mudar preços, limites ou nomes de planos, edite via Supabase SQL Editor
ou via painel admin da plataforma.

---

## Checklist rápido de rebranding

- [ ] Editar `src/config/brand.ts` (nome, tagline, trial, suporte)
- [ ] Substituir `public/brand/logo-icon.svg`
- [ ] Substituir `public/brand/logo-full.svg`
- [ ] Substituir `public/brand/logo-full-dark-bg.svg`
- [ ] Atualizar `src/app/icon.svg` (idêntico ao logo-icon.svg)
- [ ] Revisar textos de marketing em `src/app/lp/page.tsx`
- [ ] (Opcional) Trocar cores indigo por cor primária da nova marca
- [ ] (Opcional) Atualizar `support.whatsapp` e `support.email` no brand.ts
- [ ] Se desabilitar trial: editar função SQL `on_auth_user_created` no Supabase
- [ ] Reiniciar servidor de desenvolvimento: `npm run dev`

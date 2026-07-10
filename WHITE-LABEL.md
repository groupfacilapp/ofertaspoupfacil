# White-Label — Como personalizar a plataforma

## 1. Nome da plataforma

Abra o arquivo `src/config/brand.ts` e altere:

```ts
name: 'PoupOfertas',      // nome completo (usado nos textos)
namePart1: 'Poup',    // primeira parte — exibida na cor da marca
namePart2: 'Ofertas',        // segunda parte — exibida em branco
tagline: 'Automação de Afiliados para WhatsApp + Telegram',
```

Salve e reinicie o servidor. O nome propaga automaticamente para toda a plataforma.

---

## 2. Logos

Substitua os arquivos abaixo em `/public/brand/`. Mantenha os mesmos nomes de arquivo.

| Arquivo | Uso | Dimensões |
|---|---|---|
| `logo-icon.svg` | Ícone na sidebar e favicon | 32 × 32 px |
| `logo-full.svg` | Logo completa (fundo transparente) | 160 × 40 px |
| `logo-full-dark-bg.svg` | Logo completa (fundo escuro zinc-950) | 160 × 40 px |

Substitua também o favicon:

| Arquivo | Uso | Dimensões |
|---|---|---|
| `src/app/icon.svg` | Favicon do navegador | 32 × 32 px |

> Mantenha `icon.svg` idêntico ao `logo-icon.svg`.

---

## 3. Cores da marca (opcional)

Edite as variáveis CSS em `src/app/globals.css`, seção `BRAND COLORS`:

```css
--brand-600: #4f46e5;   /* botões, hover */
--brand-500: #6366f1;   /* cor principal */
--brand-400: #818cf8;   /* textos, destaques */
```

---

## Resumo rápido

1. `src/config/brand.ts` → muda o nome
2. `/public/brand/` → substitui as 3 logos
3. `src/app/icon.svg` → substitui o favicon
4. `src/app/globals.css` → ajusta as cores (opcional)

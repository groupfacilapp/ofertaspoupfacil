/**
 * Pure client+server-safe message formatting utilities.
 * No server-only imports allowed here.
 */
import type { NormalizedOffer } from './connectors/types';

export const DEFAULT_TEMPLATE = `🔥 *{titulo}*

{preco_completo} 👊{cupom_line}{parcelamento_line}

Loja oficial — {marketplace}:
{link}
---
😱 *CORRE, VAI ACABAR!*

{titulo}

{preco_completo} 👊{cupom_line}{parcelamento_line}

{marketplace}: {link}
---
💡 Você viu essa oferta?

*{titulo}*

{preco_completo} 👊{cupom_line}{parcelamento_line}

{marketplace} 👉 {link}`;

export function splitTemplateVariants(template: string): string[] {
  return template
    .split(/\n---\n/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

export function formatMessage(template: string, offer: NormalizedOffer): string {
  const variants = splitTemplateVariants(template);
  const chosen = variants[Math.floor(Math.random() * variants.length)];

  const preco = (offer.currentPrice / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const hasDiscount = offer.originalPrice !== null && offer.originalPrice > offer.currentPrice;
  const precoAntigo = hasDiscount
    ? (offer.originalPrice! / 100).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : preco;
  const desconto = offer.discountPercent ?? 0;
  const descontoLine = desconto > 0 ? ` (${desconto}% OFF)` : '';
  // {preco_completo}: shows "De ~R$ X~ por *R$ Y*" when there's a real discount, else "Por *R$ Y*"
  const precoCompleto = hasDiscount
    ? `De ~R$ ${precoAntigo}~ por *R$ ${preco}*${descontoLine}`
    : `Por *R$ ${preco}*`;

  const parcelamentoLine = offer.installments ? `\n💳 ${offer.installments}` : '';
  const cupomLine = offer.couponCode ? `\n🏷️ Cupom: *${offer.couponCode}*` : '';

  const marketplaceLabel: Record<string, string> = {
    amazon: 'Amazon BR',
    mercadolivre: 'Mercado Livre',
    shopee: 'Shopee',
    aliexpress: 'AliExpress',
    kabum: 'KaBuM!',
  };

  return chosen
    .replace(/\{titulo\}/g, offer.title)
    .replace(/\{preco_completo\}/g, precoCompleto)
    .replace(/\{preco\}/g, preco)
    .replace(/\{preco_antigo\}/g, precoAntigo)
    .replace(/\{desconto\}/g, String(desconto))
    .replace(/\{desconto_line\}/g, descontoLine)
    // Legacy: remove "(0% OFF)" from old custom templates
    .replace(/\s*\(0%\s*OFF\)/gi, '')
    // Legacy: "De ~R$ X~ por [apenas] *R$ X*" → "Por *R$ X*" when prices equal (no discount)
    .replace(/De ~R\$ ([^~]+)~ por(?: apenas)? \*R\$ \1\*/g, 'Por *R$ $1*')
    .replace(/\{link\}/g, offer.affiliateLink ?? offer.productUrl)
    .replace(/\{marketplace\}/g, marketplaceLabel[offer.marketplace] ?? offer.marketplace)
    .replace(/\{cupom\}/g, offer.couponCode ?? '')
    .replace(/\{cupom_line\}/g, cupomLine)
    .replace(/\{pix_line\}/g, '')
    .replace(/\{parcelamento_line\}/g, parcelamentoLine)
    .replace(/\{imagem\}/g, offer.imageUrl ?? '');
}

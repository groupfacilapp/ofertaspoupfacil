'use client';

const mockOffer = {
  titulo: 'Fone Bluetooth JBL Tune 510BT',
  preco: 'R$ 149,90',
  preco_antigo: 'R$ 279,90',
  desconto: '46',
  marketplace: 'Amazon BR',
  link: 'https://amzn.to/exemplo',
  parcelamento_line: '\n💳 Em 5x de R$ 29,98 sem juros',
  cupom_line: '\n🏷️ Cupom: *SAVE15*',
  cupom: 'SAVE15',
  pix_line: '',
};

function renderVariant(variant: string): string {
  const preview = variant
    .replace(/\{titulo\}/g, mockOffer.titulo)
    .replace(/\{preco\}/g, mockOffer.preco)
    .replace(/\{preco_antigo\}/g, mockOffer.preco_antigo)
    .replace(/\{desconto\}/g, mockOffer.desconto)
    .replace(/\{marketplace\}/g, mockOffer.marketplace)
    .replace(/\{link\}/g, mockOffer.link)
    .replace(/\{parcelamento_line\}/g, mockOffer.parcelamento_line)
    .replace(/\{cupom_line\}/g, mockOffer.cupom_line)
    .replace(/\{cupom\}/g, mockOffer.cupom)
    .replace(/\{pix_line\}/g, mockOffer.pix_line)
    .replace(/\{imagem\}/g, '[imagem]');

  const escaped = preview
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return escaped
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
    .replace(/~(.*?)~/g, '<del>$1</del>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

export function TemplatePreview({ template }: { template: string }) {
  const variants = template
    .split(/\n---\n/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);

  return (
    <div className="rounded-xl border border-zinc-700/60 bg-zinc-800/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium text-zinc-600 uppercase tracking-wide">
          Preview (dados fictícios)
        </p>
        {variants.length > 1 && (
          <span className="text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
            {variants.length} variantes — escolha aleatória por disparo
          </span>
        )}
      </div>

      {variants.map((variant, i) => (
        <div key={i} className="space-y-1">
          {variants.length > 1 && (
            <p className="text-[9px] text-zinc-700 uppercase tracking-wider">
              Variante {i + 1}
            </p>
          )}
          <div
            className="text-xs text-zinc-300 leading-relaxed font-sans bg-zinc-900/40 rounded-lg p-3"
            dangerouslySetInnerHTML={{ __html: renderVariant(variant) }}
          />
        </div>
      ))}
    </div>
  );
}

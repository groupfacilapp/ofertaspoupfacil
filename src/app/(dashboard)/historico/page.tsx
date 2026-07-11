export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { Package } from 'lucide-react';
import { formatMessage } from '@/lib/dispatch';
import type { NormalizedOffer } from '@/lib/connectors/types';
import { HistoricoClient } from './components/HistoricoClient';
import { BRAND } from '@/config/brand';

export default async function HistoricoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Fetch up to 500 logs for filter/pagination on client side
  const { data: logs } = await supabaseAdmin
    .from('dispatch_logs')
    .select(`
      id,
      status,
      error_message,
      dispatched_at,
      dispatched_date,
      offers (
        title,
        marketplace,
        current_price,
        original_price,
        discount_percent,
        image_url,
        affiliate_link,
        product_url,
        installments,
        external_id
      ),
      dispatch_groups (
        name,
        template_text
      )
    `)
    .eq('user_id', user.id)
    .order('dispatched_at', { ascending: false })
    .limit(500);

  const DEFAULT_TEMPLATE = `🔥 *{titulo}*\n\n💰 De ~R$ {preco_antigo}~ por *R$ {preco}* ({desconto}% OFF){parcelamento_line}\n\n🛍️ {marketplace}\n🔗 {link}`;

  const total = logs?.length ?? 0;
  const sent = logs?.filter(l => ['sent', 'delivered', 'read'].includes(l.status)).length ?? 0;
  const failed = logs?.filter(l => l.status === 'failed').length ?? 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logEntries = (logs ?? []).map((log: any) => {
    const offer = log.offers;
    const group = log.dispatch_groups;
    const template = group?.template_text ?? DEFAULT_TEMPLATE;

    let message = '';
    if (offer) {
      const normalized: NormalizedOffer = {
        externalId: offer.external_id ?? '',
        marketplace: offer.marketplace ?? 'mercadolivre',
        title: offer.title ?? '',
        currentPrice: offer.current_price ?? 0,
        originalPrice: offer.original_price ?? null,
        discountPercent: offer.discount_percent ?? null,
        imageUrl: offer.image_url ?? '',
        productUrl: offer.product_url ?? '',
        affiliateLink: offer.affiliate_link ?? null,
        condition: null,
        installments: offer.installments ?? null,
        category: null,
        sales: null,
        couponCode: null,
      };
      message = formatMessage(template, normalized);
    }

    return {
      id: log.id,
      status: log.status,
      error_message: log.error_message ?? null,
      dispatched_at: log.dispatched_at,
      dispatched_date: (log as Record<string, unknown>).dispatched_date as string ?? '',
      message,
      offer: offer
        ? {
            title: offer.title ?? null,
            marketplace: offer.marketplace ?? null,
            current_price: offer.current_price ?? null,
            discount_percent: offer.discount_percent ?? null,
            image_url: offer.image_url ?? null,
            affiliate_link: offer.affiliate_link ?? null,
            product_url: offer.product_url ?? null,
          }
        : null,
      group_name: group?.name ?? null,
    };
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Histórico de Disparos</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Todas as ofertas enviadas pelo {BRAND.name}.
        </p>
      </div>

      {total === 0 ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/40 p-10 text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-zinc-200/80 dark:bg-zinc-800/80 p-4">
              <Package className="h-7 w-7 text-zinc-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-zinc-400 mb-1">Nenhum disparo ainda</p>
          <p className="text-xs text-zinc-600">
            Configure um grupo e faça um disparo manual para começar.
          </p>
        </div>
      ) : (
        <HistoricoClient logs={logEntries} total={total} sent={sent} failed={failed} />
      )}
    </div>
  );
}

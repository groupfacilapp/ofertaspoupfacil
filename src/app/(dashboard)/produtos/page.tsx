export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getProductQueue, getProductStats } from '@/lib/queries/products';
import { ProdutosClient } from './components/ProdutosClient';

const PAGE_SIZE = 50;

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const mp = typeof params.mp === 'string' ? params.mp : undefined;
  const statusParam = typeof params.status === 'string' ? params.status : undefined;
  const status =
    statusParam === 'pending' || statusParam === 'sent' || statusParam === 'failed'
      ? statusParam
      : undefined;
  const q = typeof params.q === 'string' && params.q ? params.q : undefined;

  const [{ items: products, total }, stats, groupsResult, mpResult] = await Promise.all([
    getProductQueue(user.id, { marketplace: mp, status, search: q, page, limit: PAGE_SIZE }),
    getProductStats(user.id),
    supabaseAdmin
      .from('dispatch_groups')
      .select(`
        id, name, marketplaces, template_text,
        group_destinations(id, target_name, channel_type)
      `)
      .eq('user_id', user.id)
      .eq('is_active', true),
    supabaseAdmin
      .from('marketplace_connections')
      .select('marketplace')
      .eq('user_id', user.id)
      .eq('is_valid', true),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groups = (groupsResult.data ?? []).map((g: any) => ({
    id: g.id as string,
    name: g.name as string,
    marketplaces: g.marketplaces as string[],
    template_text: g.template_text as string | null,
    destinationsCount: (g.group_destinations ?? []).filter(
      (d: { channel_type: string }) => d.channel_type === 'whatsapp'
    ).length,
  }));

  const connectedMarketplaces = (mpResult.data ?? []).map((m) => m.marketplace as string);

  return (
    <ProdutosClient
      key={`${page}-${mp ?? ''}-${status ?? ''}-${q ?? ''}`}
      products={products}
      stats={stats}
      groups={groups}
      connectedMarketplaces={connectedMarketplaces}
      totalItems={total}
      currentPage={page}
      pageSize={PAGE_SIZE}
      initialFilters={{
        marketplace: mp ?? 'all',
        status: status ?? 'all',
        search: q ?? '',
      }}
    />
  );
}

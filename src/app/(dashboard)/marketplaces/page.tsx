export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { MarketplaceCard, type MarketplaceStatus } from './components/MarketplaceCard';

const ALL_MARKETPLACES: Array<'amazon' | 'mercadolivre' | 'shopee' | 'aliexpress' | 'kabum' | 'temu' | 'shein'> = [
  'amazon',
  'mercadolivre',
  'shopee',
  'aliexpress',
  'kabum',
  'temu',
  'shein',
];

export default async function MarketplacesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Load existing connections for this user
  const { data: connections } = await supabase
    .from('marketplace_connections')
    .select('*')
    .eq('user_id', user?.id ?? '');

  // Build a map from DB results, fill in nulls for unconnected marketplaces
  const connectionMap = new Map(
    (connections ?? []).map((c) => [c.marketplace, c])
  );

  const statuses: MarketplaceStatus[] = ALL_MARKETPLACES.map((marketplace) => {
    const conn = connectionMap.get(marketplace);
    return {
      marketplace,
      is_valid: conn?.is_valid ?? null,
      last_validated_at: conn?.last_validated_at ?? null,
      validation_error: conn?.validation_error ?? null,
      encrypted_credentials: conn?.encrypted_credentials ?? null,
      last_fetch_error: conn?.last_fetch_error ?? null,
      last_fetch_error_at: conn?.last_fetch_error_at ?? null,
      last_fetch_success_at: conn?.last_fetch_success_at ?? null,
    };
  });

  const connectedCount = statuses.filter((s) => !!s.encrypted_credentials).length;

  return (
    <div className="space-y-6 max-w-5xl md:px-2 md:py-2">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-white tracking-tight">Marketplaces</h1>
          <p className="text-sm text-zinc-400 mt-2">
            Configure suas credenciais de afiliado.{' '}
            {connectedCount > 0 ? (
              <span className="text-emerald-400 font-medium">{connectedCount} de 5 conectados.</span>
            ) : (
              'Nenhum marketplace conectado ainda.'
            )}
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {statuses.map((status) => (
          <MarketplaceCard key={status.marketplace} status={status} />
        ))}
      </div>
    </div>
  );
}

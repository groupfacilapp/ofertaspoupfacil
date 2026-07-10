'use server';

import { createClient } from '@/lib/supabase/server';
import { saveMarketplaceCredentials } from '@/lib/credentials';
import { getConnector } from '@/lib/connectors/registry';
import { canConnectMarketplace } from '@/lib/plans';
import type { DecryptedCredentials } from '@/lib/connectors/types';

// Side-effect imports — each connector calls registerConnector() on load
import '@/lib/connectors/amazon';
import '@/lib/connectors/mercadolivre';
import '@/lib/connectors/shopee';
import '@/lib/connectors/aliexpress';
import '@/lib/connectors/kabum';
import '@/lib/connectors/temu';
import '@/lib/connectors/shein';

export async function getMarketplaceCredentials(
  marketplace: string
): Promise<Record<string, string> | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('marketplace_connections')
    .select('encrypted_credentials')
    .eq('user_id', user.id)
    .eq('marketplace', marketplace)
    .single();

  if (!data?.encrypted_credentials) return null;

  try {
    const { loadMarketplaceCredentials } = await import('@/lib/credentials');
    return loadMarketplaceCredentials(data.encrypted_credentials);
  } catch {
    return null;
  }
}

export async function saveAndValidateCredentials(
  marketplace: 'amazon' | 'mercadolivre' | 'shopee' | 'aliexpress' | 'kabum' | 'temu' | 'shein',
  rawCredentials: Record<string, string>
): Promise<{ valid: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // Check if new connection (not an update) and plan allows it
  const { data: existing } = await supabase
    .from('marketplace_connections')
    .select('id')
    .eq('user_id', user.id)
    .eq('marketplace', marketplace)
    .single();

  if (!existing) {
    const planCheck = await canConnectMarketplace(user.id);
    if (!planCheck.ok) return { valid: false, error: planCheck.error };
  }

  // Encrypt before storage
  const encrypted = saveMarketplaceCredentials(rawCredentials);

  // Validate (connector may be stub in Wave 1 — that's OK, it returns valid: false with a message)
  const connector = getConnector(marketplace);
  const validation = await connector.validateCredentials(rawCredentials as DecryptedCredentials);

  // Upsert regardless of validation result — user may save invalid creds to fix later
  const { error: dbError } = await supabase.from('marketplace_connections').upsert(
    {
      user_id: user.id,
      marketplace,
      encrypted_credentials: encrypted,
      is_valid: validation.valid,
      last_validated_at: new Date().toISOString(),
      validation_error: validation.error ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,marketplace' }
  );

  if (dbError) throw new Error(dbError.message);

  return { valid: validation.valid, error: validation.error };
}

export async function disconnectMarketplace(
  marketplace: 'amazon' | 'mercadolivre' | 'shopee' | 'aliexpress' | 'kabum' | 'temu' | 'shein'
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado' };

  const { error } = await supabase
    .from('marketplace_connections')
    .delete()
    .eq('user_id', user.id)
    .eq('marketplace', marketplace);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

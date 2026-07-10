import { randomBytes } from 'node:crypto';
import { supabaseAdmin } from './supabase.ts';
import { EvolutionClient } from './evolution.ts';
import { EvolutionGoClient } from './evolutiongo.ts';
import { UazapiClient } from './uazapi.ts';
import type { WhatsAppClient } from './whatsapp-client.ts';
import { encrypt, decrypt } from './crypto.ts';

const SENSITIVE_KEYS = new Set([
  'evolution_api_key',
  'evolution_webhook_secret',
  'evolutiongo_api_key',
  'uazapi_admin_token',
]);

const _cache = new Map<string, { value: string | null; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getPlatformSetting(key: string): Promise<string | null> {
  const cached = _cache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  const { data } = await supabaseAdmin
    .from('platform_settings')
    .select('value')
    .eq('key', key)
    .single();

  let result: string | null = null;

  if (data?.value) {
    if (SENSITIVE_KEYS.has(key) && data.value.includes(':')) {
      try { result = decrypt(data.value); } catch { result = null; }
    } else {
      result = data.value;
    }
  }

  _cache.set(key, { value: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

export async function setPlatformSetting(key: string, value: string): Promise<void> {
  const storedValue = SENSITIVE_KEYS.has(key) && value ? encrypt(value) : value;
  await supabaseAdmin
    .from('platform_settings')
    .upsert({ key, value: storedValue, updated_at: new Date().toISOString() });
  _cache.delete(key);
}

export async function getOrCreateWebhookSecret(): Promise<string> {
  let secret = await getPlatformSetting('evolution_webhook_secret');
  if (!secret) {
    secret = randomBytes(32).toString('hex');
    await setPlatformSetting('evolution_webhook_secret', secret);
  }
  return secret;
}

/**
 * Returns the configured WhatsApp client (Evolution or UAZAPI) based on
 * the `whatsapp_provider` platform setting. Defaults to Evolution.
 */
export async function getWhatsAppClient(): Promise<WhatsAppClient> {
  const provider = (await getPlatformSetting('whatsapp_provider')) ?? 'evolution';

  if (provider === 'uazapi') {
    const baseUrl = (await getPlatformSetting('uazapi_api_url')) || Deno.env.get('UAZAPI_API_URL');
    const adminToken = (await getPlatformSetting('uazapi_admin_token')) || Deno.env.get('UAZAPI_ADMIN_TOKEN');

    if (!baseUrl || !adminToken) {
      throw new Error('UAZAPI não configurada. Configure URL e Admin Token no painel admin em /admin/settings.');
    }
    return new UazapiClient(baseUrl, adminToken);
  }

  if (provider === 'evolutiongo') {
    const baseUrl = (await getPlatformSetting('evolutiongo_api_url')) || Deno.env.get('EVOLUTIONGO_API_URL');
    const apiKey = (await getPlatformSetting('evolutiongo_api_key')) || Deno.env.get('EVOLUTIONGO_API_KEY');

    if (!baseUrl || !apiKey) {
      throw new Error('Evolution GO não configurada. Configure no painel admin em /admin/settings.');
    }
    return new EvolutionGoClient(baseUrl, apiKey);
  }

  // Default: Evolution
  const baseUrl = (await getPlatformSetting('evolution_api_url')) || Deno.env.get('EVOLUTION_API_URL');
  const apiKey = (await getPlatformSetting('evolution_api_key')) || Deno.env.get('EVOLUTION_API_KEY');

  if (!baseUrl || !apiKey) {
    throw new Error('Evolution API não configurada. Configure no painel admin em /admin/settings.');
  }
  return new EvolutionClient(baseUrl, apiKey);
}

/** @deprecated Use getWhatsAppClient() */
export const getEvolutionClient = getWhatsAppClient;

export async function makeInstanceName(userId: string): Promise<string> {
  const prefix =
    (await getPlatformSetting('instance_prefix')) ||
    Deno.env.get('EVOLUTION_INSTANCE_PREFIX') ||
    'dz';
  return `${prefix}-${userId.replace(/-/g, '').slice(0, 8)}`;
}

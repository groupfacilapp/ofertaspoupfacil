'use server';

import { createClient } from '@/lib/supabase/server';
import { EvolutionClient } from '@/lib/evolution';
import { UazapiClient } from '@/lib/uazapi';
import { EvolutionGoClient } from '@/lib/evolutiongo';
import { getPlatformSetting, setPlatformSetting } from '@/lib/platform-settings';

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // SECURITY: app_metadata is service-role only — users cannot self-elevate
  if (!user?.app_metadata?.is_admin) {
    throw new Error('Acesso negado');
  }
}

export async function saveAdminSettings(
  settings: Record<string, string>
): Promise<{ ok: boolean; message: string }> {
  try {
    await assertAdmin();
    // Use setPlatformSetting which encrypts sensitive keys automatically
    for (const [key, value] of Object.entries(settings)) {
      await setPlatformSetting(key, value);
    }
    return { ok: true, message: 'Configurações salvas com sucesso!' };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Erro ao salvar',
    };
  }
}

export async function testWhatsAppConnection(
  provider: string,
  url: string,
  credential: string
): Promise<{ ok: boolean; message: string }> {
  try {
    await assertAdmin();
    if (!url || !credential) {
      return { ok: false, message: 'URL e credencial são obrigatórios' };
    }

    if (provider === 'uazapi') {
      const client = new UazapiClient(url, credential);
      const alive = await client.ping();
      return alive
        ? { ok: true, message: 'UAZAPI conectada com sucesso!' }
        : { ok: false, message: 'Não foi possível conectar à UAZAPI. Verifique URL e Admin Token.' };
    }

    if (provider === 'evolutiongo') {
      const client = new EvolutionGoClient(url, credential);
      const alive = await client.ping();
      return alive
        ? { ok: true, message: 'Evolution GO conectada com sucesso!' }
        : { ok: false, message: 'Não foi possível conectar à Evolution GO. Verifique URL e Global API Key.' };
    }

    // Default: Evolution
    const client = new EvolutionClient(url, credential);
    const alive = await client.ping();
    return alive
      ? { ok: true, message: 'Evolution API conectada com sucesso!' }
      : { ok: false, message: 'Não foi possível conectar à Evolution API. Verifique URL e API Key.' };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Erro de conexão',
    };
  }
}

/** @deprecated Use testWhatsAppConnection */
export async function testEvolutionConnection(url: string, apiKey: string) {
  return testWhatsAppConnection('evolution', url, apiKey);
}

export async function getAdminSettingsForDisplay(): Promise<Record<string, string>> {
  await assertAdmin();
  const keys = [
    'whatsapp_provider',
    'evolution_api_url',
    'evolution_api_key',
    'uazapi_api_url',
    'uazapi_admin_token',
    'evolutiongo_api_url',
    'evolutiongo_api_key',
    'instance_prefix',
    'whatsapp_max_daily_messages',
    'whatsapp_min_interval_seconds',
  ];

  const result: Record<string, string> = {};
  for (const key of keys) {
    result[key] = (await getPlatformSetting(key)) ?? '';
  }
  return result;
}

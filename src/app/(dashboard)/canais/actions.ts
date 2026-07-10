'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getWhatsAppClient, makeInstanceName, getOrCreateWebhookSecret, getPlatformSetting } from '@/lib/platform-settings';
import { TelegramClient } from '@/lib/telegram';
import { saveChannelConfig, loadChannelConfig } from '@/lib/credentials';

/** Returns the correct webhook URL path based on the configured provider. */
async function getWebhookUrl(): Promise<string> {
  const provider = (await getPlatformSetting('whatsapp_provider')) ?? 'evolution';
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  if (provider === 'uazapi') return `${base}/api/webhooks/whatsapp`;
  if (provider === 'evolutiongo') return `${base}/api/webhooks/evolutiongo`;
  return `${base}/api/webhooks/evolution`;
}

export async function connectWhatsApp(): Promise<{
  qrCode?: string;
  status: 'qr_pending' | 'connected' | 'error';
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error', error: 'Não autenticado' };

  const instanceName = await makeInstanceName(user.id);

  // Load any existing provider_token for this user (used by UAZAPI)
  const { data: existingInst } = await supabaseAdmin
    .from('whatsapp_instances')
    .select('provider_token')
    .eq('user_id', user.id)
    .maybeSingle();
  let providerToken: string | undefined = existingInst?.provider_token ?? undefined;

  try {
    const wa = await getWhatsAppClient();
    let qrBase64: string | null = null;

    const webhookUrl = await getWebhookUrl();

    const setupWebhook = async (token?: string) => {
      const secret = await getOrCreateWebhookSecret().catch(() => undefined);
      await wa.setWebhook(instanceName, webhookUrl, secret, token).catch(() => {});
    };

    try {
      // Check if instance already exists
      const state = await wa.getConnectionState(instanceName, providerToken);
      if (state.instance.state === 'open') {
        await supabaseAdmin.from('whatsapp_instances').upsert(
          {
            user_id: user.id,
            instance_name: instanceName,
            status: 'connected',
            qr_code: null,
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
        revalidatePath('/canais');
        return { status: 'connected' };
      }
      // Instance exists but not connected — re-trigger connection then fetch QR
      await setupWebhook(providerToken);
      try {
        const qrRes = await wa.fetchQRCode(instanceName, providerToken);
        qrBase64 = qrRes.base64;
      } catch {
        // Instance corrupted — delete and recreate
        await wa.deleteInstance(instanceName, providerToken).catch(() => {});
        const created = await wa.createInstance(instanceName);
        providerToken = created.providerToken;
        await setupWebhook(providerToken);
        const qrRes = await wa.fetchQRCode(instanceName, providerToken);
        qrBase64 = qrRes.base64;
      }
    } catch {
      // Instance doesn't exist — create it
      const created = await wa.createInstance(instanceName);
      providerToken = created.providerToken;
      await setupWebhook(providerToken);
      const qrRes = await wa.fetchQRCode(instanceName, providerToken);
      qrBase64 = qrRes.base64;
    }

    const qrExpires = new Date(Date.now() + 60_000).toISOString();
    await supabaseAdmin.from('whatsapp_instances').upsert(
      {
        user_id: user.id,
        instance_name: instanceName,
        status: 'qr_pending',
        qr_code: qrBase64,
        qr_expires_at: qrExpires,
        provider_token: providerToken ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    return { status: 'qr_pending', qrCode: qrBase64 ?? undefined };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { status: 'error', error };
  }
}

export async function checkWhatsAppStatus(): Promise<{
  status: 'disconnected' | 'qr_pending' | 'connected' | 'error';
  qrCode?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error' };

  const instanceName = await makeInstanceName(user.id);

  // Load provider_token for UAZAPI
  const { data: existingInst } = await supabaseAdmin
    .from('whatsapp_instances')
    .select('provider_token, status, qr_code, qr_expires_at')
    .eq('user_id', user.id)
    .maybeSingle();
  const providerToken: string | undefined = existingInst?.provider_token ?? undefined;

  try {
    const wa = await getWhatsAppClient();
    const state = await wa.getConnectionState(instanceName, providerToken);

    if (state.instance.state === 'open') {
      await supabaseAdmin
        .from('whatsapp_instances')
        .upsert(
          {
            user_id: user.id,
            instance_name: instanceName,
            status: 'connected',
            qr_code: null,
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
      revalidatePath('/canais');
      return { status: 'connected' };
    }

    if (!existingInst) return { status: 'disconnected' };

    // DB says connected but provider disagrees — correct the DB
    if (existingInst.status === 'connected') {
      await supabaseAdmin
        .from('whatsapp_instances')
        .update({
          status: 'disconnected',
          disconnected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
      revalidatePath('/canais');
      return { status: 'disconnected' };
    }

    // Check for expired QR and refresh if needed
    const qrExpired =
      existingInst.qr_expires_at && new Date(existingInst.qr_expires_at) < new Date();
    if (qrExpired) {
      const qrRes = await wa.fetchQRCode(instanceName, providerToken).catch(() => null);
      if (qrRes) {
        const newExpiry = new Date(Date.now() + 60_000).toISOString();
        await supabaseAdmin
          .from('whatsapp_instances')
          .update({
            qr_code: qrRes.base64,
            qr_expires_at: newExpiry,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
        return { status: 'qr_pending', qrCode: qrRes.base64 };
      }
    }

    return {
      status: (existingInst.status ?? 'disconnected') as 'qr_pending' | 'disconnected',
      qrCode: existingInst.qr_code ?? undefined,
    };
  } catch {
    return { status: 'disconnected' };
  }
}

export async function connectByPhone(phoneNumber: string): Promise<{
  pairingCode?: string;
  status: 'pairing' | 'connected' | 'error';
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error', error: 'Não autenticado' };

  // Remove non-digits
  const digits = phoneNumber.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) {
    return { status: 'error', error: 'Número inválido. Use formato internacional, ex: 5511999999999' };
  }

  const instanceName = await makeInstanceName(user.id);

  const { data: existingInst } = await supabaseAdmin
    .from('whatsapp_instances')
    .select('provider_token')
    .eq('user_id', user.id)
    .maybeSingle();
  let providerToken: string | undefined = existingInst?.provider_token ?? undefined;

  try {
    const wa = await getWhatsAppClient();

    const webhookUrl = await getWebhookUrl();
    const secret = await getOrCreateWebhookSecret().catch(() => undefined);

    // Delete any existing instance so we always start fresh for pairing.
    // This avoids stale state (e.g. instance disconnected from a prior QR session).
    await wa.logoutInstance(instanceName, providerToken).catch(() => {});
    await wa.deleteInstance(instanceName, providerToken).catch(() => {});

    // Create fresh instance and connect to trigger pairing mode
    const created = await wa.createInstance(instanceName);
    providerToken = created.providerToken;
    await wa.setWebhook(instanceName, webhookUrl, secret, providerToken).catch(() => {});

    const { code } = await wa.fetchPairingCode(instanceName, digits, providerToken);

    await supabaseAdmin.from('whatsapp_instances').upsert(
      {
        user_id: user.id,
        instance_name: instanceName,
        status: 'qr_pending',
        qr_code: null,
        provider_token: providerToken ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    return { status: 'pairing', pairingCode: code };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { status: 'error', error };
  }
}

export async function disconnectWhatsApp(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const instanceName = await makeInstanceName(user.id);

  const { data: existingInst } = await supabaseAdmin
    .from('whatsapp_instances')
    .select('provider_token')
    .eq('user_id', user.id)
    .maybeSingle();
  const providerToken: string | undefined = existingInst?.provider_token ?? undefined;

  try {
    const wa = await getWhatsAppClient();
    await wa.logoutInstance(instanceName, providerToken).catch(() => {});
    await wa.deleteInstance(instanceName, providerToken).catch(() => {});
  } catch {}

  await supabaseAdmin
    .from('whatsapp_instances')
    .update({
      status: 'disconnected',
      qr_code: null,
      phone_number: null,
      provider_token: null,
      disconnected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id);

  revalidatePath('/canais');
}

export async function deleteWhatsAppInstance(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const instanceName = await makeInstanceName(user.id);

  const { data: existingInst } = await supabaseAdmin
    .from('whatsapp_instances')
    .select('provider_token')
    .eq('user_id', user.id)
    .maybeSingle();
  const providerToken: string | undefined = existingInst?.provider_token ?? undefined;

  try {
    const wa = await getWhatsAppClient();
    await wa.deleteInstance(instanceName, providerToken).catch(() => {});
  } catch {}

  await supabaseAdmin
    .from('whatsapp_instances')
    .update({
      status: 'disconnected',
      qr_code: null,
      phone_number: null,
      provider_token: null,
      disconnected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id);

  revalidatePath('/canais');
}

// ─── Telegram ────────────────────────────────────────────────────────────────

export async function connectTelegram(botToken: string): Promise<{
  ok: boolean;
  botUsername?: string;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado' };

  const token = botToken.trim();
  if (!token) return { ok: false, error: 'Token inválido' };

  try {
    const tg = new TelegramClient(token);
    const botInfo = await tg.getMe();

    const encryptedConfig = saveChannelConfig({
      botToken: token,
      botId: String(botInfo.id),
      botUsername: botInfo.username,
    });

    // Delete any existing rows first to avoid duplicates (upsert depends on
    // a unique constraint that may not exist in all environments)
    await supabaseAdmin
      .from('channel_connections')
      .delete()
      .eq('user_id', user.id)
      .eq('channel_type', 'telegram');

    await supabaseAdmin.from('channel_connections').insert({
      user_id: user.id,
      channel_type: 'telegram',
      label: `@${botInfo.username}`,
      encrypted_config: encryptedConfig,
      is_connected: true,
      last_status_at: new Date().toISOString(),
    });

    revalidatePath('/canais');
    return { ok: true, botUsername: botInfo.username };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Erro ao validar token' };
  }
}

export async function disconnectTelegram(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabaseAdmin
    .from('channel_connections')
    .delete()
    .eq('user_id', user.id)
    .eq('channel_type', 'telegram');

  revalidatePath('/canais');
}

export async function validateTelegramChat(chatId: string): Promise<{
  ok: boolean;
  title?: string;
  type?: string;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado' };

  const { data: conn } = await supabaseAdmin
    .from('channel_connections')
    .select('encrypted_config')
    .eq('user_id', user.id)
    .eq('channel_type', 'telegram')
    .maybeSingle();

  if (!conn) return { ok: false, error: 'Telegram não conectado' };

  try {
    const config = loadChannelConfig(conn.encrypted_config);
    const tg = new TelegramClient(config.botToken as string);
    const chat = await tg.getChat(chatId.trim());
    return { ok: true, title: chat.title ?? chat.username ?? String(chat.id), type: chat.type };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Chat não encontrado' };
  }
}

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getWhatsAppClient, makeInstanceName } from '@/lib/platform-settings';
import { dispatchGroup } from '@/lib/dispatch';
import { canCreateGroup } from '@/lib/plans';
import { loadChannelConfig } from '@/lib/credentials';
import { TelegramClient } from '@/lib/telegram';

const VALID_MARKETPLACES = ['amazon', 'mercadolivre', 'shopee', 'aliexpress', 'kabum', 'temu', 'shein'] as const;

// Zod schema — validates and sanitizes all group input
const GroupFormSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  marketplaces: z
    .array(z.enum(VALID_MARKETPLACES))
    .min(1, 'Selecione ao menos um marketplace'),
  min_discount: z.number().int().min(0).max(99),
  min_price: z.number().int().min(0).nullable(),
  max_price: z.number().int().min(0).nullable(),
  min_sales: z.number().int().min(0),
  daily_limit: z.number().int().min(1).max(500),
  template_text: z.string().max(2000),
  keywords: z.array(z.string().max(50)).max(20),
  blocked_keywords: z.array(z.string().max(50)).max(20),
  // WhatsApp destinations (JID format)
  destination_ids: z.array(z.string().regex(/^[\d]+@g\.us$/)).max(50),
  destination_names: z.record(z.string(), z.string().max(100)),
  // Telegram destinations (chat IDs as strings, e.g. "-1001234567890")
  telegram_destination_ids: z.array(z.string().max(50)).max(20).optional().default([]),
  telegram_destination_names: z.record(z.string(), z.string().max(100)).optional().default({}),
});

export type GroupFormData = z.infer<typeof GroupFormSchema>;

export async function createGroup(
  data: GroupFormData
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado' };

  const parsed = GroupFormSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
  }
  const safe = parsed.data;

  // Enforce plan limit on group creation
  const planCheck = await canCreateGroup(user.id);
  if (!planCheck.ok) return { ok: false, error: planCheck.error };

  const { data: group, error } = await supabaseAdmin
    .from('dispatch_groups')
    .insert({
      user_id: user.id,
      name: safe.name,
      marketplaces: safe.marketplaces,
      min_discount: safe.min_discount,
      min_price: safe.min_price,
      max_price: safe.max_price,
      min_sales: safe.min_sales,
      daily_limit: safe.daily_limit,
      template_text: safe.template_text,
      keywords: safe.keywords,
      blocked_keywords: safe.blocked_keywords,
      is_active: true,
    })
    .select('id')
    .single();

  if (error || !group) return { ok: false, error: error?.message };

  // Insert WhatsApp destinations
  const allDestinations = [];
  if (safe.destination_ids.length > 0) {
    allDestinations.push(
      ...safe.destination_ids.map((jid) => ({
        group_id: group.id,
        channel_type: 'whatsapp',
        target_id: jid,
        target_name: safe.destination_names[jid] ?? null,
        channel_id: null,
      }))
    );
  }
  // Insert Telegram destinations
  if ((safe.telegram_destination_ids ?? []).length > 0) {
    allDestinations.push(
      ...(safe.telegram_destination_ids ?? []).map((chatId) => ({
        group_id: group.id,
        channel_type: 'telegram',
        target_id: chatId,
        target_name: (safe.telegram_destination_names ?? {})[chatId] ?? null,
        channel_id: null,
      }))
    );
  }
  if (allDestinations.length > 0) {
    await supabaseAdmin.from('group_destinations').insert(allDestinations);
  }

  revalidatePath('/grupos');
  return { ok: true };
}

export async function updateGroup(
  groupId: string,
  data: GroupFormData
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado' };

  const parsed = GroupFormSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
  }
  const safe = parsed.data;

  const { error } = await supabaseAdmin
    .from('dispatch_groups')
    .update({
      name: safe.name,
      marketplaces: safe.marketplaces,
      min_discount: safe.min_discount,
      min_price: safe.min_price,
      max_price: safe.max_price,
      min_sales: safe.min_sales,
      daily_limit: safe.daily_limit,
      template_text: safe.template_text,
      keywords: safe.keywords,
      blocked_keywords: safe.blocked_keywords,
      updated_at: new Date().toISOString(),
    })
    .eq('id', groupId)
    .eq('user_id', user.id);

  if (error) return { ok: false, error: error.message };

  // Replace all destinations
  await supabaseAdmin
    .from('group_destinations')
    .delete()
    .eq('group_id', groupId);

  const allDestinations = [];
  if (safe.destination_ids.length > 0) {
    allDestinations.push(
      ...safe.destination_ids.map((jid) => ({
        group_id: groupId,
        channel_type: 'whatsapp',
        target_id: jid,
        target_name: safe.destination_names[jid] ?? null,
        channel_id: null,
      }))
    );
  }
  if ((safe.telegram_destination_ids ?? []).length > 0) {
    allDestinations.push(
      ...(safe.telegram_destination_ids ?? []).map((chatId) => ({
        group_id: groupId,
        channel_type: 'telegram',
        target_id: chatId,
        target_name: (safe.telegram_destination_names ?? {})[chatId] ?? null,
        channel_id: null,
      }))
    );
  }
  if (allDestinations.length > 0) {
    await supabaseAdmin.from('group_destinations').insert(allDestinations);
  }

  revalidatePath('/grupos');
  return { ok: true };
}

export async function toggleGroup(
  groupId: string,
  isActive: boolean
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabaseAdmin
    .from('dispatch_groups')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', groupId)
    .eq('user_id', user.id);

  revalidatePath('/grupos');
}

export async function deleteGroup(groupId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Não autenticado' };

  // dispatch_logs FK não tem CASCADE — precisa deletar antes
  await supabaseAdmin
    .from('dispatch_logs')
    .delete()
    .eq('group_id', groupId);

  const { error } = await supabaseAdmin
    .from('dispatch_groups')
    .delete()
    .eq('id', groupId)
    .eq('user_id', user.id);

  if (error) return { error: 'Não foi possível excluir o grupo.' };

  revalidatePath('/grupos');
  return {};
}

export async function getWhatsAppGroups(): Promise<
  Array<{ id: string; subject: string; size: number }> | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Não autenticado' };

  try {
    const wa = await getWhatsAppClient();
    const instanceName = await makeInstanceName(user.id);
    const { data: waInst } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('provider_token')
      .eq('user_id', user.id)
      .maybeSingle();
    const providerToken = waInst?.provider_token ?? undefined;
    const groups = await wa.getGroups(instanceName, providerToken);
    // Only return standard WhatsApp groups (@g.us) — filter out newsletters,
    // communities, and other non-group JID types that would fail validation.
    return groups.filter((g) => /^\d+@g\.us$/.test(g.id));
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Erro ao buscar grupos',
    };
  }
}

export async function triggerManualDispatch(
  groupId: string
): Promise<{ ok: boolean; dispatched?: number; skipped?: number; errors?: string[]; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado' };

  const { data: group } = await supabaseAdmin
    .from('dispatch_groups')
    .select('*')
    .eq('id', groupId)
    .eq('user_id', user.id)
    .single();

  if (!group) return { ok: false, error: 'Grupo não encontrado' };
  if (!group.is_active) return { ok: false, error: 'Grupo está pausado' };

  const { data: destinations } = await supabaseAdmin
    .from('group_destinations')
    .select('*')
    .eq('group_id', groupId);

  // maxOffers: 1 prevents timeout — manual dispatch sends 1 offer per click,
  // same as auto-dispatch. User can click again to send more.
  const result = await dispatchGroup(group, destinations ?? [], { maxOffers: 1 });
  // No revalidatePath here — client handles bar update optimistically.
  return {
    ok: true,
    dispatched: result.dispatched,
    skipped: result.skipped,
    errors: result.errors,
  };
}

export async function validateTelegramChatForGroup(chatId: string): Promise<{
  ok: boolean;
  title?: string;
  type?: string;
  resolvedId?: string;
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

  if (!conn) return { ok: false, error: 'Bot Telegram não conectado. Configure em Canais.' };

  // Parse t.me URLs before calling the Bot API
  let resolvedId = chatId.trim();

  const tmeMatch = resolvedId.match(/(?:https?:\/\/)?t\.me\/(.+)/i);
  if (tmeMatch) {
    const path = tmeMatch[1];
    if (path.startsWith('+') || path.startsWith('joinchat/')) {
      return {
        ok: false,
        error: 'Links de convite privado não são suportados. Adicione o bot ao grupo, torne-o administrador e use o ID numérico do grupo (ex: -1001234567890).',
      };
    }
    // Public channel/group: t.me/username → @username
    resolvedId = `@${path.replace(/\/$/, '')}`;
  }

  try {
    const config = loadChannelConfig(conn.encrypted_config);
    const tg = new TelegramClient(config.botToken as string);

    // Try the provided ID first
    try {
      const chat = await tg.getChat(resolvedId);
      return { ok: true, title: chat.title ?? chat.username ?? String(chat.id), type: chat.type, resolvedId };
    } catch {
      // If it looks like a plain negative group ID (e.g. -3748398399) and NOT already in
      // supergroup format (-100...), try the supergroup-migrated form automatically.
      // Telegram silently migrates basic groups to supergroups when a bot becomes admin,
      // changing the ID from -XXXXXXXXX to -100XXXXXXXXX.
      const numericNegative = resolvedId.match(/^-(\d+)$/);
      if (numericNegative && !resolvedId.startsWith('-100')) {
        const superGroupId = `-100${numericNegative[1]}`;
        try {
          const chat = await tg.getChat(superGroupId);
          return {
            ok: true,
            title: chat.title ?? chat.username ?? String(chat.id),
            type: chat.type,
            resolvedId: superGroupId,
          };
        } catch {
          // Fall through to the original error
        }
      }
      throw new Error('Chat não encontrado. Verifique se o bot está no grupo como administrador e use o ID numérico (ex: -1001234567890).');
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Chat não encontrado' };
  }
}

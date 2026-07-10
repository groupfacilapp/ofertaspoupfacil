/**
 * Unified webhook handler for UAZAPI provider.
 * Evolution events continue to use /api/webhooks/evolution.
 *
 * UAZAPI event envelope:
 *   { event: "connection", instance: "<instanceId>", data: { status, owner, ... } }
 *
 * We look up the instance by `instance_name` (we store the human-readable name, not the internal ID)
 * or fall back to matching by provider_token if needed.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, instance: instanceId, data } = body;

    if (!instanceId || typeof instanceId !== 'string') {
      return NextResponse.json({ ok: true }); // malformed — silently ignore
    }

    // UAZAPI sends the instance `id` field (not name) in the payload.
    // We try to match by instance_name first (in case the admin named the instance the same),
    // then by provider_token prefix. Most reliable: we look up by instance_name since we
    // set `name` = instanceName at creation time in UazapiClient.createInstance.
    const { data: knownInstance } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('id, user_id')
      .eq('instance_name', instanceId)
      .maybeSingle();

    if (!knownInstance) {
      return NextResponse.json({ ok: true }); // unknown instance, ignore
    }

    if (event === 'connection') {
      const status = data?.status as string | undefined;
      // UAZAPI: owner field contains the JID like "5511999999999@s.whatsapp.net"
      const ownerJid = (data?.owner as string | undefined) ?? '';
      const phoneNumber = ownerJid.split('@')[0] || null;

      if (status === 'connected') {
        await supabaseAdmin
          .from('whatsapp_instances')
          .update({
            status: 'connected',
            qr_code: null,
            phone_number: phoneNumber,
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', knownInstance.id);
      } else if (status === 'disconnected') {
        await supabaseAdmin
          .from('whatsapp_instances')
          .update({
            status: 'disconnected',
            qr_code: null,
            disconnected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', knownInstance.id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('WhatsApp (UAZAPI) webhook error:', err);
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
  }
}

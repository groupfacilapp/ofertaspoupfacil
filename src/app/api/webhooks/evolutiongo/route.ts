/**
 * Webhook handler for Evolution GO provider.
 *
 * Instance identification: the instance token is embedded in the webhook URL
 * as ?token={instanceToken} when setWebhook is called. We look up the instance
 * by provider_token in whatsapp_instances.
 *
 * Evolution GO event envelope (subscribe: ['CONNECTION', 'MESSAGE']):
 *   CONNECTION: { type: "CONNECTION", data: { Connected: bool, LoggedIn: bool, ... } }
 *   MESSAGE: { type: "MESSAGE", data: { ... } }
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json({ ok: true }); // no token, silently ignore
    }

    const body = await req.json();
    const eventType = (body?.type as string | undefined)?.toUpperCase();
    const data = body?.data as Record<string, unknown> | undefined;

    // Look up instance by provider_token
    const { data: instance } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('id, instance_name')
      .eq('provider_token', token)
      .maybeSingle();

    if (!instance) {
      return NextResponse.json({ ok: true }); // unknown instance, ignore
    }

    if (eventType === 'CONNECTION' && data) {
      const connected = data.Connected as boolean | undefined;
      const loggedIn = data.LoggedIn as boolean | undefined;
      const name = data.Name as string | undefined;

      if (connected && loggedIn) {
        // Fully authenticated
        await supabaseAdmin
          .from('whatsapp_instances')
          .update({
            status: 'connected',
            qr_code: null,
            phone_number: name ?? null,
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', instance.id);
      } else if (!connected) {
        // Socket disconnected
        await supabaseAdmin
          .from('whatsapp_instances')
          .update({
            status: 'disconnected',
            qr_code: null,
            disconnected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', instance.id);
      }
      // connected && !loggedIn = QR mode, no DB update needed (polling handles QR fetch)
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Evolution GO webhook error:', err);
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
  }
}

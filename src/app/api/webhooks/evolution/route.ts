import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getPlatformSetting } from '@/lib/platform-settings';

export async function POST(req: NextRequest) {
  try {
    // Verify webhook secret — Evolution sends it as header or query param
    const webhookSecret = await getPlatformSetting('evolution_webhook_secret');
    if (webhookSecret) {
      const headerSecret =
        req.headers.get('apikey') ||
        req.headers.get('x-webhook-secret') ||
        req.nextUrl.searchParams.get('secret');

      if (headerSecret !== webhookSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await req.json();
    const { event, instance, data } = body;

    // Only process known events from known instances
    if (!instance || typeof instance !== 'string') {
      return NextResponse.json({ ok: true }); // silently ignore malformed
    }

    // Verify this instance actually exists in our DB before updating
    const { data: knownInstance } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('id')
      .eq('instance_name', instance)
      .maybeSingle();

    if (!knownInstance) {
      return NextResponse.json({ ok: true }); // unknown instance, ignore
    }

    if (event === 'connection.update') {
      const state = data?.state as string | undefined;
      const phoneNumber = (data?.me?.id as string | undefined)?.split(':')[0];

      if (state === 'open') {
        await supabaseAdmin
          .from('whatsapp_instances')
          .update({
            status: 'connected',
            qr_code: null,
            phone_number: phoneNumber ?? null,
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('instance_name', instance);
      } else if (state === 'close') {
        await supabaseAdmin
          .from('whatsapp_instances')
          .update({
            status: 'disconnected',
            qr_code: null,
            disconnected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('instance_name', instance);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Evolution webhook error:', err);
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
  }
}

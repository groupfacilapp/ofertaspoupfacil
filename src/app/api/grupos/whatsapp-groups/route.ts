export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getWhatsAppClient, makeInstanceName } from '@/lib/platform-settings';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  try {
    const wa = await getWhatsAppClient();
    const instanceName = await makeInstanceName(user.id);

    const { data: inst } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('provider_token')
      .eq('user_id', user.id)
      .maybeSingle();
    const providerToken = inst?.provider_token ?? undefined;

    const groups = await wa.getGroups(instanceName, providerToken);
    // Evolution already filters @g.us; UAZAPI client also does it — belt-and-suspenders here
    const filtered = groups.filter((g) => /^\d+@g\.us$/.test(g.id));
    return NextResponse.json(filtered);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao buscar grupos' },
      { status: 500 }
    );
  }
}

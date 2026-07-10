import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getWhatsAppClient, makeInstanceName } from '@/lib/platform-settings';

// Extracts the invite code from a full link or returns the string as-is
function extractInviteCode(input: string): string {
  const match = input.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
  return match ? match[1] : input.trim();
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const raw = request.nextUrl.searchParams.get('link') ?? '';
  if (!raw) return NextResponse.json({ error: 'Link de convite não informado' }, { status: 400 });

  const inviteCode = extractInviteCode(raw);
  if (!inviteCode) return NextResponse.json({ error: 'Link de convite inválido' }, { status: 400 });

  try {
    const wa = await getWhatsAppClient();
    const instanceName = await makeInstanceName(user.id);

    const { data: inst } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('provider_token')
      .eq('user_id', user.id)
      .maybeSingle();
    const providerToken = inst?.provider_token ?? undefined;

    const group = await wa.getGroupByInvite(instanceName, inviteCode, providerToken);
    return NextResponse.json({ id: group.id, subject: group.subject, size: group.size ?? 0 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao buscar grupo pelo link' },
      { status: 500 }
    );
  }
}

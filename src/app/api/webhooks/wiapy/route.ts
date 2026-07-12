import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { setUserPlan } from '@/lib/plans';

interface WiapyCustomer {
  email?: string;
  name?: string;
  mobile_phone?: string;
}

interface WiapyPayment {
  id?: string;
  status?: string;
  amount?: number;
}

interface WiapyCheckout {
  id?: string;
  title?: string;
}

interface WiapyPayload {
  payment?: WiapyPayment;
  customer?: WiapyCustomer;
  checkout?: WiapyCheckout;
}

function validateSecret(req: NextRequest): boolean {
  const secret = process.env.WIAPY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[wiapy/webhook] WIAPY_WEBHOOK_SECRET não configurado — qualquer request passa!');
    return true;
  }

  // Header Authorization
  const authHeader = req.headers.get('authorization') ?? '';
  const cleanToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (cleanToken === secret || authHeader === secret) return true;

  // Query Param fallback
  const queryToken = req.nextUrl.searchParams.get('token');
  if (queryToken === secret) return true;

  return false;
}

export async function POST(req: NextRequest) {
  let body: WiapyPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!validateSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orderId = body.payment?.id ?? '';
  const orderStatus = body.payment?.status ?? '';
  const buyerEmail = body.customer?.email ?? '';
  const checkoutTitle = body.checkout?.title ?? '';

  console.log(`[wiapy/webhook] Event received. ID: ${orderId}, Status: ${orderStatus}, Email: ${buyerEmail}, Title: ${checkoutTitle}`);

  const isPaid = orderStatus === 'paid' || orderStatus === 'approved';
  if (!isPaid) {
    return NextResponse.json({ received: true, skipped: true, reason: 'Status is not paid/approved' });
  }

  if (!buyerEmail) {
    console.error('[wiapy/webhook] Email do comprador está vazio no payload');
    return NextResponse.json({ error: 'Buyer email missing' }, { status: 422 });
  }

  // Mapear título do checkout para os slugs do planos_sistema
  let planSlug = 'basico'; // default fallback
  const titleLower = checkoutTitle.toLowerCase();

  if (titleLower.includes('premium') && titleLower.includes('anual')) {
    planSlug = 'premium_anual';
  } else if (titleLower.includes('premium')) {
    planSlug = 'premium';
  } else if (titleLower.includes('profissional') && titleLower.includes('anual')) {
    planSlug = 'profissional_anual';
  } else if (titleLower.includes('profissional')) {
    planSlug = 'profissional';
  } else if ((titleLower.includes('básico') || titleLower.includes('basico')) && titleLower.includes('anual')) {
    planSlug = 'basico_anual';
  } else if (titleLower.includes('básico') || titleLower.includes('basico')) {
    planSlug = 'basico';
  } else {
    console.warn(`[wiapy/webhook] Não foi possível determinar o plano pelo título: "${checkoutTitle}". Usando fallback: "basico".`);
  }

  try {
    // 1. Encontra o usuário na tabela auth.users pelo email
    const { data: userData, error: userError } = await supabaseAdmin
      .schema('auth')
      .from('users')
      .select('id')
      .eq('email', buyerEmail.toLowerCase().trim())
      .single();

    let userId = userData?.id;

    if (userError || !userData) {
      console.log(`[wiapy/webhook] Usuário "${buyerEmail}" não encontrado. Criando pré-cadastro via convite...`);
      
      // Cria o pré-cadastro enviando convite para o usuário definir a própria senha
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        buyerEmail.toLowerCase().trim(),
        {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://ofertaspoupfacil.vercel.app'}/login?auth=true`,
          data: {
            display_name: body.customer?.name || 'Cliente',
          }
        }
      );

      if (inviteError || !inviteData?.user) {
        console.error('[wiapy/webhook] Erro ao criar pré-cadastro/convite:', inviteError);
        return NextResponse.json({ error: 'Failed to create user invite' }, { status: 500 });
      }

      userId = inviteData.user.id;
      console.log(`[wiapy/webhook] Pré-cadastro criado com sucesso para "${buyerEmail}". User ID: ${userId}`);
    }

    // 2. Atribui o plano ao usuário usando o helper existente
    await setUserPlan(userId, planSlug);

    console.log(`[wiapy/webhook] Plano "${planSlug}" ativado com sucesso para o usuário "${userId}" (${buyerEmail}).`);

    return NextResponse.json({
      received: true,
      success: true,
      plan: planSlug,
      userId: userId,
    });
  } catch (error: any) {
    console.error('[wiapy/webhook] Erro crítico ao processar o webhook:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

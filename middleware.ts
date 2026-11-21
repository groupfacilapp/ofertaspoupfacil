import { updateSession } from '@/lib/supabase/middleware';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|imagens/|brand/|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|jfif|ico)$).*)',
  ],
};

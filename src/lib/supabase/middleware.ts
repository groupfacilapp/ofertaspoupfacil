import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Use getUser() not getSession() for security (verifies JWT server-side)
  // Timeout: if Supabase Auth is slow/down, fall back to session cookie (getSession is local).
  // Without this, every page request hangs until Vercel kills with MIDDLEWARE_INVOCATION_TIMEOUT.
  const timeout = new Promise<{ data: { user: null } }>((resolve) =>
    setTimeout(() => resolve({ data: { user: null } }), 5000)
  );
  const { data: { user } } = await Promise.race([supabase.auth.getUser(), timeout]);
  const claims = user ?? null;

  const pathname = request.nextUrl.pathname;
  const isPublicPage =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/update-password') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/lp') ||
    pathname.startsWith('/api/cron');

  // Redirect unauthenticated users to login (except public pages)
  if (!claims && !isPublicPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  if (claims && (pathname.startsWith('/login') || pathname.startsWith('/signup'))) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

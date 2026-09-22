import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseUrl, supabaseAnonKey } from './env';
import { PCG_AUTH_COOKIE, PCG_DEMO_COOKIE, PCG_HANDOFF_PARAM } from '@/lib/pcg-demos';

const DEMOS = ['crm', 'photiades', 'hr'];

// @supabase/ssr splits a session over `<cookie>.0`, `<cookie>.1`, ... once it
// exceeds 3180 bytes. Match on THIS app's cookie name only, so we can never
// prune another app's session.
const CHUNK_PREFIX = PCG_AUTH_COOKIE + '.';
const DIGITS = /^\d+$/;

function chunkIndexOf(name: string): number | null {
  if (!name.startsWith(CHUNK_PREFIX)) return null;
  const tail = name.slice(CHUNK_PREFIX.length);
  return DIGITS.test(tail) ? Number(tail) : null;
}

type PendingCookie = { name: string; value: string; options?: Record<string, unknown> };

/* Supabase asks us to write two kinds of cookie during getUser(): refreshed
 * tokens, and DELETIONS for chunks a shrinking session no longer uses. Both
 * must land on whatever response we finally return. The previous version built
 * them onto a `response` that every redirect path then discarded, so a
 * cross-app handoff (which always redirects) silently dropped them — leaving
 * orphaned `.1`/`.2` chunks behind on every pass. Combined with three apps
 * sharing one `localhost` cookie jar, that grew the Cookie header past Node's
 * 16 KB limit and produced HTTP 431. */
function pruneOrphanChunks(request: NextRequest, pending: PendingCookie[], response: NextResponse) {
  let highest: number | null = null;
  for (const { name } of pending) {
    const i = chunkIndexOf(name);
    if (i !== null) highest = Math.max(highest ?? -1, i);
    else if (name === PCG_AUTH_COOKIE) highest = Math.max(highest ?? -1, -1);
  }
  // Only prune when Supabase actually rewrote our session this request —
  // pruning a session we did not touch would sign the user out.
  if (highest === null) return;
  for (const { name } of request.cookies.getAll()) {
    const i = chunkIndexOf(name);
    if (i !== null && i > highest) response.cookies.set(name, '', { path: '/', maxAge: 0 });
  }
}

export async function updateSession(request: NextRequest) {
  const pending: PendingCookie[] = [];
  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    // Must match client.ts and server.ts or the session is invisible.
    cookieOptions: { name: PCG_AUTH_COOKIE },
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        for (const c of cookiesToSet) { request.cookies.set(c.name, c.value); pending.push(c as PendingCookie); }
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  const url = request.nextUrl;
  const rawHandoff = url.searchParams.get(PCG_HANDOFF_PARAM);
  const handoff = rawHandoff && DEMOS.includes(rawHandoff) ? rawHandoff : null;

  const finalize = (response: NextResponse) => {
    for (const { name, value, options } of pending) response.cookies.set(name, value, options as never);
    pruneOrphanChunks(request, pending, response);
    if (handoff) response.cookies.set(PCG_DEMO_COOKIE, handoff, { path: '/', maxAge: 31536000, sameSite: 'lax' });
    return response;
  };
  // Every redirect below is built from a CLEAN url, never request.nextUrl.clone(),
  // so `?pcg_demo=` can never ride along and be rewritten on every later request.
  const redirectTo = (pathname: string) => finalize(NextResponse.redirect(new URL(pathname, request.url)));

  // Consume the handoff param exactly once, then bounce to the clean URL so the
  // address bar, history and every subsequent request are free of it.
  if (rawHandoff !== null) {
    const clean = url.clone();
    clean.searchParams.delete(PCG_HANDOFF_PARAM);
    return finalize(NextResponse.redirect(clean));
  }

  const isLoginPage = url.pathname === '/login';

  if (!user && !isLoginPage) return redirectTo('/login');
  if (user && isLoginPage) return redirectTo('/dashboard');

  return finalize(NextResponse.next({ request }));
}

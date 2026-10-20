import { NextResponse, type NextRequest } from 'next/server';
import { authenticateRequest, strongToken } from './lib/api-auth';
import { checkRateLimit } from './lib/rate-limit';

export function proxy(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ ok: false, error: strongToken(process.env.ADMIN_TOKEN) ? 'AUTH_REQUIRED' : 'ADMIN_TOKEN_NOT_CONFIGURED' }, {
      status: 401, headers: { 'www-authenticate': 'Basic realm="NusaMind local", charset="UTF-8"', 'cache-control': 'no-store' },
    });
  }
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const rate = checkRateLimit(`api:${auth.identity}`, 120, 60_000);
    if (!rate.ok) return NextResponse.json({ ok: false, error: 'RATE_LIMITED' }, { status: 429 });
  }
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Content-Security-Policy', "frame-ancestors 'none'");
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|nusamind-logo.png).*)'] };

import { createHash, timingSafeEqual } from 'node:crypto';

export type ApiRole = 'admin' | 'coding' | 'autonomy' | 'desktop' | 'knowledge';
const credentials: Record<ApiRole, [string, string]> = {
  admin: ['ADMIN_TOKEN', 'x-admin-token'], coding: ['CODING_AGENT_TOKEN', 'x-coding-token'],
  autonomy: ['AUTONOMY_AGENT_TOKEN', 'x-autonomy-token'], desktop: ['DESKTOP_CONTROL_TOKEN', 'x-desktop-token'],
  knowledge: ['KNOWLEDGE_CONTROL_TOKEN', 'x-knowledge-token'],
};
export function strongToken(value: string | undefined): value is string {
  return Boolean(value && value.length >= 32 && value.length <= 512 && !/change.this|example|placeholder/i.test(value));
}
export function tokenEquals(value: string | null | undefined, expected: string | undefined) {
  if (!strongToken(expected) || !value) return false;
  const a = Buffer.from(value), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function appOrigin() {
  return new URL(process.env.NUSAMIND_APP_ORIGIN || 'http://localhost:3000').origin;
}
export function originAllowed(request: Request) {
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  return (!origin || origin === appOrigin()) && (!site || site === 'same-origin' || site === 'none');
}
export function apiRole(pathname: string): ApiRole {
  if (pathname === '/api/coding' || pathname === '/api/n1/developer') return 'coding';
  if (pathname === '/api/n1/autonomy') return 'autonomy';
  if (pathname.startsWith('/api/desktop') || pathname.startsWith('/api/security') || pathname === '/api/workflow/tool') return 'desktop';
  if (pathname.startsWith('/api/knowledge/')) return 'knowledge';
  return 'admin';
}
export function authenticateRequest(request: Request, role: ApiRole = apiRole(new URL(request.url).pathname)) {
  if (!originAllowed(request)) return null;
  const authorization = request.headers.get('authorization') || '';
  const basic = authorization.startsWith('Basic ');
  let supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : request.headers.get('x-admin-token');
  if (basic) {
    const decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
    supplied = decoded.startsWith('nusamind:') ? decoded.slice(9) : null;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.get('origin') !== appOrigin()) return null;
  }
  if (tokenEquals(supplied, process.env.ADMIN_TOKEN)) return { identity: createHash('sha256').update(process.env.ADMIN_TOKEN!).digest('hex'), role: 'admin' as const };
  if (role !== 'admin') {
    const [env, header] = credentials[role];
    if (tokenEquals(request.headers.get(header), process.env[env])) return { identity: createHash('sha256').update(process.env[env]!).digest('hex'), role };
  }
  return null;
}
export function authDenied() {
  return Response.json({ ok: false, error: 'AUTH_REQUIRED', hint: 'Konfigurasikan token acak minimal 32 karakter. Browser: username nusamind dan ADMIN_TOKEN sebagai password.' }, {
    status: 403, headers: { 'cache-control': 'no-store' },
  });
}

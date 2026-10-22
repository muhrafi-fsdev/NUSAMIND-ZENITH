// Header aman yang tidak mengubah tampilan. Content-Security-Policy dan Strict-Transport-Security sengaja
// belum diaktifkan: CSP perlu diuji terhadap UI (skrip inline), dan HSTS sebaiknya dipasang di reverse proxy HTTPS
// agar tidak mengunci http://localhost milik layanan pengembangan lain.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // TypeScript is enforced by `npm run check` before build in the R13.46 release gate.
  typescript: { ignoreBuildErrors: true },
  experimental: {
    cpus: 2,
    workerThreads: false,
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
  // Runtime corpora are shipped with the project and loaded on demand. They must
  // not be swept into every route's Node File Trace during production builds.
  outputFileTracingExcludes: {
    '/*': [
      './data/packs/**/*',
      './data/knowledge/**/*',
      './data/shards/**/*',
      './data/evaluations/**/*',
      './data/benchmarks/**/*',
      './data/language/**/*',
      './data/release/**/*',
      './storage/**/*',
      './workspace/**/*',
      './**/*.csv',
    ],
  },
};
export default nextConfig;

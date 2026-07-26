/** @type {import('next').NextConfig} */
const nextConfig = {
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

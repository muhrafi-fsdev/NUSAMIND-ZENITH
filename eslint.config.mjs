import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
export default defineConfig([
  ...nextVitals,
  // Existing storage hydration predates N2; keep compiler migration diagnostics visible without refactoring ChatShell.
  { files: ['components/ChatShell.tsx'], rules: { 'react-hooks/set-state-in-effect': 'warn', 'react-hooks/static-components': 'warn' } },
  globalIgnores(['.next/**', 'node_modules/**', 'next-env.d.ts', 'coverage/**', 'storage/**', 'workspace/**']),
]);

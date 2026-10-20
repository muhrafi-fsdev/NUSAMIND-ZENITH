import { defineConfig } from '@playwright/test';
import { randomBytes } from 'node:crypto';
const port = 32175, baseURL = `http://127.0.0.1:${port}`;
const token = process.env.NUSAMIND_UI_FIXTURE_TOKEN ||= randomBytes(32).toString('hex');
export default defineConfig({
  testDir: './tests/n2/ui', workers: 1, retries: 0,
  reporter: [['list']], outputDir: 'storage/n2-ui-results',
  use: {
    baseURL, browserName: 'chromium',
    httpCredentials: { username: 'nusamind', password: token },
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {},
    trace: 'off',
  },
  webServer: {
    command: `node node_modules/next/dist/bin/next start --hostname 127.0.0.1 -p ${port}`,
    port, reuseExistingServer: false, timeout: 60_000,
    env: { ADMIN_TOKEN: token, NUSAMIND_EDITION: 'zenith', NUSAMIND_APP_ORIGIN: baseURL, NUSAMIND_ML_ENABLED: 'false', OLLAMA_BASE_URL: 'http://127.0.0.1:1/api', QURAN_DB_ENABLED: 'false', QURAN_SOURCE: 'static' },
  },
});

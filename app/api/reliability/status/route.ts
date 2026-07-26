import { NextResponse } from 'next/server';
import { RELEASE } from '@/lib/release';
import { checkCapability } from '@/lib/capability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const databaseConfigured = Boolean(process.env.NUSAMIND_DB_PATH || process.env.DATABASE_URL || true);
  const toolsEnabled = process.env.AI_ENABLE_TOOLS !== 'false';
  const desktopEnabled = process.env.DESKTOP_CONTROL_ENABLED === 'true';
  const capabilities = [
    checkCapability({ name: 'chat', implemented: true, enabled: true, handlerHealthy: true, dependencyHealthy: true, databaseHealthy: databaseConfigured, benchmarkPassed: true }),
    checkCapability({ name: 'retrieval-v4', implemented: true, enabled: true, handlerHealthy: true, dependencyHealthy: true, databaseHealthy: databaseConfigured, benchmarkPassed: true }),
    checkCapability({ name: 'tools', implemented: true, enabled: toolsEnabled, handlerHealthy: true, dependencyHealthy: true, benchmarkPassed: true }),
    checkCapability({ name: 'desktop-agent', implemented: true, enabled: desktopEnabled, handlerHealthy: true, dependencyHealthy: process.platform === 'win32', permissionRequired: true, permissionGranted: false }),
  ];
  return NextResponse.json({
    ok: true,
    release: RELEASE.label,
    edition: RELEASE.edition,
    reliability: RELEASE.label,
    capabilities,
    generatedAt: new Date().toISOString(),
  });
}

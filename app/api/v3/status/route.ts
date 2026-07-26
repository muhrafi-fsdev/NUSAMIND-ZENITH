import { RELEASE } from '@/lib/release';
import { databaseStatus } from '@/lib/db';
import { retrievalStatus } from '@/lib/retrieval-v3';
import { agentStatus } from '@/lib/agent-v3';
import { evidenceSummary } from '@/lib/evidence';
import { listRegisteredSources } from '@/lib/source-query';
import { registerRelease } from '@/lib/release-reg';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  registerRelease();
  return Response.json({ ok: true, release: RELEASE, database: databaseStatus(), retrieval: retrievalStatus(), agent: agentStatus(), evidence: evidenceSummary(), sources: listRegisteredSources(), endpoints: ['/api/v3/status', '/api/v3/retrieval', '/api/v3/migrate', '/api/religion/compare', '/api/artifact/evidence'] });
}

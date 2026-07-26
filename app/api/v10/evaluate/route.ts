import {RELEASE} from '@/lib/release';import {evaluateCyberPolicy} from '@/packages/cybersecurity';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){const edition=RELEASE.edition as 'swift'|'zenith'|'apex';const cyber=evaluateCyberPolicy(edition);return Response.json({ok:true,release:RELEASE.label,edition,scope:'DEFENSIVE_CYBERSECURITY_POLICY_BENCHMARK',desktopApplicationUpdate:'CANCELLED',cyber});}

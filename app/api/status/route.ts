import path from 'node:path';
import { DATA_DIR, appConfig } from '@/lib/config';
import { checkOllama } from '@/lib/model';
import { getMonitoringSummary } from '@/lib/monitoring';
import { getFeedbackSummary } from '@/lib/feedback';
import { loadVectorLiteIndex } from '@/lib/vector-lite';
import { safeJson } from '@/lib/util';
import { editionProfile } from '@/lib/edition-profile';
import { databaseStatus } from '@/lib/db';
import { retrievalStatus } from '@/lib/retrieval-v3';
import { agentStatus } from '@/lib/agent-v3';
import { runtimeManifestV1347 } from '@/lib/runtime-manifest-v1347';
export const runtime='nodejs'; export const dynamic='force-dynamic';
async function count(file:string){const data=await safeJson<any[]>(path.join(DATA_DIR,file),[]);return Array.isArray(data)?data.length:0;}
export async function GET(){const [ollama,monitoring,feedback,vectorIndex,desktopPolicy]=await Promise.all([checkOllama(),getMonitoringSummary(),getFeedbackSummary(),loadVectorLiteIndex(),safeJson<any>(path.join(DATA_DIR,'runtime/desktop.json'),{})]);return Response.json({ok:true,v1347:runtimeManifestV1347(),release:editionProfile.releaseLabel,edition:editionProfile.editionName,provider:appConfig.provider,defaultMode:appConfig.defaultMode,globalCounts:editionProfile.globalCounts,datasets:{quranKnowledgeChunks:await count('quran/chunks.json'),quranFullSurahs:await count('quran/surahs.json'),universalKnowledgeItems:await count('core/universal.json'),languageVariants:await count('language/core.json'),goldenEvaluationCases:await count('evaluations/golden.json'),desktopDomainCapabilities:Array.isArray(desktopPolicy.items)?desktopPolicy.items.length:0,topCategories:editionProfile.topCategoryCount},desktopControl:editionProfile.desktopControl,namingConvention:editionProfile.namingConvention,monitoring,feedback,ollama,vectorIndex:{indexedDocs:Array.isArray(vectorIndex)?vectorIndex.length:0},database:databaseStatus(),retrieval:retrievalStatus(),agent:agentStatus(),cleanup:{noUiTouch:true,semanticNaming:true},endpoints:['/api/chat-json','/api/status','/api/desktop','/api/upload/analyze','/api/sessions','/api/coding','/api/v7/status','/api/v7/evaluate','/api/v7/retrieval','/api/v3/status','/api/v3/retrieval','/api/religion/compare','/api/artifact/evidence']});}

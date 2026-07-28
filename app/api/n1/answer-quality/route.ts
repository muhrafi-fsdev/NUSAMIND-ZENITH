import { answerQualityStatus } from '@/lib/academic-answer-engine';
import { RELEASE } from '@/lib/release';
export async function GET(){return Response.json({ok:true,...answerQualityStatus(String(RELEASE.edition))});}

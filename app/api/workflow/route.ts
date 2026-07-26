import { z } from 'zod';
import { buildWorkflowPlan, loadWorkflowBlueprint } from '@/lib/workflow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  projectName: z.string().optional().default('AL-QURAN NUSANTARA AI'),
  goal: z.string().optional().default('Bangun AI lokal yang jelas alurnya, stabil, dan mudah dikembangkan.'),
});

export async function GET() {
  const steps = await loadWorkflowBlueprint();
  return Response.json({ ok: true, steps, totalSteps: steps.length });
}

export async function POST(req: Request) {
  const body = schema.parse(await req.json());
  const plan = await buildWorkflowPlan(body.projectName, body.goal);
  return Response.json({ ok: true, plan });
}

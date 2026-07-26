import { recordFinanceRun } from '@/lib/finance-ledger';
import { z } from 'zod';
import {
  calculateInsuranceFinance,
  classifyInsuranceFinanceIntent,
  extractFinanceInputs,
  insuranceFinanceSummary,
  type InsuranceFinanceIntent,
} from '@/lib/ins-finance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const intentSchema = z.enum([
  'claim',
  'premium',
  'underwriting',
  'reserve',
  'reinsurance',
  'capital',
  'investment',
  'scenario',
  'unknown',
]);

const requestSchema = z.object({
  message: z.string().optional().default(''),
  intent: intentSchema.optional(),
  mode: z.string().optional(),
  inputs: z.record(z.string(), z.union([z.number(), z.string(), z.boolean(), z.null()])).optional().default({}),
});

export async function GET() {
  return Response.json({ ok: true, ...insuranceFinanceSummary() });
}

export async function POST(request: Request) {
  const body = requestSchema.parse(await request.json());
  const intent = (body.intent || classifyInsuranceFinanceIntent(body.message)) as InsuranceFinanceIntent;
  const extracted = body.message ? extractFinanceInputs(body.message) : {};
  const inputs = { ...extracted, ...body.inputs };
  const result = calculateInsuranceFinance(intent, inputs);
  const confidence = typeof result.confidence === 'number' ? result.confidence : (result.ok ? 0.85 : 0.45);
  const ledgerId = recordFinanceRun(intent, inputs, result, confidence);
  return Response.json(
    { ok: result.ok, intent, result, ledgerId, summary: insuranceFinanceSummary() },
    { status: result.ok ? 200 : 422 },
  );
}

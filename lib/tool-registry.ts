import { z } from 'zod';
import { inspectArtifact } from './artifact-v3';
import { planAgentGoal } from './agent-v3';
import { previewDesktopCommand, executeDesktopCommand } from './desktop-agent';
import { securityStatus } from './security-center';
import { inspectSqliteArtifact } from './sqlite-inspector';
import { scanRepository } from './repo-threat';

const registry = {
  'artifact.inspect': {
    schema: z.object({ artifactId: z.string().min(1).max(160) }).strict(),
    risk: 'low',
    execute: (args: { artifactId: string }) => inspectArtifact(args.artifactId),
  },
  'workflow.plan': {
    schema: z.object({ goal: z.string().min(1).max(4000), confirmed: z.boolean().optional(), sessionId: z.string().max(160).optional() }).strict(),
    risk: 'low',
    execute: (args: { goal: string; confirmed?: boolean; sessionId?: string }) => planAgentGoal(args.goal, Boolean(args.confirmed), args.sessionId),
  },
  'desktop.preview': {
    schema: z.object({ command: z.string().min(1).max(8000), cwd: z.string().max(1200).optional() }).strict(),
    risk: 'low',
    execute: (args: { command: string; cwd?: string }) => previewDesktopCommand(args.command, args.cwd || process.cwd()),
  },
  'desktop.execute': {
    schema: z.object({ command: z.string().min(1).max(8000), cwd: z.string().max(1200).optional(), confirmed: z.literal(true) }).strict(),
    risk: 'high',
    execute: (args: { command: string; cwd?: string; confirmed: true }) => executeDesktopCommand(args.command, args.cwd || process.cwd(), args.confirmed),
  },
  'security.status': {
    schema: z.object({}).strict(),
    risk: 'low',
    execute: () => securityStatus(),
  },
  'sqlite.inspect': {
    schema: z.object({ artifactId: z.string().min(1).max(160), query: z.string().max(8000).optional(), rowLimit: z.number().int().min(1).max(200).optional() }).strict(),
    risk: 'medium',
    execute: (args: { artifactId: string; query?: string; rowLimit?: number }) => inspectSqliteArtifact(args.artifactId, args.query, args.rowLimit),
  },
  'repo.scan': {
    schema: z.object({ path: z.string().min(1).max(1200) }).strict(),
    risk: 'medium',
    execute: (args: { path: string }) => scanRepository(args.path),
  },
} as const;

export type ToolId = keyof typeof registry;
export const toolIds = Object.keys(registry) as ToolId[];
export function toolDefinition(id: ToolId) { return registry[id]; }
export async function executeTypedTool(id: ToolId, args: unknown) {
  const entry = registry[id];
  const parsed = entry.schema.safeParse(args);
  if (!parsed.success) throw new Error(`Argumen tool ${id} tidak valid: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`);
  const result = await (entry.execute as (value: never) => unknown)(parsed.data as never);
  return {
    toolId: id,
    risk: entry.risk,
    expectedState: 'Tool selesai dalam scope yang divalidasi.',
    verification: result !== undefined ? 'Result tersedia.' : 'Result kosong.',
    result,
  };
}

import { z } from 'zod';

export const desktopActions = [
  'status','suggest','preview','execute','allow-folder','logs','stop',
  'file-create','file-edit','file-move','app-open','app-close',
] as const;
export type DesktopAction = typeof desktopActions[number];

export const desktopRequestSchema = z.object({
  action: z.enum(desktopActions),
  task: z.string().max(4000).optional(),
  command: z.string().max(8000).optional(),
  cwd: z.string().max(1200).optional(),
  confirmed: z.boolean().optional(),
  taskId: z.string().max(160).optional(),
  limit: z.number().int().min(1).max(500).optional(),
  path: z.string().max(1200).optional(),
  folder: z.string().max(1200).optional(),
  target: z.string().max(1200).optional(),
  content: z.string().max(2_000_000).optional(),
  mode: z.enum(['overwrite','append']).optional(),
  app: z.string().max(120).optional(),
  expectedHash: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
}).strict();

export type DesktopRequest = z.infer<typeof desktopRequestSchema>;
export type RiskLevel = 'low'|'medium'|'high'|'blocked';

const protectedActions = new Set<DesktopAction>([
  'execute','allow-folder','stop','file-create','file-edit','file-move','app-open','app-close',
]);
export function isProtectedDesktopAction(action: DesktopAction) { return protectedActions.has(action); }

import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { assertAllowedPath } from '../../lib/path-policy';
type McpServer = { id: string; name: string; command: string[]; cwd: string; trust: 'QUARANTINED' | 'VERIFIED' | 'BLOCKED'; enabled: boolean; sandboxCommand?: string[]; createdAt: string };
const file = (home: string) => assertAllowedPath(path.join(home, '.nusamind', 'mcp-registry.json'), { roots: [home] });
async function load(home: string): Promise<McpServer[]> {
  try { return JSON.parse(await fs.readFile(file(home), 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
}
export async function registerMcp(home: string, input: { name: string; command: string[]; cwd?: string; sandboxCommand?: string[] }) {
  if (!input.name || input.name.length > 160 || !Array.isArray(input.command) || !input.command.length || input.command.some(x => typeof x !== 'string' || x.length > 2000)) throw new Error('INVALID_MCP_CONFIG');
  const id = crypto.createHash('sha256').update(input.name + input.command.join('\0')).digest('hex').slice(0, 12);
  const item: McpServer = { id, name: input.name, command: input.command, cwd: assertAllowedPath(input.cwd || home, { roots: [home], allowMissing: false }), trust: 'QUARANTINED', enabled: false, createdAt: new Date().toISOString() };
  const all = await load(home);
  await fs.mkdir(path.dirname(file(home)), { recursive: true });
  await fs.writeFile(file(home), JSON.stringify([...all.filter(x => x.id !== id), item], null, 2));
  return item;
}
export async function listMcp(home: string) { return load(home); }
// shortcut: no OS isolation adapter is installed, keep MCP disabled until one is verified.
export async function inspectMcp(_home: string, _id: string): Promise<never> { throw new Error('MCP_EXECUTION_UNAVAILABLE_QUARANTINED'); }
export async function callMcpTool(_home: string, _id: string, _tool: string, _args: unknown, _approved: boolean): Promise<never> { throw new Error('MCP_EXECUTION_UNAVAILABLE_QUARANTINED'); }

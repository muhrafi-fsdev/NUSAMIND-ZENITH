import fs from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
async function safeReadDir(target) { try { return await fs.readdir(target); } catch { return []; } }
async function safeReadJson(file) { try { return JSON.parse(await fs.readFile(file, 'utf-8')); } catch { return []; } }
const sessions = (await safeReadDir(path.join(root, 'storage', 'sessions'))).filter((f) => f.endsWith('.json'));
const memory = (await safeReadDir(path.join(root, 'storage', 'memory'))).filter((f) => f.endsWith('.json'));
const logs = (await safeReadDir(path.join(root, 'storage', 'logs'))).filter((f) => f.endsWith('.json'));
let totalInteractionLogs = 0;
for (const log of logs) totalInteractionLogs += (await safeReadJson(path.join(root, 'storage', 'logs', log))).length;
console.log({ totalSessions: sessions.length, totalMemoryFiles: memory.length, totalInteractionLogs, logFiles: logs.length });

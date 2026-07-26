import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn, type ChildProcess } from 'node:child_process';
import { generateText } from 'ai';
import { z } from 'zod';
import { getModel } from './model';

const fileSchema = z.object({
  path: z.string().min(1).max(180),
  content: z.string().max(500_000),
});

const planSchema = z.object({
  projectName: z.string().min(1).max(80),
  framework: z.enum(['static', 'next', 'vite']).default('static'),
  summary: z.string().min(1).max(800),
  files: z.array(fileSchema).min(1).max(100),
  notes: z.array(z.string().max(300)).max(20).default([]),
});

const patchSchema = z.object({
  files: z.array(fileSchema).min(1).max(30),
  explanation: z.string().max(1000).optional(),
});

export type CodingFramework = 'static' | 'next' | 'vite';
export type CodingJobStatus = 'planned' | 'applied' | 'installing' | 'building' | 'running' | 'failed' | 'rolled-back';

export interface CodingPlan {
  jobId: string;
  prompt: string;
  targetPath: string;
  projectName: string;
  framework: CodingFramework;
  summary: string;
  files: Array<{ path: string; content: string }>;
  notes: string[];
  status: CodingJobStatus;
  createdAt: string;
  updatedAt: string;
  buildAttempts: number;
  lastError?: string;
  devUrl?: string;
}

const storageRoot = path.join(/*turbopackIgnore: true*/ process.cwd(), 'storage', 'coding');
const jobsDir = path.join(storageRoot, 'jobs');
const auditFile = path.join(storageRoot, 'actions.jsonl');
const activeProcesses = new Map<string, ChildProcess>();

type CodingEdition = 'swift' | 'zenith' | 'apex';

function codingEdition(): CodingEdition {
  const value = String(process.env.NUSAMIND_EDITION || process.env.CODING_AGENT_TIER || 'apex').toLowerCase();
  return value === 'swift' || value === 'zenith' ? value : 'apex';
}

function codingPolicy() {
  const edition = codingEdition();
  return {
    edition,
    supportedFrameworks: edition === 'swift' ? (['static'] as CodingFramework[]) : (['static', 'next', 'vite'] as CodingFramework[]),
    canRunCommands: edition !== 'swift',
    autoRepair: edition === 'apex',
    maxRepairAttempts: edition === 'apex' ? 2 : 1,
  };
}

function codingEnabled() {
  return process.env.CODING_AGENT_ENABLED === 'true';
}

function confirmationRequired() {
  return process.env.CODING_AGENT_CONFIRMATION_REQUIRED !== 'false';
}

function workspaceRoot() {
  return path.resolve(process.env.CODING_AGENT_WORKSPACE || path.join(/*turbopackIgnore: true*/ process.cwd(), 'workspace'));
}

function maxFiles() {
  const value = Number(process.env.CODING_AGENT_MAX_FILES || 100);
  return Number.isFinite(value) ? Math.min(Math.max(value, 1), 200) : 100;
}

function maxSteps() {
  const value = Number(process.env.CODING_AGENT_MAX_STEPS || 12);
  return Number.isFinite(value) ? Math.min(Math.max(value, 1), 30) : 12;
}

function safeId() {
  return `code_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePath(value: string) {
  return path.resolve(value).toLowerCase();
}

function inside(candidate: string, root = workspaceRoot()) {
  const target = normalizePath(candidate);
  const base = normalizePath(root);
  return target === base || target.startsWith(base + path.sep);
}

function safeRelative(relativePath: string) {
  const clean = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!clean || clean.includes('\0')) throw new Error('Nama file tidak valid.');
  const parts = clean.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) throw new Error(`Path relatif tidak aman: ${relativePath}`);
  if (clean.startsWith('.git/') || clean === '.git' || clean.startsWith('node_modules/')) throw new Error(`Path terlarang: ${relativePath}`);
  return clean;
}

function requireEnabled(confirmed = false) {
  if (!codingEnabled()) throw new Error('Coding agent nonaktif. Set CODING_AGENT_ENABLED=true di .env lalu restart server.');
  if (confirmationRequired() && !confirmed) throw new Error('Konfirmasi eksplisit diperlukan sebelum menulis file atau menjalankan command.');
}

async function audit(entry: Record<string, unknown>) {
  await fs.mkdir(storageRoot, { recursive: true });
  const clean = JSON.stringify({ ...entry, at: new Date().toISOString() })
    .replace(/(token|password|secret|api[_-]?key)\s*[:=]\s*[^\s"']+/gi, '$1=***');
  await fs.appendFile(auditFile, clean + '\n', 'utf8');
}

async function saveJob(job: CodingPlan) {
  await fs.mkdir(jobsDir, { recursive: true });
  job.updatedAt = new Date().toISOString();
  await fs.writeFile(path.join(jobsDir, `${job.jobId}.json`), JSON.stringify(job, null, 2), 'utf8');
}

export async function loadCodingJob(jobId: string): Promise<CodingPlan> {
  const cleanId = jobId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cleanId) throw new Error('Job ID tidak valid.');
  return JSON.parse(await fs.readFile(path.join(jobsDir, `${cleanId}.json`), 'utf8')) as CodingPlan;
}

function stripCodeFence(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

function defaultStaticPlan(prompt: string, projectName: string) {
  const safeTitle = projectName.replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  return {
    projectName,
    framework: 'static' as const,
    summary: `Landing page statis modern untuk ${safeTitle}.`,
    notes: ['Fallback template dipakai karena output model tidak dapat diparsing sebagai manifest project.'],
    files: [
      {
        path: 'index.html',
        content: `<!doctype html>\n<html lang="id">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <meta name="description" content="${safeTitle}" />\n  <title>${safeTitle}</title>\n  <link rel="stylesheet" href="styles.css" />\n</head>\n<body>\n  <header class="nav"><strong>${safeTitle}</strong><a href="#contact">Hubungi Kami</a></header>\n  <main>\n    <section class="hero">\n      <p class="eyebrow">SOLUSI DIGITAL MODERN</p>\n      <h1>Bangun pengalaman digital yang cepat, jelas, dan meyakinkan.</h1>\n      <p>Kami membantu mengubah ide menjadi tampilan profesional yang siap dipresentasikan.</p>\n      <div class="actions"><a class="primary" href="#features">Lihat Fitur</a><a href="#contact">Konsultasi</a></div>\n    </section>\n    <section id="features" class="grid">\n      <article><h2>Responsif</h2><p>Nyaman dibuka dari desktop maupun perangkat seluler.</p></article>\n      <article><h2>Ringan</h2><p>Struktur sederhana dengan performa yang mudah dipelihara.</p></article>\n      <article><h2>Terarah</h2><p>Konten disusun untuk membantu pengunjung memahami layanan.</p></article>\n    </section>\n    <section id="contact" class="cta"><h2>Siap memulai?</h2><p>Hubungi kami untuk membahas kebutuhan project.</p><a class="primary" href="mailto:hello@example.com">hello@example.com</a></section>\n  </main>\n  <footer>© ${new Date().getFullYear()} ${safeTitle}</footer>\n  <script src="script.js"></script>\n</body>\n</html>\n`,
      },
      {
        path: 'styles.css',
        content: `:root{font-family:Inter,system-ui,sans-serif;color:#eaf2ff;background:#071225;line-height:1.6}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top right,#123866 0,transparent 34%),#071225}.nav{max-width:1120px;margin:auto;padding:24px;display:flex;justify-content:space-between;align-items:center}.nav a,.actions a,.cta a{color:inherit;text-decoration:none}.nav>a{border:1px solid #5ed8ff;padding:10px 16px;border-radius:999px}main{max-width:1120px;margin:auto;padding:32px 24px 80px}.hero{padding:92px 0 72px;max-width:820px}.eyebrow{color:#5ed8ff;font-weight:700;letter-spacing:.18em}.hero h1{font-size:clamp(2.6rem,7vw,5.6rem);line-height:1.02;margin:.3em 0}.hero>p{font-size:1.2rem;color:#afc4df;max-width:660px}.actions{display:flex;gap:14px;margin-top:32px}.actions a{padding:14px 20px;border:1px solid #34516f;border-radius:12px}.primary{background:linear-gradient(135deg,#18bff2,#18e0b4);color:#032033!important;border:0!important;font-weight:800}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.grid article,.cta{background:rgba(13,36,67,.72);border:1px solid #244c75;border-radius:20px;padding:28px;backdrop-filter:blur(12px)}.grid p,.cta p{color:#afc4df}.cta{margin-top:72px;text-align:center;padding:56px}.cta .primary{display:inline-block;padding:14px 20px;border-radius:12px}footer{text-align:center;padding:24px;color:#7e9ab9}@media(max-width:760px){.grid{grid-template-columns:1fr}.nav{padding:18px}.hero{padding-top:64px}.actions{flex-direction:column}}\n`,
      },
      { path: 'script.js', content: `document.querySelectorAll('a[href^="#"]').forEach((link)=>link.addEventListener('click',(event)=>{const target=document.querySelector(link.getAttribute('href'));if(target){event.preventDefault();target.scrollIntoView({behavior:'smooth'});}}));\n` },
      { path: 'package.json', content: JSON.stringify({ name: projectName, private: true, version: '1.0.0', scripts: { dev: 'node server.mjs', start: 'node server.mjs', build: 'node -e "console.log(\\"Static project: no build required\\")"' } }, null, 2) + '\n' },
      { path: 'server.mjs', content: `import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';const port=Number(process.env.PORT||3100);const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};http.createServer(async(req,res)=>{try{const pathname=req.url==='/'?'/index.html':decodeURIComponent(req.url||'/');const file=path.join(/*turbopackIgnore: true*/ process.cwd(),pathname.replace(/^\\//,''));const data=await fs.readFile(file);res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}}).listen(port,'127.0.0.1',()=>console.log('Server: http://localhost:'+port));\n` },
      { path: 'README.md', content: `# ${safeTitle}\n\nProject dibuat oleh NusaMind Apex Coding Agent.\n\n## Menjalankan\n\n\`\`\`bash\nnpm run dev\n\`\`\`\n` },
    ],
  };
}


function defaultFrameworkPlan(prompt: string, projectName: string, framework: CodingFramework) {
  if (framework === 'static') return defaultStaticPlan(prompt, projectName);
  const title = projectName.replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  if (framework === 'next') {
    return {
      projectName,
      framework: 'next' as const,
      summary: `Landing page Next.js modern untuk ${title}.`,
      notes: ['Template fallback Next.js digunakan karena manifest model tidak dapat diparsing.'],
      files: [
        { path: 'app/layout.tsx', content: `import './globals.css';\nexport const metadata={title:'${title}',description:'Landing page ${title}'};\nexport default function RootLayout({children}:{children:React.ReactNode}){return <html lang="id"><body>{children}</body></html>;}\n` },
        { path: 'app/page.tsx', content: `const features=[['Cepat','Struktur ringan dan fokus pada performa.'],['Responsif','Tampilan nyaman di semua ukuran layar.'],['Terarah','Konten disusun agar pesan mudah dipahami.']];\nexport default function Page(){return <main><nav><strong>${title}</strong><a href="#contact">Hubungi</a></nav><section className="hero"><p className="eyebrow">SOLUSI DIGITAL</p><h1>Landing page modern yang siap memperkenalkan bisnis Anda.</h1><p>Tampilan profesional, responsif, dan mudah dikembangkan.</p><div className="actions"><a className="primary" href="#features">Lihat fitur</a><a href="#contact">Konsultasi</a></div></section><section id="features" className="grid">{features.map(([name,desc])=><article key={name}><h2>{name}</h2><p>{desc}</p></article>)}</section><section id="contact" className="cta"><h2>Mulai project Anda</h2><p>Hubungi kami untuk mendiskusikan kebutuhan landing page.</p><a className="primary" href="mailto:hello@example.com">hello@example.com</a></section><footer>© ${new Date().getFullYear()} ${title}</footer></main>}\n` },
        { path: 'app/globals.css', content: `:root{font-family:Arial,sans-serif;color:#eaf2ff;background:#071225}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top right,#153b69 0,transparent 36%),#071225}main{max-width:1120px;margin:auto;padding:0 24px}nav{display:flex;justify-content:space-between;align-items:center;padding:24px 0}a{color:inherit;text-decoration:none}.hero{padding:90px 0 70px;max-width:820px}.eyebrow{color:#5ed8ff;font-weight:800;letter-spacing:.15em}.hero h1{font-size:clamp(2.8rem,7vw,5.6rem);line-height:1.02;margin:.25em 0}.hero>p,.grid p,.cta p{color:#afc4df;font-size:1.1rem}.actions{display:flex;gap:14px;margin-top:30px}.actions a,.cta a,nav a{padding:13px 18px;border:1px solid #355879;border-radius:12px}.primary{background:linear-gradient(135deg,#19c0f3,#18dfb5);color:#032033;font-weight:800;border:0!important}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.grid article,.cta{padding:28px;border:1px solid #244c75;border-radius:20px;background:rgba(13,36,67,.72)}.cta{text-align:center;margin-top:72px;padding:56px}footer{text-align:center;color:#819dbd;padding:48px 0}@media(max-width:760px){.grid{grid-template-columns:1fr}.actions{flex-direction:column}}\n` },
        { path: 'tsconfig.json', content: JSON.stringify({ compilerOptions: { target: 'ES2017', lib: ['dom','dom.iterable','esnext'], allowJs: false, skipLibCheck: true, strict: true, noEmit: true, esModuleInterop: true, module: 'esnext', moduleResolution: 'bundler', resolveJsonModule: true, isolatedModules: true, jsx: 'preserve', incremental: true, plugins: [{name:'next'}] }, include: ['next-env.d.ts','**/*.ts','**/*.tsx','.next/types/**/*.ts'], exclude: ['node_modules'] }, null, 2) + '\n' },
        { path: 'next-env.d.ts', content: `/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n` },
      ],
    };
  }
  return {
    projectName,
    framework: 'vite' as const,
    summary: `Landing page React + Vite modern untuk ${title}.`,
    notes: ['Template fallback Vite digunakan karena manifest model tidak dapat diparsing.'],
    files: [
      { path: 'index.html', content: `<!doctype html><html lang="id"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>${title}</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>` },
      { path: 'src/main.tsx', content: `import React from 'react';import{createRoot}from'react-dom/client';import App from './App';import './styles.css';createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);\n` },
      { path: 'src/App.tsx', content: `const features=[['Cepat','Performa ringan.'],['Responsif','Nyaman di semua perangkat.'],['Modern','Desain profesional.']];export default function App(){return <main><nav><strong>${title}</strong><a href="#contact">Hubungi</a></nav><section className="hero"><p>LANDING PAGE MODERN</p><h1>Bangun kehadiran digital yang lebih meyakinkan.</h1><span>Tampilan cepat, responsif, dan mudah dikembangkan.</span></section><section className="grid">{features.map(([a,b])=><article key={a}><h2>{a}</h2><p>{b}</p></article>)}</section><section id="contact" className="cta"><h2>Siap memulai?</h2><a href="mailto:hello@example.com">hello@example.com</a></section></main>}\n` },
      { path: 'src/styles.css', content: `:root{font-family:Inter,Arial,sans-serif;color:#eef6ff;background:#071225}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top right,#194375 0,transparent 35%),#071225}main{max-width:1100px;margin:auto;padding:0 24px}nav{display:flex;justify-content:space-between;padding:24px 0}a{color:#65e1ff}.hero{padding:100px 0}.hero>p{color:#65e1ff;font-weight:800}.hero h1{font-size:clamp(3rem,8vw,6rem);line-height:1;margin:.25em 0}.hero span,.grid p{color:#abc1dc}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.grid article,.cta{background:#0d2443;border:1px solid #28527b;border-radius:20px;padding:28px}.cta{text-align:center;margin:70px 0;padding:55px}@media(max-width:760px){.grid{grid-template-columns:1fr}}\n` },
      { path: 'vite.config.ts', content: `import{defineConfig}from'vite';import react from'@vitejs/plugin-react';export default defineConfig({plugins:[react()]});\n` },
      { path: 'tsconfig.json', content: JSON.stringify({ compilerOptions: { target: 'ES2020', useDefineForClassFields: true, lib: ['ES2020','DOM','DOM.Iterable'], allowJs: false, skipLibCheck: true, esModuleInterop: true, allowSyntheticDefaultImports: true, strict: true, forceConsistentCasingInFileNames: true, module: 'ESNext', moduleResolution: 'Node', resolveJsonModule: true, isolatedModules: true, noEmit: true, jsx: 'react-jsx' }, include: ['src'], references: [] }, null, 2) + '\n' },
    ],
  };
}

function normalizePlanFiles(framework: CodingFramework, projectName: string, files: Array<{ path: string; content: string }>) {
  const normalized = files.slice(0, maxFiles()).map((file) => ({ path: safeRelative(file.path), content: file.content }));
  const names = new Set(normalized.map((file) => file.path.toLowerCase()));
  if (!names.has('package.json')) {
    const scripts = framework === 'next'
      ? { dev: 'next dev', build: 'next build', start: 'next start' }
      : framework === 'vite'
        ? { dev: 'vite', build: 'vite build', preview: 'vite preview' }
        : { dev: 'node server.mjs', build: 'node -e "console.log(\\"Static project: no build required\\")"', start: 'node server.mjs' };
    const dependencies = framework === 'next'
      ? { next: '16.2.10', react: '19.2.7', 'react-dom': '19.2.7' }
      : framework === 'vite'
        ? { '@vitejs/plugin-react': 'latest', vite: 'latest', react: '19.2.7', 'react-dom': '19.2.7' }
        : {};
    normalized.push({ path: 'package.json', content: JSON.stringify({ name: projectName, version: '1.0.0', private: true, scripts, dependencies }, null, 2) + '\n' });
  }
  if (framework === 'static' && !names.has('server.mjs')) {
    normalized.push({ path: 'server.mjs', content: defaultStaticPlan('', projectName).files.find((file) => file.path === 'server.mjs')!.content });
  }
  return normalized;
}

function slugFromPrompt(prompt: string) {
  const cleaned = prompt
    .toLowerCase()
    .replace(/\b(buat|bangun|generate|rancang|tolong|sebuah|project|proyek|website|web|aplikasi)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42);
  return cleaned || `project-${Date.now().toString().slice(-6)}`;
}

async function targetIsAvailable(candidate: string) {
  try {
    const entries = await fs.readdir(candidate);
    return entries.length === 0;
  } catch {
    return true;
  }
}

async function availableTarget(candidate: string, root: string) {
  if (!inside(candidate, root)) throw new Error(`Target harus berada di coding workspace: ${root}`);
  if (await targetIsAvailable(candidate)) return { targetPath: candidate, adjusted: false };
  for (let index = 2; index <= 99; index += 1) {
    const next = `${candidate}-${index}`;
    if (await targetIsAvailable(next)) return { targetPath: next, adjusted: true };
  }
  throw new Error('Tidak dapat menentukan folder project kosong. Gunakan nama folder target lain.');
}

export async function codingStatus() {
  await fs.mkdir(jobsDir, { recursive: true });
  const files = await fs.readdir(jobsDir).catch(() => [] as string[]);
  const policy = codingPolicy();
  return {
    enabled: codingEnabled(),
    confirmationRequired: confirmationRequired(),
    workspace: workspaceRoot(),
    edition: policy.edition,
    activeJobs: [...activeProcesses.keys()],
    storedJobs: files.filter((file) => file.endsWith('.json')).length,
    maxFiles: maxFiles(),
    maxSteps: maxSteps(),
    supportedFrameworks: policy.supportedFrameworks,
    canRunCommands: policy.canRunCommands,
    autoRepair: policy.autoRepair,
    actions: policy.canRunCommands
      ? ['plan', 'create', 'apply', 'build', 'start', 'rollback', 'logs', 'stop']
      : ['plan', 'create', 'apply', 'rollback', 'logs'],
  };
}

export async function planCodingProject(input: { prompt: string; targetPath?: string; projectName?: string; framework?: CodingFramework }) {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error('Prompt project belum diisi.');
  const fallbackName = (input.projectName || slugFromPrompt(prompt)).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || `project-${Date.now().toString().slice(-6)}`;
  const root = workspaceRoot();
  await fs.mkdir(root, { recursive: true });
  const rawTarget = String(input.targetPath || '').trim().replace(/^['"]|['"]$/g, '');
  const candidate = path.resolve(rawTarget || path.join(root, fallbackName));
  const available = await availableTarget(candidate, root);
  const targetPath = available.targetPath;

  const inferredFramework: CodingFramework = /\b(next|next\.js)\b/i.test(prompt) ? 'next' : /\b(vite|react)\b/i.test(prompt) ? 'vite' : 'static';
  const policy = codingPolicy();
  const requestedFramework = input.framework || inferredFramework;
  const effectiveFramework = policy.supportedFrameworks.includes(requestedFramework) ? requestedFramework : 'static';
  const system = [
    `Anda adalah coding planner NusaMind ${codingPolicy().edition}.`,
    'Balas HANYA JSON valid tanpa markdown.',
    'Gunakan Bahasa Indonesia untuk teks UI kecuali user meminta bahasa lain.',
    'Buat project lengkap, minimal, rapi, dan dapat dijalankan.',
    'Jangan menghasilkan secret, token, malware, shell command, atau path absolut.',
    'Semua file harus memakai path relatif aman.',
    `Framework wajib: ${effectiveFramework}.`,
    `Maksimal file: ${maxFiles()}.`,
    'Schema: {"projectName":"...","framework":"static|next|vite","summary":"...","files":[{"path":"...","content":"..."}],"notes":["..."]}',
  ].join('\n');

  let parsed: z.infer<typeof planSchema>;
  try {
    const result = await generateText({
      model: getModel({ mode: 'coding', confidence: 1, reasons: ['coding-agent'], safety: 'normal' }),
      system,
      prompt,
      temperature: 0.2,
      maxOutputTokens: 12_000,
    });
    parsed = planSchema.parse(JSON.parse(stripCodeFence(result.text)));
  } catch {
    parsed = planSchema.parse(defaultFrameworkPlan(prompt, fallbackName, effectiveFramework));
  }

  if (parsed.framework !== effectiveFramework) {
    parsed = planSchema.parse(defaultFrameworkPlan(prompt, fallbackName, effectiveFramework));
  }
  const now = new Date().toISOString();
  const job: CodingPlan = {
    jobId: safeId(),
    prompt,
    targetPath,
    projectName: parsed.projectName.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || fallbackName,
    framework: parsed.framework,
    summary: parsed.summary,
    files: normalizePlanFiles(parsed.framework, fallbackName, parsed.files),
    notes: available.adjusted
      ? [...parsed.notes, `Folder target sudah terpakai; project dialihkan aman ke: ${targetPath}`]
      : parsed.notes,
    status: 'planned',
    createdAt: now,
    updatedAt: now,
    buildAttempts: 0,
  };
  await saveJob(job);
  await audit({ action: 'plan', jobId: job.jobId, targetPath, framework: job.framework, fileCount: job.files.length });
  return job;
}

async function directoryIsEmpty(folder: string) {
  try { return (await fs.readdir(folder)).length === 0; } catch { return true; }
}

export async function applyCodingPlan(jobId: string, confirmed = false) {
  requireEnabled(confirmed);
  const job = await loadCodingJob(jobId);
  if (!inside(job.targetPath)) throw new Error('Target project keluar dari coding workspace.');
  const exists = await fs.stat(job.targetPath).then(() => true).catch(() => false);
  if (exists && !(await directoryIsEmpty(job.targetPath))) throw new Error('Target sudah berisi file. Coding agent hanya membuat project baru agar tidak menimpa pekerjaan lama.');
  await fs.mkdir(job.targetPath, { recursive: true });
  for (const file of job.files.slice(0, maxFiles())) {
    const relative = safeRelative(file.path);
    const target = path.join(job.targetPath, relative);
    if (!inside(target, job.targetPath)) throw new Error(`File keluar dari project: ${relative}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, { encoding: 'utf8', flag: 'wx' });
  }
  await fs.writeFile(path.join(job.targetPath, '.nusamind-job.json'), JSON.stringify({ jobId: job.jobId, createdAt: job.createdAt, framework: job.framework }, null, 2), 'utf8');
  job.status = 'applied';
  await saveJob(job);
  await audit({ action: 'apply', jobId, targetPath: job.targetPath, fileCount: job.files.length });
  return job;
}

function npmBin() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

async function runProcess(command: string, args: string[], cwd: string, timeoutMs: number) {
  return await new Promise<{ exitCode: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: false, windowsHide: true, env: { ...process.env, npm_config_registry: 'https://registry.npmjs.org/', npm_config_audit: 'false', npm_config_fund: 'false' } });
    let stdout = '';
    let stderr = '';
    const cap = 256 * 1024;
    child.stdout?.on('data', (chunk) => { if (stdout.length < cap) stdout += String(chunk); });
    child.stderr?.on('data', (chunk) => { if (stderr.length < cap) stderr += String(chunk); });
    const timer = setTimeout(() => { child.kill(); reject(new Error(`Command timeout setelah ${Math.round(timeoutMs / 1000)} detik.`)); }, timeoutMs);
    child.on('error', reject);
    child.on('close', (exitCode) => { clearTimeout(timer); resolve({ exitCode, stdout: stdout.slice(0, cap), stderr: stderr.slice(0, cap) }); });
  });
}

async function collectRepairContext(projectPath: string) {
  const candidates = ['package.json', 'tsconfig.json', 'next.config.mjs', 'vite.config.ts', 'vite.config.js', 'app/page.tsx', 'src/App.tsx', 'src/main.tsx', 'index.html', 'styles.css'];
  const chunks: string[] = [];
  for (const relative of candidates) {
    try {
      const content = await fs.readFile(path.join(projectPath, relative), 'utf8');
      chunks.push(`FILE: ${relative}\n${content.slice(0, 30_000)}`);
    } catch { /* optional */ }
  }
  return chunks.join('\n\n').slice(0, 100_000);
}

async function attemptRepair(job: CodingPlan, buildLog: string) {
  const context = await collectRepairContext(job.targetPath);
  const system = [
    'Anda adalah repair agent TypeScript/JavaScript.',
    'Balas HANYA JSON valid tanpa markdown.',
    'Berikan hanya file yang harus ditimpa untuk memperbaiki build.',
    'Jangan mengubah file di luar project dan jangan menambahkan command shell.',
    'Schema: {"files":[{"path":"...","content":"..."}],"explanation":"..."}',
  ].join('\n');
  const result = await generateText({
    model: getModel({ mode: 'coding', confidence: 1, reasons: ['build-repair'], safety: 'normal' }),
    system,
    prompt: `Framework: ${job.framework}\nError build:\n${buildLog.slice(-40_000)}\n\nFile project:\n${context}`,
    temperature: 0.1,
    maxOutputTokens: 10_000,
  });
  const patch = patchSchema.parse(JSON.parse(stripCodeFence(result.text)));
  for (const file of patch.files) {
    const relative = safeRelative(file.path);
    const target = path.join(job.targetPath, relative);
    if (!inside(target, job.targetPath)) throw new Error(`Patch keluar dari project: ${relative}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  await audit({ action: 'repair', jobId: job.jobId, files: patch.files.map((file) => file.path) });
  return patch.explanation || 'Patch build diterapkan.';
}

export async function buildCodingProject(jobId: string, confirmed = false, options: { install?: boolean; autoRepair?: boolean } = {}) {
  requireEnabled(confirmed);
  const policy = codingPolicy();
  if (!policy.canRunCommands) throw new Error('Swift hanya membuat source project. Build dan command execution tersedia di Zenith/Apex.');
  const job = await loadCodingJob(jobId);
  if (!inside(job.targetPath)) throw new Error('Project keluar dari coding workspace.');
  await fs.access(path.join(job.targetPath, 'package.json'));
  job.status = options.install === false ? 'building' : 'installing';
  await saveJob(job);
  const logs: Array<Record<string, unknown>> = [];

  if (options.install !== false) {
    const install = await runProcess(npmBin(), ['install', '--no-audit', '--no-fund'], job.targetPath, 5 * 60_000);
    logs.push({ step: 'install', ...install });
    if (install.exitCode !== 0) {
      job.status = 'failed';
      job.lastError = install.stderr || install.stdout;
      await saveJob(job);
      throw new Error(`npm install gagal.\n${job.lastError.slice(-6000)}`);
    }
  }

  const attempts = options.autoRepair === false || !policy.autoRepair ? 1 : Math.min(policy.maxRepairAttempts, maxSteps());
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    job.status = 'building';
    job.buildAttempts += 1;
    await saveJob(job);
    const build = await runProcess(npmBin(), ['run', 'build'], job.targetPath, 3 * 60_000);
    logs.push({ step: `build-${attempt}`, ...build });
    if (build.exitCode === 0) {
      job.status = 'applied';
      job.lastError = undefined;
      await saveJob(job);
      await audit({ action: 'build', jobId, success: true, attempts: attempt });
      return { job, success: true, logs };
    }
    const buildLog = `${build.stdout}\n${build.stderr}`;
    job.lastError = buildLog;
    await saveJob(job);
    if (attempt < attempts) {
      try {
        const explanation = await attemptRepair(job, buildLog);
        logs.push({ step: `repair-${attempt}`, explanation });
      } catch (error) {
        logs.push({ step: `repair-${attempt}`, error: error instanceof Error ? error.message : String(error) });
        break;
      }
    }
  }
  job.status = 'failed';
  await saveJob(job);
  await audit({ action: 'build', jobId, success: false, attempts: job.buildAttempts });
  return { job, success: false, logs };
}

export async function startCodingProject(jobId: string, confirmed = false, port = 3100) {
  requireEnabled(confirmed);
  if (!codingPolicy().canRunCommands) throw new Error('Swift tidak menjalankan dev server. Gunakan Zenith atau Apex untuk eksekusi supervised.');
  const job = await loadCodingJob(jobId);
  if (activeProcesses.has(jobId)) throw new Error('Dev server project ini sudah aktif.');
  if (!inside(job.targetPath)) throw new Error('Project keluar dari coding workspace.');
  const safePort = Math.min(Math.max(Number(port) || 3100, 1024), 65535);
  const args = job.framework === 'next'
    ? ['run', 'dev', '--', '--port', String(safePort)]
    : job.framework === 'vite'
      ? ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(safePort)]
      : ['run', 'dev'];
  const child = spawn(npmBin(), args, { cwd: job.targetPath, shell: false, windowsHide: false, env: { ...process.env, PORT: String(safePort) } });
  activeProcesses.set(jobId, child);
  const logPath = path.join(storageRoot, `${jobId}.dev.log`);
  await fs.mkdir(storageRoot, { recursive: true });
  child.stdout?.on('data', (chunk) => { void fs.appendFile(logPath, String(chunk)); });
  child.stderr?.on('data', (chunk) => { void fs.appendFile(logPath, String(chunk)); });
  child.on('close', () => activeProcesses.delete(jobId));
  job.status = 'running';
  job.devUrl = `http://localhost:${safePort}`;
  await saveJob(job);
  await audit({ action: 'start', jobId, port: safePort, targetPath: job.targetPath });
  return { jobId, pid: child.pid, url: job.devUrl, logPath };
}

export async function stopCodingProject(jobId: string, confirmed = false) {
  requireEnabled(confirmed);
  const child = activeProcesses.get(jobId);
  if (!child) return false;
  child.kill();
  activeProcesses.delete(jobId);
  const job = await loadCodingJob(jobId);
  job.status = 'applied';
  await saveJob(job);
  await audit({ action: 'stop', jobId });
  return true;
}

export async function rollbackCodingProject(jobId: string, confirmed = false) {
  requireEnabled(confirmed);
  const job = await loadCodingJob(jobId);
  if (!inside(job.targetPath)) throw new Error('Project keluar dari coding workspace.');
  const markerPath = path.join(job.targetPath, '.nusamind-job.json');
  const marker = JSON.parse(await fs.readFile(markerPath, 'utf8')) as { jobId?: string };
  if (marker.jobId !== jobId) throw new Error('Marker project tidak cocok; rollback diblokir.');
  await stopCodingProject(jobId, confirmed).catch(() => false);
  await fs.rm(job.targetPath, { recursive: true, force: true });
  job.status = 'rolled-back';
  await saveJob(job);
  await audit({ action: 'rollback', jobId, targetPath: job.targetPath });
  return job;
}

export async function readCodingLogs(limit = 50) {
  try {
    const text = await fs.readFile(auditFile, 'utf8');
    return text.split(/\r?\n/).filter(Boolean).slice(-Math.min(Math.max(limit, 1), 200)).map((line) => JSON.parse(line));
  } catch { return []; }
}

export async function createCodingProject(input: { prompt: string; targetPath?: string; projectName?: string; framework?: CodingFramework; confirmed?: boolean; install?: boolean; build?: boolean; start?: boolean; port?: number }) {
  requireEnabled(Boolean(input.confirmed));
  const policy = codingPolicy();
  const warnings: string[] = [];
  const job = await planCodingProject(input);
  await applyCodingPlan(job.jobId, Boolean(input.confirmed));

  let buildResult: unknown = null;
  let server: unknown = null;
  if (policy.canRunCommands && input.build !== false) {
    try {
      buildResult = await buildCodingProject(job.jobId, Boolean(input.confirmed), {
        install: job.framework === 'static' ? false : input.install !== false,
        autoRepair: policy.autoRepair,
      });
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : String(error));
    }
  } else if (!policy.canRunCommands && (input.build || input.start)) {
    warnings.push('Swift selesai membuat file project tanpa menjalankan command.');
  }

  const current = await loadCodingJob(job.jobId);
  if (policy.canRunCommands && input.start && current.status !== 'failed') {
    try {
      server = await startCodingProject(job.jobId, Boolean(input.confirmed), input.port || 3100);
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { job: await loadCodingJob(job.jobId), build: buildResult, server, warnings };
}

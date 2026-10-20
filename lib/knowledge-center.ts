import crypto from 'node:crypto';
import { authenticateRequest } from './api-auth';
import fs from 'node:fs';
import path from 'node:path';
import { getDatabase } from './db.ts';
import { RELEASE } from './release.ts';
import { createId, normalizeText, tokenize } from './util.ts';

export type KnowledgeEdition = 'swift' | 'zenith' | 'apex';
export type KnowledgeStatus = 'IMPORTED' | 'VALIDATED' | 'REVIEW_REQUIRED' | 'VERIFIED' | 'ACTIVE' | 'DEPRECATED' | 'REJECTED' | 'QUARANTINED';

export type DomainDefinition = {
  domain_id: string;
  domain_name: string;
  example_subdomains: string;
  stability_class: 'stable' | 'moderate' | 'fast' | string;
  source_priority: string;
  swift_depth: string;
  zenith_depth: string;
  apex_depth: string;
  high_stakes: string;
  review_frequency: string;
};

export type KnowledgeRecordInput = {
  knowledge_id?: string;
  domain: string;
  subdomain?: string;
  language?: string;
  title: string;
  content: string;
  source_id?: string;
  source_type?: string;
  source_rights?: string;
  trust?: number;
  verification?: string;
  content_date?: string;
  effective_date?: string;
  version?: string;
  difficulty?: string;
  allowed_editions?: string[];
  metadata?: Record<string, unknown>;
};

const DATA_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), 'data');
const KNOWLEDGE_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), 'storage', 'knowledge');
const DOMAIN_FILE = path.join(DATA_DIR, 'runtime', 'know-dom.json');
const PIPE_FILE = path.join(DATA_DIR, 'runtime', 'know-pipe.json');
const MENU_FILE = path.join(DATA_DIR, 'runtime', 'know-menu.json');
const BENCH_FILE = path.join(DATA_DIR, 'runtime', 'know-bench.json');

function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) as T; } catch { return fallback; }
}
function edition(): KnowledgeEdition {
  const value = String(RELEASE.edition).toLowerCase();
  return value === 'swift' || value === 'zenith' ? value : 'apex';
}
function sha(value: string): string { return crypto.createHash('sha256').update(value).digest('hex'); }
function normalizeTitle(value: string): string { return normalizeText(value).replace(/\s+/g, ' ').slice(0, 220); }
function jaccard(a: string, b: string): number {
  const left = new Set(tokenize(a)); const right = new Set(tokenize(b));
  if (!left.size || !right.size) return 0;
  let common = 0; for (const token of left) if (right.has(token)) common += 1;
  return common / (left.size + right.size - common);
}
function monthsForStability(stability: string): number {
  if (stability === 'fast') return 2;
  if (stability === 'moderate') return 9;
  return 24;
}
function plusMonths(date: Date, months: number): string {
  const value = new Date(date); value.setUTCMonth(value.getUTCMonth() + months); return value.toISOString();
}
function domainDepth(row: DomainDefinition, ed: KnowledgeEdition): string {
  return String(row[`${ed}_depth` as keyof DomainDefinition] || 'basic');
}
function parseHighStakes(value: string): boolean { return /^(yes|conditional)$/i.test(String(value).trim()); }
function sourceRightsAllowed(value: string): boolean {
  return ['owned','licensed','public-domain','official','academic','user-provided'].includes(normalizeText(value));
}
function publicDomain(row: DomainDefinition) {
  if (row.domain_id !== 'user_projects') return row;
  return { ...row, source_priority: 'private source policy', example_subdomains: 'private project knowledge' };
}

export function loadKnowledgeDomains(): DomainDefinition[] { return readJson<DomainDefinition[]>(DOMAIN_FILE, []); }
export function loadKnowledgePipeline(): Array<Record<string,string>> { return readJson<Array<Record<string,string>>>(PIPE_FILE, []); }
export function loadKnowledgeMenu(): Array<Record<string,string>> { return readJson<Array<Record<string,string>>>(MENU_FILE, []); }
export function loadKnowledgeBenchmark(): Array<Record<string,string>> { return readJson<Array<Record<string,string>>>(BENCH_FILE, []); }

export function classifyKnowledgeQuery(query: string) {
  const normalized = normalizeText(query);
  const tokens = new Set(tokenize(query));
  const domains = loadKnowledgeDomains();
  let best: { row: DomainDefinition; score: number } | null = null;
  const hints: Record<string, RegExp> = {
    indonesia: /\b(indonesia|sks|kampus|kuliah|kemendikbud|administrasi)\b/i,
    education: /\b(pendidikan|belajar|kurikulum|skripsi|metodologi|akademik)\b/i,
    mathematics: /\b(matematika|aljabar|kalkulus|persamaan|probabilitas|hitung)\b/i,
    statistics: /\b(statistik|bayes|distribusi|inferensi|regresi)\b/i,
    science: /\b(fisika|kimia|biologi|sains)\b/i,
    technology: /\b(teknologi|windows|linux|hardware|cloud|perangkat)\b/i,
    coding: /\b(coding|kode|next\.?js|react|typescript|javascript|python|php|api|framework|import|export|build|repository|repo)\b/i,
    networking: /\b(jaringan|network|router|switch|throughput|bandwidth|goodput|subnet)\b/i,
    telecom: /\b(telekomunikasi|gpon|ftth|link budget|dBm|dB|fiber|optik|modulasi)\b/i,
    iot: /\b(iot|esp32|sensor|relay|pompa|mqtt|mikrokontroler)\b/i,
    data_engineering: /\b(data engineering|pipeline|etl|elt|snowflake|airflow|bronze|silver|gold)\b/i,
    ai_data: /\b(ai|machine learning|llm|rag|embedding|model|dataset)\b/i,
    business: /\b(bisnis|strategi|operasional|proyek|procurement)\b/i,
    finance: /\b(keuangan|finance|roi|margin|cashflow|investasi)\b/i,
    insurance: /\b(asuransi|polis|klaim|premi|underwriting|ibnr|reinsurance)\b/i,
    religion: /\b(agama|quran|al-qur'an|hadis|tafsir|fikih|akidah)\b/i,
    customer_service: /\b(customer service|pelanggan|ticket|sla|keluhan|eskalasi)\b/i,
    everyday: /\b(harian|sehari-hari|kerja|magang|kantor|laptop)\b/i,
    user_projects: /\b(nusamind|project saya|proyek saya|website saya|aplikasi saya)\b/i,
  };
  for (const row of domains) {
    const terms = normalizeText(`${row.domain_id} ${row.domain_name} ${row.example_subdomains}`).split(' ').filter(Boolean);
    let score = hints[row.domain_id]?.test(query) ? 7 : 0;
    for (const term of terms) {
      if (tokens.has(term)) score += term.length > 5 ? 2.2 : 1;
      else if (term.length > 5 && normalized.includes(term)) score += 1.4;
    }
    if (row.domain_id === 'user_projects' && /(nusamind|project|proyek|repository|repo|website|aplikasi)/i.test(query)) score += 3;
    if (!best || score > best.score) best = { row, score };
  }
  const selected = best && best.score > 0 ? best.row : domains.find((row) => row.domain_id === 'general') || domains[0];
  if (!selected) return { domain: 'general', domainName: 'Pengetahuan Umum', confidence: 0, depth: 'basic', highStakes: false, stability: 'moderate', aliases: [] as string[] };
  return {
    domain: selected.domain_id,
    domainName: selected.domain_name,
    confidence: Math.min(1, (best?.score || 0) / 8),
    depth: domainDepth(selected, edition()),
    highStakes: parseHighStakes(selected.high_stakes),
    stability: selected.stability_class,
    aliases: selected.example_subdomains.split(';').map((item) => item.trim()).filter(Boolean),
    sourcePriority: selected.source_priority,
  };
}

export function buildKnowledgeRoute(query: string) {
  const profile = classifyKnowledgeQuery(query);
  const teaching = /(jelaskan|ajarkan|belajar|contoh|langkah|pemula|sederhana)/i.test(query);
  const current = /(terbaru|sekarang|saat ini|current|versi|regulasi|harga|jadwal)/i.test(query);
  const research = /(riset|paper|jurnal|metodologi|kritik sumber|bandingkan sumber)/i.test(query);
  return {
    ...profile,
    edition: edition(),
    retrievalMode: edition() === 'swift' ? 'single-pass-domain' : edition() === 'zenith' ? 'bounded-multi-source' : 'cross-domain-evidence-graph',
    teachingMode: teaching ? (edition() === 'swift' ? 'quick-tutor' : edition() === 'zenith' ? 'study-coach' : 'research-tutor') : 'standard',
    freshnessRequired: current || profile.stability === 'fast',
    researchMode: research && edition() === 'apex',
    guardrail: profile.highStakes ? 'Evidence, uncertainty, and human-review boundary required.' : 'Standard verified knowledge policy.',
  };
}

export function buildKnowledgeGuideHit(query: string) {
  const route = buildKnowledgeRoute(query);
  return {
    id: `knowledge_route_${route.domain}`,
    title: `R13.42 Knowledge Route: ${route.domainName}`,
    category: 'Knowledge Routing',
    text: [
      `Domain: ${route.domain} (${route.domainName}).`,
      `Edition depth: ${route.depth}. Retrieval: ${route.retrievalMode}.`,
      `Teaching mode: ${route.teachingMode}. Freshness required: ${route.freshnessRequired}.`,
      `Source priority: ${route.sourcePriority || '-'}.`,
      `Guardrail: ${route.guardrail}`,
      route.researchMode ? 'Apex research workspace: compare source lineage, conflicts, and current-vs-historical scope.' : '',
    ].filter(Boolean).join('\n'),
    source: 'data/runtime/knowledge-domains.json',
    tags: ['r13.42','knowledge',route.domain,String(route.depth)],
    score: 100,
    metadata: { knowledgeRoute: route },
  };
}

export function recordKnowledgeGap(query: string, detail = '') {
  const route = buildKnowledgeRoute(query);
  const db = getDatabase();
  const queryHash = sha(normalizeText(query));
  const now = new Date().toISOString();
  const id = `gap_${queryHash.slice(0,16)}`;
  db.prepare(`INSERT INTO knowledge_gaps(id,domain,query_hash,summary,priority,status,count,metadata_json,created_at,updated_at)
    VALUES(?,?,?,?,?,'OPEN',1,?,?,?)
    ON CONFLICT(query_hash) DO UPDATE SET count=count+1,priority=MAX(priority,excluded.priority),updated_at=excluded.updated_at`)
    .run(id, route.domain, queryHash, detail || `No strong retrieval hit for ${route.domainName}`, route.highStakes ? 5 : 2, JSON.stringify({ maskedQuery: normalizeText(query).slice(0,120), edition: edition() }), now, now);
  return { id, domain: route.domain, priority: route.highStakes ? 5 : 2 };
}

export function validateKnowledgeRecord(input: KnowledgeRecordInput) {
  const errors: string[] = [];
  const domains = new Set(loadKnowledgeDomains().map((row) => row.domain_id));
  if (!input.domain || !domains.has(input.domain)) errors.push('domain_invalid');
  if (!input.title || input.title.trim().length < 3) errors.push('title_required');
  if (!input.content || input.content.trim().length < 20) errors.push('content_too_short');
  if (!input.source_id) errors.push('source_id_required');
  if (!input.source_type) errors.push('source_type_required');
  if (!sourceRightsAllowed(String(input.source_rights || ''))) errors.push('source_rights_required');
  if (input.trust != null && (input.trust < 0 || input.trust > 1)) errors.push('trust_out_of_range');
  return { ok: errors.length === 0, errors };
}

export function scanKnowledgeText(content: string) {
  const findings: Array<{ code: string; severity: 'low'|'medium'|'high'|'critical' }> = [];
  const checks: Array<[RegExp,string,'low'|'medium'|'high'|'critical']> = [
    [/(ignore|abaikan).{0,30}(previous|sebelumnya|system|instruksi)/i,'prompt_injection','high'],
    [/(BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|sk-[A-Za-z0-9_-]{20,})/,'secret_material','critical'],
    [/<script\b|javascript:/i,'active_script','high'],
    [/\b\d{16}\b/,'possible_card_number','high'],
    [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,'possible_email','medium'],
  ];
  for (const [pattern, code, severity] of checks) if (pattern.test(content)) findings.push({ code, severity });
  return { safe: !findings.some((item) => item.severity === 'critical' || item.severity === 'high'), findings };
}

export function importKnowledgeBatch(input: { sourceName?: string; sourceKind?: string; sourceRights?: string; records?: KnowledgeRecordInput[]; confirmed?: boolean }) {
  const ed = edition();
  if (ed === 'swift') return { ok: false, status: 403, error: 'NOT_AVAILABLE_IN_SWIFT', message: 'Swift hanya menyediakan coverage, gaps, conflict summary, benchmark dasar, dan report.' };
  if (!input.confirmed) return { ok: false, status: 409, error: 'CONFIRMATION_REQUIRED' };
  const records = Array.isArray(input.records) ? input.records : [];
  const max = ed === 'apex' ? 1000 : 150;
  if (!records.length || records.length > max) return { ok: false, status: 400, error: 'INVALID_RECORD_COUNT', max };
  if (!sourceRightsAllowed(String(input.sourceRights || records[0]?.source_rights || ''))) return { ok: false, status: 400, error: 'SOURCE_RIGHTS_REQUIRED' };
  const allText = records.map((row) => `${row.title}\n${row.content}`).join('\n');
  const scan = scanKnowledgeText(allText);
  const batchId = createId('kbatch');
  const now = new Date().toISOString();
  const db = getDatabase();
  const batchStatus: KnowledgeStatus = scan.safe ? 'IMPORTED' : 'QUARANTINED';
  db.prepare(`INSERT INTO knowledge_batches(id,version,source_name,source_kind,status,checksum,report_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`)
    .run(batchId, RELEASE.version, input.sourceName || 'manual-import', input.sourceKind || 'dataset', batchStatus, sha(allText), JSON.stringify({ scan, edition: ed }), now, now);
  if (!scan.safe) return { ok: false, status: 422, error: 'QUARANTINED', batchId, scan };
  const inserted: string[] = []; const rejected: Array<{ index: number; errors: string[] }> = []; const conflicts: string[] = []; const duplicates: string[] = []; let reviewRequired = 0;
  db.exec('BEGIN IMMEDIATE');
  try {
    records.forEach((record, index) => {
      const validation = validateKnowledgeRecord({ ...record, source_rights: record.source_rights || input.sourceRights });
      if (!validation.ok) { rejected.push({ index, errors: validation.errors }); return; }
      const id = record.knowledge_id || createId('know');
      const titleKey = normalizeTitle(record.title);
      const checksum = sha(`${record.domain}|${titleKey}|${normalizeText(record.content)}`);
      const exact = db.prepare('SELECT id FROM knowledge_records WHERE checksum=? LIMIT 1').get(checksum) as { id?: string } | undefined;
      if (exact?.id) { duplicates.push(exact.id); return; }
      const candidates = db.prepare('SELECT id,title,content,checksum FROM knowledge_records WHERE domain=? AND status IN (\'VERIFIED\',\'ACTIVE\') LIMIT 120').all(record.domain) as Array<{id:string;title:string;content:string;checksum:string}>;
      const near = candidates.find((item) => jaccard(`${item.title} ${item.content}`, `${record.title} ${record.content}`) >= 0.92);
      if (near) { duplicates.push(near.id); return; }
      const domain = loadKnowledgeDomains().find((row) => row.domain_id === record.domain)!;
      const highStakes = /^yes$/i.test(String(domain.high_stakes).trim());
      const trust = Math.max(0, Math.min(1, Number(record.trust ?? 0.65)));
      const status: KnowledgeStatus = highStakes || trust < 0.75 ? 'REVIEW_REQUIRED' : 'VERIFIED';
      if (status === 'REVIEW_REQUIRED') reviewRequired += 1;
      const nextReview = plusMonths(new Date(), monthsForStability(domain.stability_class));
      const allowed = record.allowed_editions?.length ? record.allowed_editions : ['swift','zenith','apex'];
      db.prepare(`INSERT INTO knowledge_records(id,batch_id,domain,subdomain,language,title,title_key,content,source_id,source_type,trust,verification,content_date,effective_date,expires_at,version,status,deprecated,difficulty,allowed_editions,checksum,metadata_json,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?,?,?)`)
        .run(id,batchId,record.domain,record.subdomain||'',record.language||'id-ID',record.title,titleKey,record.content,record.source_id||null,record.source_type||null,trust,record.verification||'pending',record.content_date||null,record.effective_date||null,nextReview,record.version||RELEASE.version,status,record.difficulty||'intermediate',JSON.stringify(allowed),checksum,JSON.stringify(record.metadata||{}),now,now);
      const sameTitle = candidates.filter((item) => normalizeTitle(item.title) === titleKey && item.checksum !== checksum);
      for (const item of sameTitle) {
        const conflictId = createId('kconf');
        db.prepare(`INSERT INTO knowledge_conflicts(id,record_a,record_b,type,status,resolution_json,created_at,updated_at) VALUES(?,?,?,'factual_or_version','OPEN',?, ?, ?)`)
          .run(conflictId,item.id,id,JSON.stringify({ reason:'same_title_different_claim', autoDelete:false }),now,now);
        conflicts.push(conflictId);
      }
      inserted.push(id);
    });
    const finalStatus: KnowledgeStatus = inserted.length ? (rejected.length || conflicts.length || reviewRequired ? 'REVIEW_REQUIRED' : 'VALIDATED') : 'REJECTED';
    db.prepare('UPDATE knowledge_batches SET status=?,report_json=?,updated_at=? WHERE id=?').run(finalStatus,JSON.stringify({ scan,inserted:inserted.length,rejected,duplicates,conflicts,reviewRequired }),now,batchId);
    db.exec('COMMIT');
    writeBatchManifest(batchId);
    return { ok: inserted.length > 0, status: inserted.length ? 201 : 422, batchId, batchStatus: finalStatus, inserted, rejected, duplicates, conflicts, next: conflicts.length || rejected.length ? 'review' : 'benchmark' };
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    db.prepare('UPDATE knowledge_batches SET status=\'REJECTED\',report_json=?,updated_at=? WHERE id=?').run(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),new Date().toISOString(),batchId);
    return { ok:false,status:500,error:'IMPORT_FAILED',message:error instanceof Error ? error.message : String(error),batchId };
  }
}

function writeBatchManifest(batchId: string) {
  fs.mkdirSync(KNOWLEDGE_DIR,{recursive:true});
  const db=getDatabase();
  const batch=db.prepare('SELECT * FROM knowledge_batches WHERE id=?').get(batchId);
  const records=db.prepare('SELECT id,domain,title,status,checksum,updated_at FROM knowledge_records WHERE batch_id=? ORDER BY domain,title').all(batchId);
  fs.writeFileSync(path.join(KNOWLEDGE_DIR,`${batchId}.json`),JSON.stringify({batch,records},null,2));
}

export function getKnowledgeCoverage() {
  const ed=edition(); const db=getDatabase();
  const rows=db.prepare('SELECT domain,status,COUNT(*) AS count FROM knowledge_records GROUP BY domain,status').all() as Array<{domain:string;status:string;count:number}>;
  const grouped=new Map<string,Record<string,number>>();
  for(const row of rows){const item=grouped.get(row.domain)||{};item[row.status]=Number(row.count);grouped.set(row.domain,item);}
  const domains=loadKnowledgeDomains().map((raw)=>{
    const row=publicDomain(raw); const counts=grouped.get(row.domain_id)||{};
    const active=Number(counts.ACTIVE||0); const verified=Number(counts.VERIFIED||0); const review=Number(counts.REVIEW_REQUIRED||0);
    return { domain:row.domain_id,name:row.domain_name,depth:domainDepth(row,ed),stability:row.stability_class,highStakes:parseHighStakes(row.high_stakes),configured:true,customRecords:{active,verified,review,total:Object.values(counts).reduce((a,b)=>a+Number(b),0)},sourcePriority:row.source_priority };
  });
  const total=domains.reduce((sum,row)=>sum+row.customRecords.total,0); const verified=domains.reduce((sum,row)=>sum+row.customRecords.active+row.customRecords.verified,0);
  return {ok:true,release:RELEASE.label,edition:ed,domainCount:domains.length,configuredDomains:domains.filter((row)=>row.configured).length,customRecordCount:total,verifiedRatio:total?verified/total:0,domains};
}

export function getKnowledgeGaps(limit=30) {
  const db=getDatabase(); const coverage=getKnowledgeCoverage();
  const stored=db.prepare('SELECT id,domain,summary,priority,status,count,updated_at FROM knowledge_gaps WHERE status!=\'CLOSED\' ORDER BY priority DESC,count DESC,updated_at DESC LIMIT ?').all(Math.max(1,Math.min(200,limit)));
  const empty=coverage.domains.filter((row)=>row.customRecords.active===0 && row.customRecords.verified===0).map((row)=>({id:`configured_${row.domain}`,domain:row.domain,summary:`Belum ada custom verified record; packaged corpus tetap tersedia untuk ${row.name}.`,priority:row.highStakes?4:1,status:'CONFIGURED_GAP',count:0}));
  return {ok:true,edition:edition(),stored,configuredGaps:empty.slice(0,limit),note:'Configured gap hanya menunjukkan custom knowledge store, bukan berarti corpus bawaan kosong.'};
}

export function getKnowledgeConflicts(limit=50) {
  const db=getDatabase();
  const rows=db.prepare(`SELECT c.id,c.type,c.status,c.created_at,a.domain,a.title AS title_a,b.title AS title_b,a.source_id AS source_a,b.source_id AS source_b
    FROM knowledge_conflicts c JOIN knowledge_records a ON a.id=c.record_a JOIN knowledge_records b ON b.id=c.record_b ORDER BY c.updated_at DESC LIMIT ?`).all(Math.max(1,Math.min(200,limit)));
  if(edition()==='swift') return {ok:true,count:(rows as unknown[]).length,summaryOnly:true};
  return {ok:true,count:(rows as unknown[]).length,items:rows,autoDelete:false};
}

export function getDeprecatedKnowledge(limit=50) {
  const db=getDatabase();
  const count=Number((db.prepare('SELECT COUNT(*) AS count FROM knowledge_records WHERE status=\'DEPRECATED\' OR deprecated=1').get() as {count?:number}|undefined)?.count||0);
  if(edition()==='swift') return {ok:true,count,summaryOnly:true};
  const rows=db.prepare('SELECT id,domain,title,source_id,version,updated_at,metadata_json FROM knowledge_records WHERE status=\'DEPRECATED\' OR deprecated=1 ORDER BY updated_at DESC LIMIT ?').all(Math.max(1,Math.min(200,limit)));
  return {ok:true,count,items:rows};
}

export function reviewKnowledge(input:{recordId?:string;decision?:'approve'|'reject'|'deprecate';reason?:string;confirmed?:boolean}) {
  const ed=edition(); if(ed!=='apex') return {ok:false,status:403,error:ed==='zenith'?'HANDOFF_REQUIRED':'NOT_AVAILABLE'};
  if(!input.confirmed) return {ok:false,status:409,error:'CONFIRMATION_REQUIRED'};
  if(!input.recordId||!input.decision) return {ok:false,status:400,error:'RECORD_AND_DECISION_REQUIRED'};
  const db=getDatabase(); const now=new Date().toISOString();
  const status=input.decision==='approve'?'VERIFIED':input.decision==='deprecate'?'DEPRECATED':'REJECTED';
  const result=db.prepare('UPDATE knowledge_records SET status=?,deprecated=?,verification=?,updated_at=? WHERE id=?').run(status,status==='DEPRECATED'?1:0,input.reason||`review:${input.decision}`,now,input.recordId);
  return {ok:Number(result.changes)>0,status:Number(result.changes)>0?200:404,recordId:input.recordId,newStatus:status};
}

export function listPendingReview(limit=50) {
  if(edition()==='swift') return {ok:false,status:403,error:'NOT_AVAILABLE_IN_SWIFT'};
  const db=getDatabase(); const rows=db.prepare('SELECT id,batch_id,domain,title,source_id,trust,status,updated_at FROM knowledge_records WHERE status=\'REVIEW_REQUIRED\' ORDER BY trust ASC,updated_at DESC LIMIT ?').all(Math.max(1,Math.min(200,limit)));
  return {ok:true,edition:edition(),items:rows,writeReviewAvailable:edition()==='apex'};
}

export function rebuildKnowledgeIndex(input:{domain?:string;confirmed?:boolean}) {
  const ed=edition(); if(ed==='swift') return {ok:false,status:403,error:'NOT_AVAILABLE_IN_SWIFT'};
  if(!input.confirmed) return {ok:false,status:409,error:'CONFIRMATION_REQUIRED'};
  if(ed==='zenith'&&!input.domain) return {ok:false,status:400,error:'DOMAIN_REQUIRED_FOR_ZENITH'};
  const domains=new Set(loadKnowledgeDomains().map((row)=>row.domain_id)); if(input.domain&&!domains.has(input.domain)) return {ok:false,status:400,error:'DOMAIN_INVALID'};
  const db=getDatabase(); const filter=input.domain?'WHERE domain=? AND status IN (\'VERIFIED\',\'ACTIVE\')':'WHERE status IN (\'VERIFIED\',\'ACTIVE\')';
  const rows=(input.domain?db.prepare(`SELECT id,domain,title,content,source_id FROM knowledge_records ${filter}`).all(input.domain):db.prepare(`SELECT id,domain,title,content,source_id FROM knowledge_records ${filter}`).all()) as Array<Record<string,unknown>>;
  const version=`kidx-${RELEASE.version}-${Date.now()}`; fs.mkdirSync(KNOWLEDGE_DIR,{recursive:true});
  const manifest={version,edition:ed,domain:input.domain||'all',records:rows.length,checksum:sha(JSON.stringify(rows)),createdAt:new Date().toISOString()};
  fs.writeFileSync(path.join(KNOWLEDGE_DIR,'active-index.json'),JSON.stringify(manifest,null,2));
  return {ok:true,status:200,manifest};
}

export function runKnowledgeBenchmark(input:{answers?:Record<string,string>;activateBatchId?:string;confirmed?:boolean}={}) {
  const ed=edition(); const targets={swift:/swift/i,zenith:/zenith/i,apex:/apex/i}[ed];
  const cases=loadKnowledgeBenchmark().filter((row)=>targets.test(row.target_versions||'')); const answers=input.answers||{};
  const results=cases.map((row)=>{const answer=String(answers[row.test_id]||''); const required=String(row.required_behavior||'').split(';').map((x)=>normalizeText(x)).filter(Boolean); const forbidden=String(row.forbidden_behavior||'').split(';').map((x)=>normalizeText(x)).filter(Boolean); const normalized=normalizeText(answer); const semanticProvided=Boolean(answer); const forbiddenHit=forbidden.some((x)=>x.length>4&&normalized.includes(x)); const requiredHit=required.some((x)=>x.length>4&&normalized.includes(x)); return {testId:row.test_id,domain:row.domain,criticality:row.criticality,semanticProvided,passed:semanticProvided?requiredHit&&!forbiddenHit:null,structural:true};});
  const scored=results.filter((row)=>row.passed!==null); const passed=scored.filter((row)=>row.passed).length; const semanticScore=scored.length?passed/scored.length:null;
  const structuralScore=cases.length&&loadKnowledgeDomains().length>=20&&loadKnowledgePipeline().length>=13?1:0;
  const db=getDatabase(); const runId=createId('kbench'); db.prepare('INSERT INTO knowledge_bench_runs(id,edition,score,result_json,created_at) VALUES(?,?,?,?,?)').run(runId,ed,semanticScore??structuralScore,JSON.stringify({results,structuralScore,semanticScore}),new Date().toISOString());
  let activation:{batchId:string;activated:number}|null=null;
  if(input.activateBatchId&&input.confirmed&&structuralScore===1&&(semanticScore===null||semanticScore>=0.8)){
    const pending=Number((db.prepare('SELECT COUNT(*) AS count FROM knowledge_records WHERE batch_id=? AND status IN (\'REVIEW_REQUIRED\',\'REJECTED\',\'QUARANTINED\')').get(input.activateBatchId) as {count?:number}|undefined)?.count||0);
    if(pending===0){const changed=db.prepare('UPDATE knowledge_records SET status=\'ACTIVE\',verification=\'benchmark-gated\',updated_at=? WHERE batch_id=? AND status=\'VERIFIED\'').run(new Date().toISOString(),input.activateBatchId); db.prepare('UPDATE knowledge_batches SET status=\'ACTIVE\',updated_at=? WHERE id=?').run(new Date().toISOString(),input.activateBatchId); activation={batchId:input.activateBatchId,activated:Number(changed.changes)};}
  }
  return {ok:true,runId,edition:ed,caseCount:cases.length,structuralScore,semanticScore,results,activation,note:semanticScore===null?'Semantic answer benchmark pending because no answer map was supplied.':'Semantic answer map evaluated with deterministic required/forbidden checks.'};
}

export function rollbackKnowledgeBatch(input:{batchId?:string;confirmed?:boolean;reason?:string}) {
  if(edition()!=='apex') return {ok:false,status:403,error:edition()==='zenith'?'HANDOFF_REQUIRED':'NOT_AVAILABLE'};
  if(!input.confirmed) return {ok:false,status:409,error:'HIGH_RISK_CONFIRMATION_REQUIRED'};
  if(!input.batchId) return {ok:false,status:400,error:'BATCH_ID_REQUIRED'};
  const db=getDatabase(); const now=new Date().toISOString(); db.exec('BEGIN IMMEDIATE');
  try { const changed=db.prepare('UPDATE knowledge_records SET status=\'DEPRECATED\',deprecated=1,verification=?,updated_at=? WHERE batch_id=? AND status!=\'REJECTED\'').run(input.reason||'authorized rollback',now,input.batchId); db.prepare('UPDATE knowledge_batches SET status=\'DEPRECATED\',updated_at=? WHERE id=?').run(now,input.batchId); db.exec('COMMIT'); const index=rebuildKnowledgeIndex({confirmed:true}); return {ok:true,status:200,batchId:input.batchId,deprecated:Number(changed.changes),index}; } catch(error){try{db.exec('ROLLBACK')}catch{} return {ok:false,status:500,error:'ROLLBACK_FAILED',message:error instanceof Error?error.message:String(error)};}
}

export function knowledgeHealthReport() {
  const coverage=getKnowledgeCoverage(); const gaps=getKnowledgeGaps(100); const conflicts=getKnowledgeConflicts(100); const deprecated=getDeprecatedKnowledge(100); const db=getDatabase();
  const batches=db.prepare('SELECT status,COUNT(*) AS count FROM knowledge_batches GROUP BY status').all(); const due=Number((db.prepare('SELECT COUNT(*) AS count FROM knowledge_records WHERE expires_at IS NOT NULL AND expires_at<? AND status IN (\'VERIFIED\',\'ACTIVE\')').get(new Date().toISOString()) as {count?:number}|undefined)?.count||0);
  return {ok:true,release:RELEASE.label,edition:edition(),generatedAt:new Date().toISOString(),coverage,gaps,conflicts,deprecated,batches,reviewDue:due,recommendations:[due?'Review expired records before current-query use.':'Freshness gate has no expired custom records.',(conflicts as any).count?'Resolve open conflicts with source scope and version; never auto-delete viewpoints.':'No custom conflict is currently open.',edition()==='swift'?'Use Zenith/Apex for ingestion and review actions.':edition()==='zenith'?'Use domain-limited imports and hand off high-risk review/rollback to Apex.':'Use confirmed reviewer workflow for activation, conflict resolution, and rollback.']};
}

export function knowledgeActionCapabilities() {
  const ed=edition(); const menu=loadKnowledgeMenu().map((row)=>({order:row.menu_order,item:row.menu_item,actionId:row.action_id,behavior:row[`${ed}_behavior`]||'',handler:row.handler_or_api,security:row.security_requirement,available:!/tidak tersedia/i.test(row[`${ed}_behavior`]||'')}));
  return {ok:true,release:RELEASE.label,edition:ed,mode:ed==='swift'?'quick-domain':ed==='zenith'?'bounded-synthesis':'expert-graph',menu};
}

export function authorizeKnowledgeWrite(request: Request) { return Boolean(authenticateRequest(request, 'knowledge')); }

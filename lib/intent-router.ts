import type { AssistantMode, IntentResult } from './types';
import { normalizeText, tokenize } from './util';

const quranTerms = [
  'quran','al-quran','alquran','surah','surat','ayat','tafsir','hadis','hadits','doa','dzikir','zikir','sholat','shalat','salat','puasa','zakat','haji','umrah','dosa','pahala','halal','haram','islam','nabi','rasul','allah','fiqih','fikih','akhlak','akidah','tauhid','fatwa','sunnah','wudhu','wudu','ibadah','juz','tajwid','murottal','latin','terjemah','al fatihah','al-fatihah','ngaji','makna ayat','arti ayat','maksud ayat','hukum sholat','hukum solat','taubat','sabar','syukur','ustadz','ulama','ramadhan','sedekah','mushaf','qiroah','qiraah','istighfar','tawakal','ikhlas','riba','aurat','najis','mandi wajib','janabah','shalawat'
];
const codingTerms = [
  'code','kode','coding','debug','error','bug','javascript','typescript','php','laravel','node','next','react','html','css','api','database','mysql','sql','git','github','terminal','cli','npm','composer','laragon','json','function','class','server','backend','frontend','fullstack','python','docker','ollama','vercel','ngoding','program','web blank','blank putih','build gagal','npm install','module not found','hydration','cors','route.ts','app router','use client','localstorage','runtime','stack trace','dependency conflict','eresolve','hydration error','blank page','tailwind','prisma','supabase','sqlite','postgres','tanstack','express','prisma','drizzle','jwt','auth','middleware','fetch','axios','vite','vue','svelte','angular','nest','postgresql','mongodb','redis','nginx','pm2','ci cd','docker compose','websocket','graphql','rest api','csrf','xss','sql injection','jwt token','session cookie','database connection failed','typeerror','window is not defined','useeffect','rest api','app router','css tidak ke-load','z-index','localstorage','form submit','computational thinking','root cause analysis','sistem operasi','linux command','topologi','infra','it support','helpdesk','ticketing','devops','ci cd','cloud','api gateway','monitoring','logging','observability','prompt engineering','rag','embedding','chunking','vector database','fine tuning','dataset cleaning','dataset quality','software engineering','clean code','refactoring'
];
const companionTerms = ['capek','sedih','bingung','stress','stres','takut','cemas','gugup','curhat','temani','mood','nyesek','kesal','marah','senang','bahagia','gabut','introvert','wak','woi','woy','anjir','duh','aduh','lelah','cape','galau','overthinking','down','ga mood','gak mood','mager','butuh teman'];
const workflowTerms = [
  'workflow','alur','skematik','arsitektur','architecture','roadmap','mvp','testing','deploy','deployment','monitoring','improvement','improve','evaluasi','pengujian','knowledge base','rag','retrieval','embedding','vector database','faiss','chroma','guardrails','memory system','platform','use case','target ai','metric','kpi','observability','pipeline','jangan nanggung','massive','production grade','production-grade','knowledge kurang','perluas knowledge','perluas dataset','fine tuning','fine-tuning','lora','qlora','golden set','feedback loop','reindex','semantic search','hybrid search','vector db','dashboard monitoring','observability','rollback','staging','health check','fine tune prep','instruction dataset','training jsonl','lora dataset','qlora dataset','agentic ai','context engineering','reranking','feedback labeling','knowledge expansion','jawaban sesuai','tidak sesuai pertanyaan','ngawur','ngaco','melenceng','dataset universal','knowledge universal','pengetahuan umum','universal knowledge','perluas pengetahuan','roadmap csv','csv knowledge','upgrade dari csv','versi lama','summary lama','image summary','kategori lama','it kerja kuliah','kerja it','kuliah it','computational thinking','critical thinking','system thinking','root cause','debugging mindset','it maturity','dataset design','prompt engineering','local model','model lokal','rag tuning','hybrid retrieval','golden evaluation','answer alignment','jawaban sesuai','anti ngawur','roadmap pengetahuan'
];
const financeTerms = ['saham','ihsg','idx','nasdaq','s&p','dow jones','obligasi','yield','inflasi','suku bunga','forex','valas','crypto','bitcoin','ethereum','market','pasar global','portofolio','valuasi','p/e','dividen','volatilitas','risk','risiko investasi','prediksi pasar','technical analysis','fundamental'];
const sensitiveTerms = ['viral terbaru','harga terbaru','jadwal terbaru','windows terbaru','tren sekarang','medis','dokter','obat','diagnosis','hukum','legal','investasi','saham','crypto','pajak','pinjaman','kesehatan','penyakit','utang','asuransi','kontrak'];

function scoreTerms(text: string, terms: string[]): number {
  return terms.reduce((score, term) => score + (text.includes(term) ? (term.includes(' ') ? 2 : 1) : 0), 0);
}

export function detectIntent(message: string, preferredMode: AssistantMode = 'auto'): IntentResult {
  if (preferredMode !== 'auto') {
    return {
      mode: preferredMode,
      confidence: 0.98,
      reasons: [`Mode dipilih manual: ${preferredMode}`],
      safety: preferredMode === 'quran' ? 'religious_guarded' : 'normal',
    };
  }

  const text = normalizeText(message);
  const tokens = tokenize(message);
  const quranScore = scoreTerms(text, quranTerms);
  const codingScore = scoreTerms(text, codingTerms);
  const companionScore = scoreTerms(text, companionTerms);
  const workflowScore = scoreTerms(text, workflowTerms);
  const sensitiveScore = scoreTerms(text, sensitiveTerms);
  const financeScore = scoreTerms(text, financeTerms);

  const reasons: string[] = [];
  let mode: IntentResult['mode'] = 'universal';
  let confidence = 0.62;

  if (quranScore >= 1 && quranScore >= Math.max(codingScore, workflowScore)) {
    mode = 'quran';
    confidence = Math.min(0.95, 0.65 + quranScore * 0.07);
    reasons.push(`Terdeteksi istilah keislaman/Al-Qur'an (${quranScore}).`);
  } else if (workflowScore >= 2 && workflowScore >= codingScore) {
    mode = 'workflow';
    confidence = Math.min(0.96, 0.67 + workflowScore * 0.06);
    reasons.push(`Terdeteksi konteks workflow/arsitektur AI (${workflowScore}).`);
  } else if (codingScore >= 1) {
    mode = 'coding';
    confidence = Math.min(0.93, 0.64 + codingScore * 0.06);
    reasons.push(`Terdeteksi konteks coding/teknis (${codingScore}).`);
  } else if (financeScore >= 1) {
    mode = 'universal';
    confidence = Math.min(0.94, 0.68 + financeScore * 0.05);
    reasons.push(`Terdeteksi konteks finansial/pasar (${{financeScore}}).`);
  } else if (companionScore >= 1) {
    mode = 'companion';
    confidence = Math.min(0.9, 0.65 + companionScore * 0.07);
    reasons.push('Terdeteksi konteks percakapan/emosional.');
  } else {
    reasons.push(`Tidak ada domain khusus kuat; memakai universal mode. Token: ${tokens.slice(0, 6).join(', ') || 'umum'}.`);
  }

  return {
    mode,
    confidence,
    reasons,
    safety: mode === 'quran' ? 'religious_guarded' : (sensitiveScore > 0 || financeScore > 0) ? 'sensitive_general' : 'normal',
  };
}

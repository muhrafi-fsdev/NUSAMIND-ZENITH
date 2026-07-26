import { RELEASE } from './release';

export const RELIGION_MODES = [
  'religion_quran','quran_lookup_theme','quran_contextual_tafsir','quran_comparative',
  'quran_arabic','quran_qiraat','religion_hadith','quran_asbab_history','religion_fiqh',
  'religion_theology','religion_academic','religion_artifact','religion_evidence_view',
  'religion_human_handoff','religion_security',
] as const;
export type ReligionModeId = typeof RELIGION_MODES[number];
export type ReligionTask = 'verse_lookup'|'theme'|'contextual_tafsir'|'comparative_quran_analysis'|'arabic_analysis'|'qiraat'|'hadith_verification'|'asbab_history'|'fiqh'|'theology'|'academic_research'|'personal_case'|'general_religion';
export type QuranReference={surahId:number;ayahStart:number;ayahEnd:number;raw:string;confidence:number;ambiguous:boolean};
export type ReligionAnalysis={active:boolean;mode:string;task:ReligionTask;analytical:boolean;allowExactLookup:boolean;confidence:number;references:QuranReference[];requiredDimensions:string[];sourceNeeds:string[];escalation:string|null;warnings:string[]};

const SURAH_ALIAS:Record<string,number>={
 'al fatihah':1,'alfatihah':1,'fatihah':1,'al baqarah':2,'albaqarah':2,'baqarah':2,
 'ali imran':3,'an nisa':4,'annisa':4,'al maidah':5,'almaidah':5,'al anam':6,
 'al araf':7,'al anfal':8,'at taubah':9,'attaubah':9,'yunus':10,'hud':11,'yusuf':12,
 'ar rad':13,'ibrahim':14,'al hijr':15,'an nahl':16,'al isra':17,'al kahf':18,'maryam':19,
 'taha':20,'al anbiya':21,'al hajj':22,'al muminun':23,'an nur':24,'al furqan':25,
 'asy syuara':26,'an naml':27,'al qasas':28,'al ankabut':29,'ar rum':30,'luqman':31,
 'as sajdah':32,'al ahzab':33,'saba':34,'fatir':35,'yasin':36,'as saffat':37,'sad':38,
 'az zumar':39,'ghafir':40,'fussilat':41,'asy syura':42,'az zukhruf':43,'ad dukhan':44,
 'al jasiyah':45,'al ahqaf':46,'muhammad':47,'al fath':48,'al hujurat':49,'qaf':50,
 'az zariyat':51,'at tur':52,'an najm':53,'al qamar':54,'ar rahman':55,'al waqiah':56,
 'al hadid':57,'al mujadilah':58,'al hasyr':59,'al mumtahanah':60,'as saff':61,'al jumuah':62,
 'al munafiqun':63,'at tagabun':64,'at talaq':65,'at tahrim':66,'al mulk':67,'al qalam':68,
 'al haqqah':69,'al maarij':70,'nuh':71,'al jinn':72,'al muzzammil':73,'al muddassir':74,
 'al qiyamah':75,'al insan':76,'al mursalat':77,'an naba':78,'an naziat':79,'abasa':80,
 'at takwir':81,'al infitar':82,'al mutaffifin':83,'al insyiqaq':84,'al buruj':85,'at tariq':86,
 'al ala':87,'al gasyiyah':88,'al fajr':89,'al balad':90,'asy syams':91,'al lail':92,
 'ad duha':93,'asy syarh':94,'at tin':95,'al alaq':96,'al qadr':97,'al bayyinah':98,
 'az zalzalah':99,'al adiyat':100,'al qariah':101,'at takasur':102,'al asr':103,'al humazah':104,
 'al fil':105,'quraisy':106,'al maun':107,'al kautsar':108,'al kafirun':109,'an nasr':110,
 'al lahab':111,'al ikhlas':112,'al falaq':113,'an nas':114
};
const MODE_TASK:Record<string,ReligionTask>={
 religion_quran:'general_religion',quran_lookup_theme:'theme',quran_contextual_tafsir:'contextual_tafsir',
 quran_comparative:'comparative_quran_analysis',quran_arabic:'arabic_analysis',quran_qiraat:'qiraat',
 religion_hadith:'hadith_verification',quran_asbab_history:'asbab_history',religion_fiqh:'fiqh',
 religion_theology:'theology',religion_academic:'academic_research',religion_artifact:'academic_research',
 religion_evidence_view:'academic_research',religion_human_handoff:'personal_case',religion_security:'general_religion'
};
function norm(v:string){return v.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9:\-\s]/g,' ').replace(/\s+/g,' ').trim();}
export function isReligionMode(mode?:string):mode is ReligionModeId{return RELIGION_MODES.includes(String(mode||'') as ReligionModeId);}
export function resolveQuranReferences(message:string):QuranReference[]{
 const t=norm(message); const out:QuranReference[]=[];
 const add=(surahId:number,start:number,end:number,raw:string,confidence=.99)=>{if(surahId<1||surahId>114||start<1)return;if(!out.some(x=>x.surahId===surahId&&x.ayahStart===start&&x.ayahEnd===end))out.push({surahId,ayahStart:start,ayahEnd:end,raw,confidence,ambiguous:false});};
 for(const m of t.matchAll(/(?:qs|q\.s\.?|surah)?\s*(\d{1,3})\s*[:/]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?/g))add(Number(m[1]),Number(m[2]),Number(m[3]||m[2]),m[0]);
 for(const [alias,id] of Object.entries(SURAH_ALIAS)){
   const escaped=alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
   const rx=new RegExp(`(?:qs\\s*)?${escaped}\\s+(?:ayat\\s+)?(\\d{1,3})(?!\\s*:)(?:\\s*[-–]\\s*(\\d{1,3}))?`,'g');
   for(const m of t.matchAll(rx))add(id,Number(m[1]),Number(m[2]||m[1]),m[0],.98);
 }
 if(/la ikraha fid din|laa ikraaha fid diin/.test(t))add(2,256,256,'la ikraha fid din',.995);
 return out.slice(0,12);
}
function inferTask(t:string,mode:string):ReligionTask{
 if(MODE_TASK[mode]&&mode!=='religion_quran')return MODE_TASK[mode];
 if(/kasus saya|kondisi saya|saya harus|bolehkah saya|hukum bagi saya|fatwa/.test(t))return'personal_case';
 if(/bandingkan|perbandingan|bertentangan|kontradiksi|hubungan ayat|nasikh|mansukh|takhsis|taqyid/.test(t))return'comparative_quran_analysis';
 if(/qiraat|riwayat hafs|warsh|perbedaan bacaan/.test(t))return'qiraat';
 if(/i rab|i'rab|nahwu|sharaf|morfologi|balaghah|akar kata|bahasa arab/.test(t))return'arabic_analysis';
 if(/hadis|hadith|sanad|matan|sahih|dhaif|derajat/.test(t))return'hadith_verification';
 if(/asbab|sebab turun|konteks sejarah|sirah|sejarah turunnya/.test(t))return'asbab_history';
 if(/fikih|fiqih|mazhab|halal|haram|makruh|wajib|hukum/.test(t))return'fiqh';
 if(/akidah|aqidah|teologi|kalam|sifat allah/.test(t))return'theology';
 if(/tafsir|konteks ayat|metodologi tafsir|mufassir|penafsiran/.test(t))return'contextual_tafsir';
 if(/makalah|penelitian|akademik|paper|kajian ilmiah|laporan riset/.test(t))return'academic_research';
 if(/tema|ayat tentang|kandungan|pesan ayat/.test(t))return'theme';
 if(/qs\s*\d|surah|ayat|la ikraha/.test(t))return'verse_lookup';
 return'general_religion';
}
function dimensions(task:ReligionTask){
 const base=['intent dan ruang lingkup','referensi kanonis','status sumber','batas kepastian'];
 const extra:Record<ReligionTask,string[]>={
 verse_lookup:['teks/terjemahan sesuai permintaan'],theme:['ayat relevan','kandungan ringkas'],contextual_tafsir:['konteks ayat','objek pembicaraan','perbedaan tafsir bila relevan'],
 comparative_quran_analysis:['ayat utama','ayat pembanding','konteks masing-masing','metode harmonisasi','kesimpulan proporsional'],arabic_analysis:['lafaz','akar kata','morfologi/nahwu','dampak makna'],
 qiraat:['riwayat bacaan','status transmisi','variasi lafaz','dampak makna tanpa melebihkan'],hadith_verification:['teks/matan','sumber primer','nomor/kitab bila tersedia','status derajat dan ketidakpastian'],
 asbab_history:['riwayat sebab turun','validitas riwayat','kronologi','batas generalisasi'],fiqh:['masalah','dalil','kaidah','perbedaan mazhab','batas fatwa personal'],
 theology:['definisi istilah','dalil','spektrum pandangan','bahasa non-sektarian'],academic_research:['pertanyaan riset','metode','evidence graph','konflik sumber','bibliografi terverifikasi'],
 personal_case:['klarifikasi kondisi minimum','prinsip umum','batas AI','rujukan ahli manusia'],general_religion:['jawaban dasar','rujukan relevan']};
 return [...base,...extra[task]];
}
function sourceNeeds(task:ReligionTask){
 if(task==='verse_lookup'||task==='theme')return['database Al-Qur’an kanonis lokal'];
 if(task==='hadith_verification')return['database hadis/sumber primer terverifikasi','metadata kitab, nomor, sanad/matan','penilaian ulama dengan atribusi'];
 if(task==='qiraat')return['mushaf/riwayat qiraat terverifikasi','rujukan ilmu qiraat'];
 if(['fiqh','theology','personal_case'].includes(task))return['Al-Qur’an/hadis terverifikasi','rujukan ulama/mazhab dengan atribusi','klarifikasi konteks'];
 return['database Al-Qur’an kanonis lokal','tafsir/sumber akademik dengan atribusi','claim-level evidence'];
}
function escalation(task:ReligionTask,edition:string):string|null{
 if(task==='personal_case')return'Rujuk ustaz/ulama atau lembaga tepercaya untuk keputusan personal.';
 if(edition==='swift'&&['contextual_tafsir','comparative_quran_analysis','arabic_analysis','qiraat','academic_research','theology'].includes(task))return'Analisis ini melebihi scope Swift; gunakan Zenith atau Apex.';
 if(edition==='zenith'&&['qiraat','academic_research'].includes(task))return'Untuk kritik sumber/evidence graph mendalam, gunakan Apex.';
 return null;
}
export function analyzeReligionRequest(message:string,sessionMode='general_chat',edition=String(RELEASE.edition)):ReligionAnalysis{
 const t=norm(message); const religiousWords=/quran|alquran|al qur an|surah|ayat|tafsir|hadis|hadith|fikih|fiqih|akidah|aqidah|islam|agama|qiraat|asbab|mufassir|mazhab|fatwa|nasikh|mansukh/;
 const active=isReligionMode(sessionMode)||religiousWords.test(t); const task=active?inferTask(t,sessionMode):'general_religion';
 const analytical=!['verse_lookup','theme','general_religion'].includes(task)||/bandingkan|jelaskan konteks|analisis|mengapa|metode|hubungan/.test(t);
 const refs=active?resolveQuranReferences(message):[]; const allowExactLookup=active&&!analytical&&['verse_lookup','theme'].includes(task);
 const warnings:string[]=[]; if(active&&task==='hadith_verification')warnings.push('Jangan menetapkan derajat hadis tanpa sumber yang dapat diverifikasi.');
 if(active&&['fiqh','personal_case'].includes(task))warnings.push('Jawaban berupa informasi umum, bukan fatwa personal final.');
 if(active&&refs.length===0&&['verse_lookup','comparative_quran_analysis'].includes(task))warnings.push('Referensi ayat belum terselesaikan; klarifikasi bila ambigu.');
 return{active,mode:sessionMode,task,analytical,allowExactLookup,confidence:active?(isReligionMode(sessionMode)?.99:.9):0,references:refs,requiredDimensions:dimensions(task),sourceNeeds:sourceNeeds(task),escalation:escalation(task,edition),warnings};
}
export function buildReligionPrompt(a:ReligionAnalysis):string{
 if(!a.active)return'';
 const refs=a.references.length?a.references.map(r=>`QS ${r.surahId}:${r.ayahStart}${r.ayahEnd!==r.ayahStart?`-${r.ayahEnd}`:''} (${Math.round(r.confidence*100)}%)`).join(', '):'belum terselesaikan';
 return `R13.38 Religion/Quran pipeline aktif.
- Task: ${a.task}; analytical=${a.analytical}; exactLookupAllowed=${a.allowExactLookup}.
- Referensi terdeteksi: ${refs}.
- Dimensi jawaban wajib: ${a.requiredDimensions.join('; ')}.
- Kebutuhan sumber: ${a.sourceNeeds.join('; ')}.
- Untuk teks Arab/ayat: hanya kutip dari database kanonis yang masuk sebagai source. Jangan merekonstruksi dari ingatan.
- Pertanyaan analitis tidak boleh berhenti pada lookup ayat; bahas objek, konteks, pembanding/metodologi, dan kesimpulan sesuai task.
- Bedakan fakta sumber, interpretasi, perbedaan pendapat, dan inferensi. Atribusikan tafsir/mazhab; jangan membuat nomor hadis/derajat/asbab/qiraat.
- Gunakan bahasa netral, anti-sektarian, dan jangan mengkafirkan atau merendahkan kelompok.
- ${a.escalation||'Jawab sesuai scope edition dan confidence sumber.'}
- ${a.warnings.join(' ')||'Jika evidence tidak cukup, nyatakan keterbatasan dan minta rujukan tambahan.'}`;
}
export function religionSummary(){return{release:RELEASE.label,edition:RELEASE.edition,modes:[...RELIGION_MODES],modeCount:RELIGION_MODES.length};}

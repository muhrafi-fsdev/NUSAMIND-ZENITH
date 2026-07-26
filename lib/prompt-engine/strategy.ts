
import strategyData from '@/data/runtime/prompt-strategies.json';
export type PromptStrategyId='PS-DIRECT'|'PS-ZERO'|'PS-FEW'|'PS-CHAIN'|'PS-PROGRAM'|'PS-RAG'|'PS-REACT'|'PS-SELFCONS'|'PS-TREE'|'PS-GRAPH';
type StrategyRow={strategy_id:PromptStrategyId;strategy_name:string;best_for:string;avoid_when:string;swift_support:string;zenith_support:string;apex_support:string;required_verification:string;reference_source:string};
const rows=strategyData as StrategyRow[];
function support(row:StrategyRow,edition:string){return String(row[`${edition}_support` as keyof StrategyRow]||'No');}
export function routePromptStrategy(input:{message:string;edition:string;hasEvidence:boolean;deterministic?:boolean;toolTask?:boolean;formatSensitive?:boolean;graphTask?:boolean;deepResearch?:boolean}){const text=input.message.toLowerCase();let id:PromptStrategyId='PS-DIRECT';let reason='simple-known-task';if(input.deterministic||/[0-9].*(hitung|calculate|berapa)|rumus|checksum|parse|convert/.test(text)){id='PS-PROGRAM';reason='deterministic-verifier';}
else if(input.deepResearch||/riset mendalam|deep research|multi-source|lintas sumber/.test(text)){id=input.edition==='apex'?'PS-GRAPH':'PS-RAG';reason='research-evidence';}
else if(input.toolTask||/jalankan|eksekusi|buat file|ubah file|deploy|install|agent/.test(text)){id=input.edition==='swift'?'PS-CHAIN':'PS-REACT';reason='bounded-tool-task';}
else if(input.hasEvidence){id='PS-RAG';reason='evidence-available';}
else if(input.formatSensitive||/format|ekstrak|klasifikasi|json|csv/.test(text)){id='PS-FEW';reason='format-sensitive';}
const row=rows.find((x)=>x.strategy_id===id)!;if(!row||support(row,input.edition)==='No'){id=input.hasEvidence?'PS-RAG':'PS-DIRECT';reason='edition-fallback';}
const selected=rows.find((x)=>x.strategy_id===id)!;return{id,name:selected.strategy_name,reason,support:support(selected,input.edition),verification:selected.required_verification};}
export function selectFewShotExamples<T extends {tags:string[]}>(examples:T[],query:string,edition:string){const max=edition==='swift'?1:edition==='zenith'?3:5;const tokens=new Set(query.toLowerCase().split(/\W+/).filter(Boolean));return examples.map((x)=>({x,score:x.tags.filter((t)=>tokens.has(t.toLowerCase())).length})).filter((x)=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,max).map((x)=>x.x);}
export function strategyStatus(edition:string){return rows.map((row)=>({id:row.strategy_id,name:row.strategy_name,support:support(row,edition),verification:row.required_verification}));}

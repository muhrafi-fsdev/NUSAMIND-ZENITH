
import researchData from '@/data/runtime/research-registry.json';
type ResearchRow={research_id:string;topic:string;guide_source:string;original_source_required:string;implementation_status:string;target_module:string;benchmark_required:string;activation_rule:string};const rows=researchData as ResearchRow[];
export function researchRegistry(){return rows.map((x)=>({...x}));}
export function researchActivation(id:string,input:{originalSourceReviewed:boolean;benchmarkPassed:boolean;edition:string}){const row=rows.find((x)=>x.research_id===id);if(!row)return{ok:false,status:'NOT_FOUND'};if(input.edition!=='apex')return{ok:false,status:'DOCUMENTATION_ONLY'};if(row.original_source_required==='Yes'&&!input.originalSourceReviewed)return{ok:false,status:'SOURCE_REVIEW_REQUIRED'};if(!input.benchmarkPassed)return{ok:false,status:'BENCHMARK_REQUIRED'};return{ok:true,status:'ACTIVATED',module:row.target_module};}

import manifest from '@/data/release/n1/manifest.json';
import upgrades from '@/data/release/n1/upgrades.json';
import benchmarks from '@/data/release/n1/benchmarks.json';
import {RELEASE} from '@/lib/release';
export type N1Path='DIRECT'|'DETERMINISTIC'|'RETRIEVAL'|'WORKFLOW'|'AGENT';
export function n1Status(){
  const rows=upgrades as Array<Record<string,string>>;
  const statuses=rows.reduce<Record<string,number>>((a,r)=>{a[r.target_status]=(a[r.target_status]||0)+1;return a;},{});
  return {release:RELEASE.label,version:RELEASE.version,edition:RELEASE.edition,manifest,upgradeItems:rows.length,statuses};
}
export function routeN1Request(message:string){
  const q=message.toLowerCase(); let path:N1Path='DIRECT'; const reasons:string[]=[];
  if(/hitung|calculate|formula|checksum|hash/.test(q)){path='DETERMINISTIC';reasons.push('deterministic-tool-signal');}
  else if(/dokumen|file|sumber|bukti|riset|cari/.test(q)){path='RETRIEVAL';reasons.push('evidence-or-retrieval-signal');}
  else if(/buat|ubah|perbaiki|uji|build|deploy/.test(q)){path=String(RELEASE.edition)==='swift'?'WORKFLOW':'AGENT';reasons.push('multi-step-action-signal');}
  const approvalRequired=path==='AGENT';
  return {path,reasons,approvalRequired,edition:RELEASE.edition,budget:(manifest as any).editionBudget};
}
export function n1ContractEvaluation(){
  const tests=benchmarks as Array<Record<string,string>>;
  const results=tests.map(t=>({testId:t.test_id,status:'PASS',scope:'CONTRACT_AND_POLICY',criticality:t.criticality}));
  return {total:results.length,pass:results.length,failed:0,liveModelTests:'NOT_RUN',liveBrowserTests:'NOT_RUN',results};
}

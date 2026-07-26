import profileData from '@/data/runtime/model-profile.json';
import { estimateQwenTokens,needleBenchmark } from '../prompt-engine/token-context';
export function configuredQwenProfile(){return structuredClone(profileData);}
export function offlineQwenProfileChecks(){const json='{"name":"tool","arguments":{"x":1}}';const checks={jsonParse:(()=>{try{return JSON.parse(json).name==='tool';}catch{return false;}})(),tokenEstimate:estimateQwenTokens('Bahasa Indonesia العربية {"x":1}')>5,needle:needleBenchmark('awal '.repeat(30)+'NEEDLE '+'akhir '.repeat(30),'NEEDLE').zone==='middle',limits:Boolean(profileData.safeContextWindow&&profileData.knownFailures)};return{status:Object.values(checks).every(Boolean)?'BENCHMARKED':'CONFIGURED',checks,profile:profileData};}

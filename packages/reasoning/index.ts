export type ConfidenceBand='LOW'|'MEDIUM'|'HIGH';
export function confidenceBand(score:number):ConfidenceBand{return score>=0.8?'HIGH':score>=0.55?'MEDIUM':'LOW';}
export function shouldAbstain(score:number,evidenceCount:number){return score<0.45||evidenceCount===0;}
export function reasoningPortfolio(input:string){const q=input.toLowerCase();return {deterministic:/hitung|formula|convert/.test(q),causal:/mengapa|sebab|dampak/.test(q),research:/riset|sumber|bukti/.test(q)};}

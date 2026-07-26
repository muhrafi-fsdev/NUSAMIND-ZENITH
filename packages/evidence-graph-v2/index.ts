export type Claim={id:string;text:string;sourceIds:string[];confidence:number};
export function validateClaim(claim:Claim){return {valid:claim.text.trim().length>0&&claim.sourceIds.length>0,independentSources:new Set(claim.sourceIds).size,confidence:Math.max(0,Math.min(1,claim.confidence))};}

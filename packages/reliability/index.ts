export function uncertaintyLayer(input:{confidence:number;evidence:number;risk:'low'|'medium'|'high'}){
  const abstain=input.confidence<0.45||input.evidence===0; const escalate=input.risk==='high'&&(input.confidence<0.8||input.evidence<2);
  return {abstain,escalate,confidence:Math.max(0,Math.min(1,input.confidence))};
}

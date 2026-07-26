export type SafetySignal={level:'none'|'low'|'medium'|'high'|'critical';source:string;reason:string};
const rank={none:0,low:1,medium:2,high:3,critical:4} as const;
export function monotonicSafetyMerge(signals:SafetySignal[]){const valid=signals.filter(Boolean);const strongest=valid.reduce((a,b)=>rank[b.level]>rank[a.level]?b:a,{level:'none',source:'default',reason:'none'} as SafetySignal);return{...strongest,signals:valid,downgradeBlocked:true};}

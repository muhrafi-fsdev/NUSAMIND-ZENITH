import { RELEASE } from './release';
const activeEdition=String(RELEASE.edition) as 'swift'|'zenith'|'apex';
const budgets={
  swift:{contextTokens:8192,modelCalls:3,agentSteps:3,parallelism:1,tools:3,retries:0,elapsedMs:3500,outputTokens:1800,ramMb:2048},
  zenith:{contextTokens:16384,modelCalls:8,agentSteps:10,parallelism:1,tools:7,retries:1,elapsedMs:6500,outputTokens:4200,ramMb:4096},
  apex:{contextTokens:32768,modelCalls:16,agentSteps:24,parallelism:3,tools:14,retries:2,elapsedMs:12000,outputTokens:7600,ramMb:8192}
} as const;
export type BudgetKey=keyof typeof budgets.swift;
export function resourceBudgetV3(){return budgets[activeEdition];}
export function enforceBudget(usage:Partial<Record<BudgetKey,number>>){const budget=resourceBudgetV3();const violations=(Object.keys(budget) as BudgetKey[]).filter((key)=>(usage[key]??0)>budget[key]);return{ok:violations.length===0,budget,usage,violations,action:violations.length?(activeEdition==='swift'?'handoff':'degrade'):'continue'};}

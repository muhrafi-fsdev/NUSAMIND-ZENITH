
import type { PlanNode } from './plan-compiler';
export type StepResult={id:string;ok:boolean;actualState:string;evidence?:unknown};
export async function runWorkflow(nodes:PlanNode[],execute:(node:PlanNode)=>Promise<StepResult>){const results:StepResult[]=[];for(const node of nodes){const unmet=node.dependsOn.filter((dep)=>!results.find((x)=>x.id===dep&&x.ok));if(unmet.length)return{ok:false,results,error:`UNMET_DEPENDENCY:${unmet.join(',')}`};const result=await execute(node);results.push(result);if(!result.ok)return{ok:false,results,error:`STEP_FAILED:${node.id}`};if(result.id!==node.id||result.actualState!==node.expectedState)return{ok:false,results,error:`EXPECTED_STATE_MISMATCH:${node.id}`};}return{ok:true,results};}

export type PlanStep={id:string;task:string;risk:'low'|'medium'|'high';state:'pending'|'running'|'done'|'failed';verify:string};
export function makePlan(tasks:string[]):PlanStep[]{return tasks.map((task,i)=>({id:`step-${i+1}`,task,risk:/delete|move|edit|run|deploy/i.test(task)?'high':'low',state:'pending',verify:'expected state must be observed'}));}
export function revisePlan(plan:PlanStep[],failedId:string,reason:string){return plan.map(step=>step.id===failedId?{...step,state:'failed' as const,verify:`failed: ${reason}`}:step);}

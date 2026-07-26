export type AnswerScoreInput={answer:string;sources:number;safetyPassed:boolean;formatPassed:boolean;criticalGatePassed:boolean;confidence?:number};
export function scoreAnswerV3(input:AnswerScoreInput){
  const checks={nonEmpty:input.answer.trim().length>0,evidence:input.sources>0||input.confidence===1,safety:input.safetyPassed,format:input.formatPassed,critical:input.criticalGatePassed};
  const weights={nonEmpty:10,evidence:25,safety:30,format:10,critical:25};
  const score=Object.entries(checks).reduce((sum,[key,ok])=>sum+(ok?weights[key as keyof typeof weights]:0),0);
  const releaseAllowed=checks.nonEmpty&&checks.safety&&checks.critical&&score>=80;
  return{score,releaseAllowed,checks,failed:Object.entries(checks).filter(([,ok])=>!ok).map(([key])=>key)};
}

import {GET as n1Evaluate} from '../../n1/evaluate/route'; export const runtime='nodejs'; export const dynamic='force-dynamic'; export async function GET(){return n1Evaluate();}

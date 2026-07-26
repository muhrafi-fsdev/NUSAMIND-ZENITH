import {GET as n1Status} from '../../n1/status/route'; export const runtime='nodejs'; export const dynamic='force-dynamic'; export async function GET(){return n1Status();}

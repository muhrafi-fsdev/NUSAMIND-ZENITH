import {RELEASE} from './release';
import {n1Status,n1ContractEvaluation} from '@/packages/n1-runtime';
export function runtimeManifestN1(){return {ok:true,release:RELEASE.label,version:RELEASE.version,edition:RELEASE.edition,uiChanged:false,windowsExe:'CANCELLED',n8n:'POSTPONED',status:n1Status(),evaluation:n1ContractEvaluation()};}

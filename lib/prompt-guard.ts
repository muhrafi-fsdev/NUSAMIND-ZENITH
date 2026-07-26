
export { inspectPromptInjection, preventPromptLeakage, permissionAwareTool } from './security/prompt-defense-v3';
import { inspectPromptInjection } from './security/prompt-defense-v3';
export function inspectRetrievedText(text:string){return inspectPromptInjection(text);}

export { resourceBudgetV3 as resourceBudget, enforceBudget } from './resource-governor-v3';
export function clampResourceRequest(request:Record<string,number>){return request;}

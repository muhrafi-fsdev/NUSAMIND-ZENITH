import {RELEASE} from '@/lib/release';
const budgets={swift:{contextTokens:8192,modelCalls:3,agentSteps:4,parallelism:1,tools:3,retries:0,elapsedMs:3500,outputTokens:1800,ramMb:2048},zenith:{contextTokens:18432,modelCalls:9,agentSteps:12,parallelism:1,tools:8,retries:1,elapsedMs:7500,outputTokens:4600,ramMb:4096},apex:{contextTokens:36864,modelCalls:18,agentSteps:28,parallelism:3,tools:16,retries:2,elapsedMs:14000,outputTokens:8200,ramMb:8192}} as const;
export function resourceBudgetV4(){return budgets[RELEASE.edition];}

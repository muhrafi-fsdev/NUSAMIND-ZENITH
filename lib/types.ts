export type AssistantMode = 'auto' | 'quran' | 'universal' | 'coding' | 'companion' | 'workflow';
export type IntelligenceLevel = 'instant' | 'ordinary' | 'medium' | 'high' | 'thinking';

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface IntelligenceProfile {
  level: IntelligenceLevel;
  name: string;
  description: string;
  bestFor: string[];
  retrievalTopK: number;
  temperature: number;
  maxOutputTokens: number;
  reasoningDepth: 'low' | 'standard' | 'medium' | 'high' | 'deep';
  verificationPasses: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  mode?: AssistantMode;
  intelligenceLevel?: IntelligenceLevel;
  intent?: IntentResult;
  sources?: RetrievalHit[];
}

export interface IntentResult {
  mode: Exclude<AssistantMode, 'auto'>;
  confidence: number;
  reasons: string[];
  safety: 'normal' | 'religious_guarded' | 'sensitive_general';
}

export interface RetrievalHit {
  id: string;
  title: string;
  category: string;
  text: string;
  score: number;
  source?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface SessionTask {
  id: string;
  title: string;
  status: 'open' | 'answered' | 'done' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface SessionArtifact {
  id: string;
  name: string;
  type?: string;
  path?: string;
  createdAt: string;
}

export interface SessionTimelineItem {
  at: string;
  event: string;
  detail: string;
}

export interface SessionContextPin {
  id: string;
  text: string;
  createdAt: string;
}

export interface SessionLastOutput {
  id: string;
  content: string;
  createdAt: string;
}

export interface SessionState {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  title?: string;
  pinned?: boolean;
  pinnedAt?: string;
  pinnedNote?: string;
  defaultIntelligenceLevel?: IntelligenceLevel;
  activeTopic?: string;
  summary?: string;
  lastUserMessage?: string;
  lastOutput?: SessionLastOutput;
  pendingTasks?: SessionTask[];
  artifacts?: SessionArtifact[];
  timeline?: SessionTimelineItem[];
  contextPins?: SessionContextPin[];
  privateMode?: boolean;
  branchOf?: string;
  branchName?: string;
  contextHealth?: {
    messageCount: number;
    summaryAgeMessages: number;
    hasLastOutput: boolean;
    hasActiveTopic: boolean;
    updatedAt: string;
  };
  messages: ChatMessage[];
}

export interface MemoryRecord {
  key: string;
  value: string;
  importance: number;
  updatedAt: string;
}

export interface WorkflowStep {
  id: string;
  title: string;
  objective: string;
  outputs: string[];
  checklist: string[];
  metrics: string[];
  tools: string[];
}

export interface WorkflowPlan {
  projectName: string;
  targetMode: AssistantMode | 'hybrid';
  summary: string;
  steps: WorkflowStep[];
  nextActions: string[];
}

export interface MonitoringSummary {
  totalSessions: number;
  totalMemoryFiles: number;
  totalInteractionLogs: number;
  latestSessionId?: string;
  latestInteractionAt?: string;
}

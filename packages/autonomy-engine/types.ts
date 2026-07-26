export type Edition = 'swift' | 'zenith' | 'apex';
export type Capability =
  | 'automatic-git-push' | 'force-push' | 'destructive-action'
  | 'credential-vault' | 'external-workspace-edit' | 'unverified-mcp'
  | 'autonomous-deployment' | 'extended-agent-loop';
export type VerificationEvidence = {
  parsed: boolean; typecheck: boolean; tests: boolean; build: boolean;
  security: boolean; secretScan: boolean;
};
export type ApprovalContext = { action: string; subject?: string; environment?: string };
export type CommandResult = { code: number; stdout: string; stderr: string; timedOut: boolean };
export type AuditRecord = {
  at: string; edition: Edition; action: string; status: 'PLANNED'|'APPROVED'|'DENIED'|'SUCCEEDED'|'FAILED'|'ROLLED_BACK';
  workspace: string; subject?: string; details?: Record<string, unknown>;
};

export type SyscallType =
  | 'SYS_FILE_READ'
  | 'SYS_FILE_WRITE'
  | 'SYS_NET_CONNECT'
  | 'SYS_PROCESS_SPAWN'
  | 'SYS_ENV_ACCESS';

export type GuardrailAction = 'ALLOW' | 'LOG_WARN' | 'BLOCK' | 'TERMINATE_AGENT';

export type ViolationSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface GuardrailPolicy {
  id: string;
  agentId: string;
  allowedReadPaths: string[];
  allowedWritePaths: string[];
  blockedPaths: string[];
  allowedEgressDomains: string[];
  allowedCommands: string[];
  disallowedCommands: string[];
  maxMemoryMB: number;
  maxExecutionTimeMs: number;
  strictZeroTrust: boolean;
}

export interface InterceptedSyscall {
  id: string;
  agentId: string;
  timestamp: string;
  syscall: SyscallType;
  target: string; // File path, host:port, executable name, or env key
  arguments?: Record<string, unknown>;
}

export interface GuardrailDecision {
  allowed: boolean;
  action: GuardrailAction;
  severity: ViolationSeverity;
  reason?: string;
  ruleMatched?: string;
  timestamp: string;
}

export interface GuardrailAuditLog {
  id: string;
  syscallEvent: InterceptedSyscall;
  decision: GuardrailDecision;
}

import {
  GuardrailPolicy,
  InterceptedSyscall,
  GuardrailDecision
} from './guardrail.types.js';

export class GuardrailLogic {
  static readonly DEFAULT_POLICY: GuardrailPolicy = {
    id: 'default-sovereign-guardrail',
    agentId: '*',
    allowedReadPaths: ['/workspace', 'D:/TUM', './src', './tests', './dist'],
    allowedWritePaths: ['/workspace/tmp', 'D:/TUM/tum-agentic-workos', './dist', './scratch'],
    blockedPaths: [
      '/etc/shadow',
      '/etc/passwd',
      'C:/Windows/System32',
      '.env',
      '*.key',
      'id_rsa'
    ],
    allowedEgressDomains: [
      'api.tum-group.internal',
      'daywakler.atlassian.net',
      'api.github.com',
      'localhost',
      '127.0.0.1'
    ],
    allowedCommands: ['node', 'git', 'tsc', 'npm', 'orca', 'gh', 'dotnet'],
    disallowedCommands: ['rm -rf', 'format', 'mkfs', 'dd', 'nc -e', 'ncat', 'shutdown'],
    maxMemoryMB: 2048,
    maxExecutionTimeMs: 300000,
    strictZeroTrust: true
  };

  /**
   * Evaluates an intercepted syscall against active guardrail policy.
   */
  static evaluate(syscall: InterceptedSyscall, policy: GuardrailPolicy = this.DEFAULT_POLICY): GuardrailDecision {
    const timestamp = new Date().toISOString();

    // 1. Evaluate File Access
    if (syscall.syscall === 'SYS_FILE_READ' || syscall.syscall === 'SYS_FILE_WRITE') {
      const normalizedTarget = syscall.target.replace(/\\/g, '/').toLowerCase();

      // Check explicit blacklist
      for (const blocked of policy.blockedPaths) {
        const normBlocked = blocked.replace(/\\/g, '/').toLowerCase();
        if (normalizedTarget.includes(normBlocked)) {
          return {
            allowed: false,
            action: 'BLOCK',
            severity: 'CRITICAL',
            reason: `Access to sensitive path '${syscall.target}' is strictly forbidden by Sovereign Guardrail Policy.`,
            ruleMatched: `BLOCKED_PATH:${blocked}`,
            timestamp
          };
        }
      }

      // Check write permissions
      if (syscall.syscall === 'SYS_FILE_WRITE' && policy.strictZeroTrust) {
        const isAllowed = policy.allowedWritePaths.some(p => {
          const normAllowed = p.replace(/\\/g, '/').toLowerCase();
          return normalizedTarget.startsWith(normAllowed);
        });

        if (!isAllowed) {
          return {
            allowed: false,
            action: 'BLOCK',
            severity: 'HIGH',
            reason: `Write attempt to path '${syscall.target}' is outside declared allowed write boundaries.`,
            ruleMatched: 'ALLOWED_WRITE_RESTRICTION',
            timestamp
          };
        }
      }

      return { allowed: true, action: 'ALLOW', severity: 'LOW', timestamp };
    }

    // 2. Evaluate Network Egress
    if (syscall.syscall === 'SYS_NET_CONNECT') {
      const targetHost = syscall.target.toLowerCase().split(':')[0] || '';
      const isDomainWhitelisted = policy.allowedEgressDomains.some(d => {
        const norm = d.toLowerCase();
        return targetHost === norm || targetHost.endsWith('.' + norm);
      });

      if (!isDomainWhitelisted) {
        return {
          allowed: false,
          action: 'BLOCK',
          severity: 'HIGH',
          reason: `Network egress connection to unauthorized host '${syscall.target}' blocked by Sovereign Firewall.`,
          ruleMatched: 'EGRESS_WHITELIST_BREACH',
          timestamp
        };
      }

      return { allowed: true, action: 'ALLOW', severity: 'LOW', timestamp };
    }

    // 3. Evaluate Process Spawn / Exec
    if (syscall.syscall === 'SYS_PROCESS_SPAWN') {
      const cmd = syscall.target.toLowerCase().trim();

      // Disallowed dangerous commands
      for (const dangerous of policy.disallowedCommands) {
        if (cmd.includes(dangerous.toLowerCase())) {
          return {
            allowed: false,
            action: 'TERMINATE_AGENT',
            severity: 'CRITICAL',
            reason: `Critical Security Violation: Execution of prohibited command pattern '${dangerous}'. Agent execution terminated immediately.`,
            ruleMatched: `DISALLOWED_CMD:${dangerous}`,
            timestamp
          };
        }
      }

      // Whitelisted commands
      const baseCmd = cmd.split(' ')[0] || '';
      const isAllowed = policy.allowedCommands.some(c => baseCmd.includes(c.toLowerCase()));

      if (!isAllowed && policy.strictZeroTrust) {
        return {
          allowed: false,
          action: 'BLOCK',
          severity: 'MEDIUM',
          reason: `Command executable '${baseCmd}' is not on the permitted runtime command list.`,
          ruleMatched: 'CMD_WHITELIST_VIOLATION',
          timestamp
        };
      }

      return { allowed: true, action: 'ALLOW', severity: 'LOW', timestamp };
    }

    // Default Allow for unclassified safe syscalls
    return {
      allowed: true,
      action: 'ALLOW',
      severity: 'LOW',
      timestamp
    };
  }
}

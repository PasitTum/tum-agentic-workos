import {
  InterceptedSyscall,
  GuardrailDecision,
  GuardrailPolicy,
  SyscallType
} from '../../domain/guardrail/guardrail.types.js';
import { GuardrailLogic } from '../../domain/guardrail/guardrail.logic.js';
import { InMemoryDatabase } from '../persistence/in-memory-db.js';

export class SovereignSandboxViolationError extends Error {
  constructor(
    public readonly decision: GuardrailDecision,
    public readonly syscall: InterceptedSyscall
  ) {
    super(`Sovereign Sandbox Interceptor Violation: [${decision.severity}] ${decision.reason}`);
    this.name = 'SovereignSandboxViolationError';
  }
}

export class EbpfSocketInterceptor {
  private db = InMemoryDatabase.getInstance();

  /**
   * Intercepts and enforces runtime policy on agent syscall execution.
   */
  public intercept(
    agentId: string,
    syscall: SyscallType,
    target: string,
    args?: Record<string, unknown>,
    customPolicy?: GuardrailPolicy
  ): GuardrailDecision {
    const event: InterceptedSyscall = {
      id: `SYS-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      agentId,
      timestamp: new Date().toISOString(),
      syscall,
      target,
      arguments: args
    };

    const policy = customPolicy || this.db.guardrailPolicies.get(agentId) || GuardrailLogic.DEFAULT_POLICY;
    const decision = GuardrailLogic.evaluate(event, policy);

    // Record in Sovereign Audit Log Mesh
    this.db.guardrailLogs.push({
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      syscallEvent: event,
      decision
    });

    if (!decision.allowed) {
      if (decision.action === 'TERMINATE_AGENT') {
        const agent = this.db.agents.get(agentId);
        if (agent) {
          agent.status = 'SUSPENDED';
          agent.updatedAt = new Date().toISOString();
        }
      }
      throw new SovereignSandboxViolationError(decision, event);
    }

    return decision;
  }
}

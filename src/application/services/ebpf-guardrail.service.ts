import { InMemoryDatabase } from '../../infrastructure/persistence/in-memory-db.js';
import { EbpfSocketInterceptor } from '../../infrastructure/sandbox/ebpf-interceptor.js';
import {
  GuardrailPolicy,
  GuardrailAuditLog,
  GuardrailDecision,
  SyscallType
} from '../../domain/guardrail/guardrail.types.js';
import { InterceptSyscallSchema } from '../dto/schemas.js';
import { SovereignTelemetryBus } from '../../infrastructure/telemetry/sovereign-telemetry.js';

export class EbpfGuardrailService {
  private db = InMemoryDatabase.getInstance();
  private interceptor = new EbpfSocketInterceptor();

  public registerPolicy(policy: GuardrailPolicy): void {
    this.db.guardrailPolicies.set(policy.agentId, policy);
  }

  public interceptSyscall(input: unknown): GuardrailDecision {
    const validated = InterceptSyscallSchema.parse(input);

    try {
      const decision = this.interceptor.intercept(
        validated.agentId,
        validated.syscall as SyscallType,
        validated.target,
        validated.arguments
      );

      return decision;
    } catch (err: unknown) {
      SovereignTelemetryBus.emit(
        'SECURITY',
        'EBPF_GUARDRAIL_BREACH_BLOCKED',
        validated.agentId,
        'AGENT',
        { syscall: validated.syscall, target: validated.target, error: String(err) }
      );
      throw err;
    }
  }

  public getAuditLogs(limit = 50): GuardrailAuditLog[] {
    return this.db.guardrailLogs.slice(-limit).reverse();
  }
}

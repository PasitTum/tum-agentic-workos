/**
 * TUM Agentic WorkOS — Autonomous Agent Containment & Policy Enforcer
 * Listens for cross-fleet security events to freeze compromised agent privileges
 */

export interface ContainmentNotification {
  readonly executionId: string;
  readonly incidentId: string;
  readonly targetTechnique: string;
  readonly compromisedAgentId: string;
  readonly reason: string;
}

export interface AgentFreezeRecord {
  readonly freezeId: string;
  readonly agentId: string;
  readonly incidentId: string;
  readonly dacRevoked: boolean;
  readonly activeTasksSuspendedCount: number;
  readonly disbursementsFrozen: boolean;
  readonly frozenAt: string;
}

export class AgentContainmentListenerService {
  private frozenAgents: Map<string, AgentFreezeRecord> = new Map();
  private revokedDacs: Set<string> = new Set();

  public handleSecurityContainment(notification: ContainmentNotification): AgentFreezeRecord {
    const freezeId = `FRZ-${Date.now()}-${notification.compromisedAgentId}`;
    
    // Invalidate DAC token
    this.revokedDacs.add(notification.compromisedAgentId);

    const record: AgentFreezeRecord = {
      freezeId,
      agentId: notification.compromisedAgentId,
      incidentId: notification.incidentId,
      dacRevoked: true,
      activeTasksSuspendedCount: 2, // simulated active workflow DAG tasks frozen
      disbursementsFrozen: true,
      frozenAt: new Date().toISOString()
    };

    this.frozenAgents.set(notification.compromisedAgentId, record);
    return record;
  }

  public isAgentFrozen(agentId: string): boolean {
    return this.frozenAgents.has(agentId);
  }

  public isDacRevoked(agentId: string): boolean {
    return this.revokedDacs.has(agentId);
  }

  public getFreezeRecord(agentId: string): AgentFreezeRecord | undefined {
    return this.frozenAgents.get(agentId);
  }
}

import { AgentRoiLogic } from '../../domain/agent-roi/agent-roi.logic.js';
import {
  TokenUsageEvent,
  BusinessValueEvent,
  AgentRoiSummary,
  BusinessValueCategory
} from '../../domain/agent-roi/agent-roi.types.js';
import { SovereignTelemetryBus } from '../../infrastructure/telemetry/sovereign-telemetry.js';

export class AgentRoiService {
  private tokenEvents: TokenUsageEvent[] = [];
  private valueEvents: BusinessValueEvent[] = [];

  public logTokenUsage(
    agentId: string,
    taskId: string,
    modelEngine: string,
    inputTokens: number,
    outputTokens: number
  ): TokenUsageEvent {
    const costTHB = AgentRoiLogic.calculateTokenCost(inputTokens, outputTokens, modelEngine);
    const event: TokenUsageEvent = {
      eventId: `TOK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      agentId,
      taskId,
      modelEngine,
      inputTokens,
      outputTokens,
      costTHB,
      timestamp: new Date().toISOString()
    };

    this.tokenEvents.push(event);

    SovereignTelemetryBus.emit(
      'WORKFORCE',
      'AGENT_TOKEN_BURNED',
      agentId,
      'AGENT',
      { taskId, model: modelEngine, totalTokens: inputTokens + outputTokens, costTHB }
    );

    return event;
  }

  public logBusinessValue(
    agentId: string,
    taskId: string,
    category: BusinessValueCategory,
    valueTHB: number,
    evidenceRef: string
  ): BusinessValueEvent {
    const event: BusinessValueEvent = {
      eventId: `VAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      agentId,
      taskId,
      category,
      valueTHB,
      evidenceRef,
      timestamp: new Date().toISOString()
    };

    this.valueEvents.push(event);

    SovereignTelemetryBus.emit(
      'AUDIT',
      'AGENT_BUSINESS_VALUE_ATTRIBUTED',
      agentId,
      'AGENT',
      { taskId, category, valueTHB, evidenceRef }
    );

    return event;
  }

  public getAgentRoiScorecard(agentId: string): AgentRoiSummary {
    const agentTokens = this.tokenEvents.filter(e => e.agentId === agentId);
    const agentValues = this.valueEvents.filter(e => e.agentId === agentId);

    return AgentRoiLogic.calculateRoi(agentId, agentTokens, agentValues);
  }

  public listAllAgentScorecards(): AgentRoiSummary[] {
    const agentIds = Array.from(new Set([
      ...this.tokenEvents.map(e => e.agentId),
      ...this.valueEvents.map(e => e.agentId)
    ]));

    return agentIds.map(id => this.getAgentRoiScorecard(id));
  }
}

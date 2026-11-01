import {
  ModelPricingRate,
  TokenUsageEvent,
  BusinessValueEvent,
  AgentRoiSummary
} from './agent-roi.types.js';

export class AgentRoiLogic {
  static readonly DEFAULT_PRICING: Record<string, ModelPricingRate> = {
    'gemini-3.8-flash': {
      modelId: 'gemini-3.8-flash',
      costPerMillionInputTokensTHB: 3.50, // Approx $0.10/M
      costPerMillionOutputTokensTHB: 14.00 // Approx $0.40/M
    },
    'claude-3.7-sonnet': {
      modelId: 'claude-3.7-sonnet',
      costPerMillionInputTokensTHB: 105.00, // $3.00/M
      costPerMillionOutputTokensTHB: 525.00 // $15.00/M
    },
    'default': {
      modelId: 'default',
      costPerMillionInputTokensTHB: 10.00,
      costPerMillionOutputTokensTHB: 30.00
    }
  };

  /**
   * Computes compute cost in THB from token consumption.
   */
  static calculateTokenCost(
    inputTokens: number,
    outputTokens: number,
    modelEngine: string,
    pricingTable = this.DEFAULT_PRICING
  ): number {
    const rate = pricingTable[modelEngine] || pricingTable['default']!;
    const inputCost = (inputTokens / 1_000_000) * rate.costPerMillionInputTokensTHB;
    const outputCost = (outputTokens / 1_000_000) * rate.costPerMillionOutputTokensTHB;
    return Math.round((inputCost + outputCost) * 10000) / 10000;
  }

  /**
   * Computes holistic ROI summary for an autonomous agent.
   */
  static calculateRoi(
    agentId: string,
    tokenEvents: TokenUsageEvent[],
    valueEvents: BusinessValueEvent[]
  ): AgentRoiSummary {
    const totalInputTokens = tokenEvents.reduce((sum, e) => sum + e.inputTokens, 0);
    const totalOutputTokens = tokenEvents.reduce((sum, e) => sum + e.outputTokens, 0);
    const totalComputeCostTHB = Math.round(tokenEvents.reduce((sum, e) => sum + e.costTHB, 0) * 100) / 100;

    const totalBusinessValueTHB = Math.round(valueEvents.reduce((sum, e) => sum + e.valueTHB, 0) * 100) / 100;
    const netValueContributionTHB = Math.round((totalBusinessValueTHB - totalComputeCostTHB) * 100) / 100;

    const roiMultiplier = totalComputeCostTHB > 0
      ? Math.round((totalBusinessValueTHB / totalComputeCostTHB) * 100) / 100
      : totalBusinessValueTHB > 0 ? 999.99 : 1.0;

    let efficiencyTier: AgentRoiSummary['efficiencyTier'];
    if (roiMultiplier >= 10.0) {
      efficiencyTier = 'EXCEPTIONAL';
    } else if (roiMultiplier >= 4.0) {
      efficiencyTier = 'HIGH_PERFORMING';
    } else if (roiMultiplier >= 1.0) {
      efficiencyTier = 'VIABLE';
    } else {
      efficiencyTier = 'UNPROFITABLE';
    }

    return {
      agentId,
      totalInputTokens,
      totalOutputTokens,
      totalComputeCostTHB,
      totalBusinessValueTHB,
      netValueContributionTHB,
      roiMultiplier,
      efficiencyTier,
      evaluationPeriod: new Date().toISOString().slice(0, 7) // YYYY-MM
    };
  }
}

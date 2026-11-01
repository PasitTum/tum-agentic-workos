export interface ModelPricingRate {
  modelId: string;
  costPerMillionInputTokensTHB: number;
  costPerMillionOutputTokensTHB: number;
}

export type BusinessValueCategory =
  | 'PROCUREMENT_DISCOUNT_REALIZED'
  | 'INVOICE_OVERBILLING_PREVENTED'
  | 'FRAUD_PAYMENT_BLOCKED'
  | 'WORKFLOW_TASK_AUTOMATION';

export interface TokenUsageEvent {
  eventId: string;
  agentId: string;
  taskId: string;
  modelEngine: string;
  inputTokens: number;
  outputTokens: number;
  costTHB: number;
  timestamp: string;
}

export interface BusinessValueEvent {
  eventId: string;
  agentId: string;
  taskId: string;
  category: BusinessValueCategory;
  valueTHB: number;
  evidenceRef: string;
  timestamp: string;
}

export interface AgentRoiSummary {
  agentId: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalComputeCostTHB: number;
  totalBusinessValueTHB: number;
  netValueContributionTHB: number;
  roiMultiplier: number; // e.g. 14.5x
  efficiencyTier: 'EXCEPTIONAL' | 'HIGH_PERFORMING' | 'VIABLE' | 'UNPROFITABLE';
  evaluationPeriod: string;
}

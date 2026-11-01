/**
 * TUM Agentic WorkOS — Treasury & Cash Flow Domain Types
 * Strict Clean Architecture (Zero External Dependencies)
 */

export type FlowCategory = 'RECEIVABLE_INFLOW' | 'PAYABLE_OUTFLOW' | 'PAYROLL_COMMITTED' | 'TAX_SETTLEMENT';

export interface CashFlowEvent {
  readonly id: string;
  readonly category: FlowCategory;
  readonly amountThb: number;
  readonly dueDayOffset: number; // Day offset relative to now (0 = today, 30 = in 30 days)
  readonly counterparty: string;
  readonly reliabilityFactor: number; // 0.0 to 1.0 probability of fulfillment
}

export interface DailyProjection {
  readonly day: number;
  readonly inflowThb: number;
  readonly outflowThb: number;
  readonly netDailyThb: number;
  readonly cumulativeBalanceThb: number;
}

export interface TreasuryForecast {
  readonly forecastId: string;
  readonly startingBalanceThb: number;
  readonly minimumBufferThb: number;
  readonly horizonDays: number;
  readonly totalProjectedInflowThb: number;
  readonly totalProjectedOutflowThb: number;
  readonly projectedEndingBalanceThb: number;
  readonly isLiquidityCrunchPredicted: boolean;
  readonly earliestDeficitDay: number | null;
  readonly recommendedAction: 'SUFFICIENT_LIQUIDITY' | 'OFFER_EARLY_PAYMENT_DISCOUNT' | 'DEFER_CAPEX_EXPENSE' | 'DRAW_REVOLVING_CREDIT';
  readonly dailyProjections: readonly DailyProjection[];
  readonly generatedAt: string;
}

export interface QuantumSealedTreasuryForecast {
  readonly forecast: TreasuryForecast;
  readonly quantumSignatureHex: string;
  readonly algorithm: 'ML-DSA-65';
  readonly keyId: string;
}

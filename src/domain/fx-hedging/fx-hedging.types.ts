export type SupportedCurrency = 'THB' | 'USD' | 'EUR' | 'SGD' | 'JPY' | 'CNY';

export interface FxSpotRate {
  baseCurrency: SupportedCurrency;
  quoteCurrency: 'THB';
  rate: number; // e.g. 36.50 THB per 1 USD
  interestRateBase: number; // e.g. 0.045 for USD 4.5%
  interestRateThb: number;  // e.g. 0.0225 for THB 2.25%
  asOf: string;
}

export interface FxExposure {
  exposureId: string;
  poNumber: string;
  vendorId: string;
  foreignCurrency: SupportedCurrency;
  foreignAmount: number;
  spotRateAtOrder: number;
  initialThbEquivalent: number;
  paymentDueDate: string;
}

export interface FxForwardContract {
  contractId: string;
  exposureId: string;
  pair: string; // e.g. 'USD/THB'
  foreignCurrency: SupportedCurrency;
  notionalAmount: number;
  contractForwardRate: number;
  lockedThbAmount: number;
  maturityDate: string;
  counterpartyBank: string;
  status: 'ACTIVE' | 'SETTLED' | 'EXPIRED';
  unrealizedGainLossTHB: number;
  createdAt: string;
}

export interface FxHedgeEvaluation {
  exposureId: string;
  currentSpotRate: number;
  currentThbValue: number;
  varianceFromOrderTHB: number;
  variancePercentage: number;
  shouldHedge: boolean;
  recommendedForwardRate: number;
  riskRating: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  rationale: string;
}

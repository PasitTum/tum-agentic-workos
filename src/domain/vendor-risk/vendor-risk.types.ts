export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'PROHIBITED';
export type ProcurementStatus = 'APPROVED' | 'RESTRICTED_APPROVAL_REQUIRED' | 'BLOCKED';
export type FinancialRating = 'A' | 'B' | 'C' | 'D';

export interface VendorProfile {
  vendorId: string;
  legalName: string;
  taxId: string;
  country: string;
  yearEstablished: number;
  sanctionsHit: boolean;
  pepInvolved: boolean; // Politically Exposed Person
  financialRating: FinancialRating;
  adverseMediaCount: number;
  bankAccountVerified: boolean;
}

export interface RiskFactor {
  factor: string;
  impactScore: number;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  description: string;
}

export interface VendorRiskEvaluation {
  vendorId: string;
  legalName: string;
  overallScore: number; // 0 to 100
  riskBand: RiskBand;
  procurementStatus: ProcurementStatus;
  maxSpendingLimitTHB: number;
  riskFactors: RiskFactor[];
  evaluatedAt: string;
}

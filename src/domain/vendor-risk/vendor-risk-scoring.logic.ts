import {
  VendorProfile,
  VendorRiskEvaluation,
  RiskFactor,
  RiskBand,
  ProcurementStatus
} from './vendor-risk.types.js';

export class VendorRiskScoringLogic {
  /**
   * Evaluates vendor risk and KYC compliance score (0-100).
   */
  static evaluate(profile: VendorProfile): VendorRiskEvaluation {
    const riskFactors: RiskFactor[] = [];
    let score = 75; // Baseline neutral score

    // 1. Sanctions Screening (Fail-Closed)
    if (profile.sanctionsHit) {
      riskFactors.push({
        factor: 'GLOBAL_SANCTIONS_MATCH',
        impactScore: -100,
        severity: 'CRITICAL',
        description: 'Vendor matches active global/sovereign sanction watchlist. Absolute block.'
      });
      return {
        vendorId: profile.vendorId,
        legalName: profile.legalName,
        overallScore: 0,
        riskBand: 'PROHIBITED',
        procurementStatus: 'BLOCKED',
        maxSpendingLimitTHB: 0,
        riskFactors,
        evaluatedAt: new Date().toISOString()
      };
    }

    // 2. PEP (Politically Exposed Person) Involvement
    if (profile.pepInvolved) {
      score -= 25;
      riskFactors.push({
        factor: 'PEP_DIRECTOR_OR_UBO',
        impactScore: -25,
        severity: 'WARNING',
        description: 'Politically Exposed Person identified in board or ultimate beneficial ownership (UBO).'
      });
    }

    // 3. Financial Stability Rating
    switch (profile.financialRating) {
      case 'A':
        score += 15;
        break;
      case 'B':
        score += 5;
        break;
      case 'C':
        score -= 15;
        riskFactors.push({
          factor: 'WEAK_FINANCIAL_STABILITY',
          impactScore: -15,
          severity: 'WARNING',
          description: 'Sub-investment financial stability rating (Grade C).'
        });
        break;
      case 'D':
        score -= 35;
        riskFactors.push({
          factor: 'DISTRESSED_FINANCIALS',
          impactScore: -35,
          severity: 'CRITICAL',
          description: 'Severely distressed financial balance sheet (Grade D).'
        });
        break;
    }

    // 4. Adverse Media Hits
    if (profile.adverseMediaCount > 0) {
      const deduction = Math.min(profile.adverseMediaCount * 10, 30);
      score -= deduction;
      riskFactors.push({
        factor: 'ADVERSE_MEDIA_ALERTS',
        impactScore: -deduction,
        severity: profile.adverseMediaCount >= 3 ? 'CRITICAL' : 'WARNING',
        description: `${profile.adverseMediaCount} negative news / regulatory investigation hits detected.`
      });
    }

    // 5. Bank Account Verification
    if (!profile.bankAccountVerified) {
      score -= 20;
      riskFactors.push({
        factor: 'UNVERIFIED_BANK_ACCOUNT',
        impactScore: -20,
        severity: 'CRITICAL',
        description: 'Vendor corporate bank account has not completed sovereign 1-Satang penny verification.'
      });
    }

    // Normalize final score between 0 and 100
    const finalScore = Math.max(0, Math.min(100, Math.round(score)));

    // Determine Risk Band & Procurement Status
    let riskBand: RiskBand;
    let procurementStatus: ProcurementStatus;
    let maxSpendingLimitTHB: number;

    if (finalScore >= 80) {
      riskBand = 'LOW';
      procurementStatus = 'APPROVED';
      maxSpendingLimitTHB = 100_000_000; // 100M THB
    } else if (finalScore >= 55) {
      riskBand = 'MEDIUM';
      procurementStatus = 'APPROVED';
      maxSpendingLimitTHB = 10_000_000;  // 10M THB
    } else if (finalScore >= 35) {
      riskBand = 'HIGH';
      procurementStatus = 'RESTRICTED_APPROVAL_REQUIRED';
      maxSpendingLimitTHB = 1_000_000;   // 1M THB with C-Suite sign-off
    } else {
      riskBand = 'PROHIBITED';
      procurementStatus = 'BLOCKED';
      maxSpendingLimitTHB = 0;
    }

    return {
      vendorId: profile.vendorId,
      legalName: profile.legalName,
      overallScore: finalScore,
      riskBand,
      procurementStatus,
      maxSpendingLimitTHB,
      riskFactors,
      evaluatedAt: new Date().toISOString()
    };
  }
}

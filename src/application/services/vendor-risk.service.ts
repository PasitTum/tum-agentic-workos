import { VendorRiskScoringLogic } from '../../domain/vendor-risk/vendor-risk-scoring.logic.js';
import {
  VendorProfile,
  VendorRiskEvaluation
} from '../../domain/vendor-risk/vendor-risk.types.js';
import { SovereignTelemetryBus } from '../../infrastructure/telemetry/sovereign-telemetry.js';

export class VendorRiskService {
  private vendorProfiles = new Map<string, VendorProfile>();
  private evaluations = new Map<string, VendorRiskEvaluation>();

  public registerAndEvaluateVendor(profile: VendorProfile): VendorRiskEvaluation {
    this.vendorProfiles.set(profile.vendorId, profile);

    const evaluation = VendorRiskScoringLogic.evaluate(profile);
    this.evaluations.set(profile.vendorId, evaluation);

    SovereignTelemetryBus.emit(
      'SECURITY',
      'VENDOR_RISK_EVALUATED',
      profile.vendorId,
      'SYSTEM',
      {
        legalName: profile.legalName,
        overallScore: evaluation.overallScore,
        riskBand: evaluation.riskBand,
        procurementStatus: evaluation.procurementStatus,
        maxSpendingLimitTHB: evaluation.maxSpendingLimitTHB
      }
    );

    return evaluation;
  }

  public getEvaluation(vendorId: string): VendorRiskEvaluation | undefined {
    return this.evaluations.get(vendorId);
  }

  public canProcureFromVendor(vendorId: string, transactionAmountTHB: number): { allowed: boolean; reason?: string } {
    const evalResult = this.evaluations.get(vendorId);
    if (!evalResult) {
      return { allowed: false, reason: `Vendor ${vendorId} has not completed mandatory Sovereign KYC/Risk screening.` };
    }

    if (evalResult.procurementStatus === 'BLOCKED') {
      return {
        allowed: false,
        reason: `Vendor ${evalResult.legalName} is strictly BLOCKED (Risk Band: ${evalResult.riskBand}, Score: ${evalResult.overallScore}).`
      };
    }

    if (transactionAmountTHB > evalResult.maxSpendingLimitTHB) {
      return {
        allowed: false,
        reason: `Transaction amount ${transactionAmountTHB.toLocaleString()} THB exceeds authorized vendor spending cap of ${evalResult.maxSpendingLimitTHB.toLocaleString()} THB.`
      };
    }

    return { allowed: true };
  }
}

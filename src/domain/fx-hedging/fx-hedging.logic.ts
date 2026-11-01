import {
  FxSpotRate,
  FxExposure,
  FxForwardContract,
  FxHedgeEvaluation
} from './fx-hedging.types.js';

export class FxHedgingLogic {
  /**
   * Calculates theoretical forward exchange rate using Covered Interest Rate Parity (CIRP).
   * F = S * (1 + r_THB * (days / 360)) / (1 + r_Base * (days / 360))
   */
  static calculateForwardRate(spot: FxSpotRate, daysToMaturity: number): number {
    const timeFraction = Math.max(1, daysToMaturity) / 360;
    const numerator = 1 + spot.interestRateThb * timeFraction;
    const denominator = 1 + spot.interestRateBase * timeFraction;
    const forwardRate = spot.rate * (numerator / denominator);
    return Math.round(forwardRate * 10000) / 10000;
  }

  /**
   * Evaluates FX currency exposure and determines hedging urgency.
   */
  static evaluateExposure(
    exposure: FxExposure,
    spot: FxSpotRate,
    daysToMaturity: number,
    hedgeThresholdTHB = 1_000_000
  ): FxHedgeEvaluation {
    const currentThbValue = Math.round(exposure.foreignAmount * spot.rate * 100) / 100;
    const varianceFromOrderTHB = Math.round((currentThbValue - exposure.initialThbEquivalent) * 100) / 100;
    const variancePercentage = exposure.initialThbEquivalent > 0
      ? Math.round((varianceFromOrderTHB / exposure.initialThbEquivalent) * 10000) / 100
      : 0;

    const recommendedForwardRate = this.calculateForwardRate(spot, daysToMaturity);

    let riskRating: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    let shouldHedge = false;
    let rationale = '';

    if (currentThbValue >= hedgeThresholdTHB || Math.abs(variancePercentage) >= 3.0) {
      shouldHedge = true;
      if (Math.abs(variancePercentage) >= 5.0) {
        riskRating = 'CRITICAL';
        rationale = `Severe FX depreciation: Currency moved ${variancePercentage.toFixed(2)}%. Immediate treasury forward contract execution required.`;
      } else {
        riskRating = 'HIGH';
        rationale = `Exposure (${currentThbValue.toLocaleString()} THB) exceeds corporate sovereign hedging threshold (${hedgeThresholdTHB.toLocaleString()} THB).`;
      }
    } else if (currentThbValue >= hedgeThresholdTHB * 0.5) {
      riskRating = 'MEDIUM';
      shouldHedge = false;
      rationale = `Moderate foreign currency exposure within managed liquidity reserve parameters.`;
    } else {
      riskRating = 'LOW';
      shouldHedge = false;
      rationale = `Minor foreign currency commitment. Synthetic hedging not warranted.`;
    }

    return {
      exposureId: exposure.exposureId,
      currentSpotRate: spot.rate,
      currentThbValue,
      varianceFromOrderTHB,
      variancePercentage,
      shouldHedge,
      recommendedForwardRate,
      riskRating,
      rationale
    };
  }

  /**
   * Computes Mark-to-Market (MTM) unrealized gain or loss for an active forward contract.
   */
  static calculateMtm(contract: FxForwardContract, currentMarketForwardRate: number): number {
    // For corporate buying foreign currency to pay supplier:
    // If market forward rate is higher than contracted forward rate, we gained (locked lower cost).
    const rateDiff = currentMarketForwardRate - contract.contractForwardRate;
    const mtm = contract.notionalAmount * rateDiff;
    return Math.round(mtm * 100) / 100;
  }
}

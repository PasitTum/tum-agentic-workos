import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FxHedgingLogic } from '../../src/domain/fx-hedging/fx-hedging.logic.js';
import { FxHedgingService } from '../../src/application/services/fx-hedging.service.js';
import { FxSpotRate, FxExposure } from '../../src/domain/fx-hedging/fx-hedging.types.js';

describe('Corporate Treasury FX Hedging Engine (WOS-EPIC-11)', () => {
  it('calculates theoretical forward exchange rate using Covered Interest Rate Parity', () => {
    const spot: FxSpotRate = {
      baseCurrency: 'USD',
      quoteCurrency: 'THB',
      rate: 36.50,
      asOf: new Date().toISOString(),
      interestRateBase: 0.05, // 5% USD Fed Funds
      interestRateThb: 0.025  // 2.5% THB BOT Policy Rate
    };

    // 90 days
    // timeFraction = 90 / 360 = 0.25
    // num = 1 + 0.025 * 0.25 = 1.00625
    // den = 1 + 0.05 * 0.25 = 1.0125
    // F = 36.50 * (1.00625 / 1.0125) = 36.2747
    const forwardRate = FxHedgingLogic.calculateForwardRate(spot, 90);
    assert.equal(forwardRate, 36.2747);
  });

  it('evaluates foreign currency exposure and triggers HIGH or CRITICAL hedge recommendations', () => {
    const spot: FxSpotRate = {
      baseCurrency: 'USD',
      quoteCurrency: 'THB',
      rate: 37.00,
      asOf: new Date().toISOString(),
      interestRateBase: 0.05,
      interestRateThb: 0.025
    };

    // Exposure of 50,000 USD at original 35.00 = 1,750,000 THB. Current value at 37.00 = 1,850,000 THB.
    // Variance = +100,000 THB (+5.71% depreciation).
    const exposure: FxExposure = {
      exposureId: 'EXP-USD-001',
      poNumber: 'PO-2026-999',
      vendorId: 'VND-US-CLOUD',
      foreignCurrency: 'USD',
      foreignAmount: 50000,
      initialThbEquivalent: 1750000,
      spotRateAtOrder: 35.00,
      paymentDueDate: new Date(Date.now() + 60 * 86400000).toISOString()
    };

    const evaluation = FxHedgingLogic.evaluateExposure(exposure, spot, 60, 1000000);
    assert.equal(evaluation.shouldHedge, true);
    assert.equal(evaluation.riskRating, 'CRITICAL');
    assert.ok(evaluation.variancePercentage > 5.0);
  });

  it('executes forward contracts and computes mark-to-market valuations', () => {
    const service = new FxHedgingService();
    const exposure = service.recordForeignExposure(
      'PO-GLOBAL-01',
      'VND-AWS-INC',
      'USD',
      100000,
      new Date(Date.now() + 90 * 86400000).toISOString()
    );

    assert.equal(exposure.foreignCurrency, 'USD');
    assert.equal(exposure.foreignAmount, 100000);

    const contract = service.executeForwardHedge(exposure.exposureId, 'Siam Commercial Bank (SCB)', 90);
    assert.equal(contract.exposureId, exposure.exposureId);
    assert.equal(contract.status, 'ACTIVE');
    assert.ok(contract.contractForwardRate > 0);

    // Test MTM valuation: if market forward rate rises to contract + 1.00 THB/USD
    const newMarketRate = contract.contractForwardRate + 1.0;
    const mtm = FxHedgingLogic.calculateMtm(contract, newMarketRate);
    assert.equal(mtm, 100000 * 1.0); // 100,000 THB gain from hedging
  });
});

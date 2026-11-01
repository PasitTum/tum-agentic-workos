import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CashFlowForecasterService } from '../../src/application/services/cash-flow-forecaster.service.js';
import { CashFlowLogic } from '../../src/domain/treasury/cash-flow.logic.js';
import { CashFlowEvent } from '../../src/domain/treasury/cash-flow.types.js';

describe('CashFlowForecasterService (WOS-TREASURY-01)', () => {
  it('projects solvent balance when inflows comfortably exceed outflows', () => {
    const service = new CashFlowForecasterService();

    service.registerCashEvent({
      id: 'EVT-01',
      category: 'RECEIVABLE_INFLOW',
      amountThb: 5_000_000,
      dueDayOffset: 15,
      counterparty: 'Bangkok Bank PCL',
      reliabilityFactor: 0.95
    });

    service.registerCashEvent({
      id: 'EVT-02',
      category: 'PAYABLE_OUTFLOW',
      amountThb: 1_200_000,
      dueDayOffset: 20,
      counterparty: 'Cloud Hosting AWS',
      reliabilityFactor: 1.0
    });

    const sealed = service.generateForecast(10_000_000, 2_000_000, 30);
    const fc = sealed.forecast;

    assert.strictEqual(fc.isLiquidityCrunchPredicted, false);
    assert.strictEqual(fc.earliestDeficitDay, null);
    assert.strictEqual(fc.recommendedAction, 'SUFFICIENT_LIQUIDITY');
    assert.ok(fc.projectedEndingBalanceThb > 10_000_000);
    assert.ok(sealed.quantumSignatureHex.length > 32);
  });

  it('detects liquidity crunch and recommends DRAW_REVOLVING_CREDIT for near-term shortfall', () => {
    const service = new CashFlowForecasterService();

    // Massive payroll due in 5 days
    service.registerCashEvent({
      id: 'EVT-PAYROLL',
      category: 'PAYROLL_COMMITTED',
      amountThb: 9_500_000,
      dueDayOffset: 5,
      counterparty: 'SCB Payroll Fleet',
      reliabilityFactor: 1.0
    });

    const sealed = service.generateForecast(10_000_000, 3_000_000, 30);
    const fc = sealed.forecast;

    assert.strictEqual(fc.isLiquidityCrunchPredicted, true);
    assert.strictEqual(fc.earliestDeficitDay, 5);
    assert.strictEqual(fc.recommendedAction, 'DRAW_REVOLVING_CREDIT');
  });

  it('rejects invalid cash events with non-positive amounts or invalid reliability factors', () => {
    const service = new CashFlowForecasterService();

    assert.throws(() => {
      service.registerCashEvent({
        id: 'BAD-01',
        category: 'PAYABLE_OUTFLOW',
        amountThb: -500,
        dueDayOffset: 1,
        counterparty: 'Vendor X',
        reliabilityFactor: 1.0
      });
    }, /Amount must be positive/);

    assert.throws(() => {
      service.registerCashEvent({
        id: 'BAD-02',
        category: 'RECEIVABLE_INFLOW',
        amountThb: 1000,
        dueDayOffset: 1,
        counterparty: 'Vendor Y',
        reliabilityFactor: 1.5 // > 1.0
      });
    }, /Reliability factor must be between 0.0 and 1.0/);
  });

  it('validates CashFlowLogic horizon constraints', () => {
    assert.throws(() => {
      CashFlowLogic.projectCashFlow('FCST-TEST', 1000, 500, 0, []);
    }, /Horizon days must be between 1 and 365/);

    assert.throws(() => {
      CashFlowLogic.projectCashFlow('FCST-TEST', -1000, 500, 30, []);
    }, /Starting treasury balance cannot be negative/);
  });
});

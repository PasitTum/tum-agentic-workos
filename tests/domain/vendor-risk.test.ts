import { test, describe } from 'node:test';
import assert from 'node:assert';
import { VendorRiskScoringLogic } from '../../src/domain/vendor-risk/vendor-risk-scoring.logic.js';
import { VendorProfile } from '../../src/domain/vendor-risk/vendor-risk.types.js';

describe('Vendor Risk & Due Diligence KYC (WOS-EPIC-08)', () => {
  test('evaluates clean sovereign vendor with top tier LOW risk band and APPROVED status', () => {
    const cleanVendor: VendorProfile = {
      vendorId: 'VND-001',
      legalName: 'Apex Data Infrastructure Ltd.',
      taxId: '0105558000018',
      country: 'TH',
      yearEstablished: 2015,
      sanctionsHit: false,
      pepInvolved: false,
      financialRating: 'A',
      adverseMediaCount: 0,
      bankAccountVerified: true
    };

    const result = VendorRiskScoringLogic.evaluate(cleanVendor);
    assert.strictEqual(result.overallScore >= 80, true);
    assert.strictEqual(result.riskBand, 'LOW');
    assert.strictEqual(result.procurementStatus, 'APPROVED');
    assert.strictEqual(result.maxSpendingLimitTHB, 100_000_000);
    assert.strictEqual(result.riskFactors.length, 0);
  });

  test('immediately PROHIBITS and BLOCKS vendor matching sanctions watchlist', () => {
    const sanctionedVendor: VendorProfile = {
      vendorId: 'VND-SANCTIONED',
      legalName: 'Blacklisted Egress Corp',
      taxId: '0999999999999',
      country: 'RU',
      yearEstablished: 2020,
      sanctionsHit: true,
      pepInvolved: false,
      financialRating: 'A',
      adverseMediaCount: 0,
      bankAccountVerified: true
    };

    const result = VendorRiskScoringLogic.evaluate(sanctionedVendor);
    assert.strictEqual(result.overallScore, 0);
    assert.strictEqual(result.riskBand, 'PROHIBITED');
    assert.strictEqual(result.procurementStatus, 'BLOCKED');
    assert.strictEqual(result.maxSpendingLimitTHB, 0);
    assert.strictEqual(result.riskFactors.some(f => f.factor === 'GLOBAL_SANCTIONS_MATCH'), true);
  });

  test('restricts procurement when vendor has PEP, adverse media, and distressed financials', () => {
    const riskyVendor: VendorProfile = {
      vendorId: 'VND-RISKY',
      legalName: 'Volatile Ventures LLC',
      taxId: '0105558000099',
      country: 'TH',
      yearEstablished: 2024,
      sanctionsHit: false,
      pepInvolved: true,
      financialRating: 'D',
      adverseMediaCount: 2,
      bankAccountVerified: false
    };

    const result = VendorRiskScoringLogic.evaluate(riskyVendor);
    assert.strictEqual(result.overallScore < 35, true);
    assert.strictEqual(result.riskBand, 'PROHIBITED');
    assert.strictEqual(result.procurementStatus, 'BLOCKED');
  });
});

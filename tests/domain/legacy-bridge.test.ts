import { test, describe } from 'node:test';
import assert from 'node:assert';
import { LegacyAdapterLogic } from '../../src/domain/legacy-bridge/legacy.logic.js';

describe('Legacy ERP Adapter (WOS-EPIC-04)', () => {
  test('normalizes SAP S/4HANA PO payload into TUM standard schema', () => {
    const rawSap = {
      EBELN: '4500012345',
      LIFNR: 'VEND-SAP-88',
      NETWR: 750000,
      WAERS: 'THB'
    };

    const record = LegacyAdapterLogic.normalizeSapPayload({
      externalSystem: 'SAP_S4HANA',
      externalEntityId: '4500012345',
      entityType: 'PURCHASE_ORDER',
      rawPayload: rawSap,
      receivedAt: new Date().toISOString()
    });

    assert.strictEqual(record.externalSystem, 'SAP_S4HANA');
    assert.strictEqual(record.tumId, 'TUM-SAP-4500012345');
    assert.strictEqual(record.data.poNumber, '4500012345');
    assert.strictEqual(record.data.totalAmount, 750000);
    assert.strictEqual(record.status, 'SYNCED');
  });

  test('normalizes Salesforce CRM Account payload', () => {
    const rawSf = {
      AccountId: 'SF-ACC-99',
      Name: 'Siam Paragon Enterprise',
      Industry: 'Retail',
      AnnualRevenue: 50_000_000
    };

    const record = LegacyAdapterLogic.normalizeSalesforcePayload({
      externalSystem: 'SALESFORCE_CRM',
      externalEntityId: 'SF-ACC-99',
      entityType: 'VENDOR',
      rawPayload: rawSf,
      receivedAt: new Date().toISOString()
    });

    assert.strictEqual(record.externalSystem, 'SALESFORCE_CRM');
    assert.strictEqual(record.data.name, 'Siam Paragon Enterprise');
  });
});

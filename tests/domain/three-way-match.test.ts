import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ThreeWayMatchLogic } from '../../src/domain/procurement/three-way-match.logic.js';
import {
  PurchaseOrder,
  GoodsReceiptNote,
  VendorInvoice
} from '../../src/domain/procurement/procurement.types.js';

describe('Procurement 3-Way Matching Engine (WOS-EPIC-02)', () => {
  const basePo: PurchaseOrder = {
    id: 'PO-01',
    poNumber: 'PO-2026-100',
    prNumber: 'PR-2026-050',
    vendorId: 'VND-01',
    vendorName: 'SuperCloud Tech',
    items: [
      { itemId: 'ITM-1', sku: 'SVR-NODE-01', description: 'Server Blade A', quantity: 5, unitPrice: 100_000, lineTotal: 500_000 },
      { itemId: 'ITM-2', sku: 'SW-CAB-10G', description: 'Switch 10G', quantity: 2, unitPrice: 50_000, lineTotal: 100_000 }
    ],
    subtotal: 600_000,
    taxRate: 0.07,
    taxAmount: 42_000,
    totalAmount: 642_000,
    status: 'ISSUED',
    issuedAt: '2026-10-01',
    paymentTerms: 'Net 30'
  };

  const baseGrn: GoodsReceiptNote = {
    id: 'GRN-01',
    grnNumber: 'GRN-2026-100',
    poNumber: 'PO-2026-100',
    warehouseId: 'WH-MAIN',
    inspectorId: 'AGT-P2P',
    inspectorType: 'AGENT',
    receivedAt: '2026-10-05',
    items: [
      { itemId: 'ITM-1', sku: 'SVR-NODE-01', receivedQuantity: 5, acceptedQuantity: 5, rejectedQuantity: 0 },
      { itemId: 'ITM-2', sku: 'SW-CAB-10G', receivedQuantity: 2, acceptedQuantity: 2, rejectedQuantity: 0 }
    ],
    status: 'RECEIVED'
  };

  test('matches perfectly when quantities, prices, and line items align 100%', () => {
    const perfectInvoice: VendorInvoice = {
      id: 'INV-01',
      invoiceNumber: 'INV-100-PERFECT',
      vendorId: 'VND-01',
      poNumber: 'PO-2026-100',
      grnNumber: 'GRN-2026-100',
      invoiceDate: '2026-10-06',
      dueDate: '2026-11-06',
      items: [
        { itemId: 'ITM-1', sku: 'SVR-NODE-01', billedQuantity: 5, unitPrice: 100_000, lineTotal: 500_000 },
        { itemId: 'ITM-2', sku: 'SW-CAB-10G', billedQuantity: 2, unitPrice: 50_000, lineTotal: 100_000 }
      ],
      subtotal: 600_000,
      taxAmount: 42_000,
      totalAmount: 642_000,
      bankAccountRef: 'KBANK-001',
      status: 'PENDING_VERIFICATION'
    };

    const result = ThreeWayMatchLogic.evaluate(basePo, baseGrn, perfectInvoice, {
      ...ThreeWayMatchLogic.DEFAULT_POLICY,
      maxAutoApprovalThresholdTHB: 1_000_000 // High enough to auto approve 642k
    });

    assert.strictEqual(result.outcome, 'MATCH_PERFECT');
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.autoApproved, true);
    assert.strictEqual(result.totalDiscrepancies, 0);
  });

  test('flags MISMATCH_QUANTITY when billed quantity exceeds accepted quantity', () => {
    const excessInvoice: VendorInvoice = {
      id: 'INV-02',
      invoiceNumber: 'INV-100-EXCESS-QTY',
      vendorId: 'VND-01',
      poNumber: 'PO-2026-100',
      invoiceDate: '2026-10-06',
      dueDate: '2026-11-06',
      items: [
        { itemId: 'ITM-1', sku: 'SVR-NODE-01', billedQuantity: 6, unitPrice: 100_000, lineTotal: 600_000 }, // Billed 6, but only 5 accepted!
        { itemId: 'ITM-2', sku: 'SW-CAB-10G', billedQuantity: 2, unitPrice: 50_000, lineTotal: 100_000 }
      ],
      subtotal: 700_000,
      taxAmount: 49_000,
      totalAmount: 749_000,
      bankAccountRef: 'KBANK-001',
      status: 'PENDING_VERIFICATION'
    };

    const result = ThreeWayMatchLogic.evaluate(basePo, baseGrn, excessInvoice);

    assert.strictEqual(result.outcome, 'MISMATCH_QUANTITY');
    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.autoApproved, false);
    assert.strictEqual(result.discrepancies.length, 1);
    assert.strictEqual(result.discrepancies[0]?.discrepancyType, 'QUANTITY_EXCESS');
  });

  test('flags MISMATCH_PRICE when billed unit price exceeds tolerance', () => {
    const priceHikeInvoice: VendorInvoice = {
      id: 'INV-03',
      invoiceNumber: 'INV-100-PRICE-HIKE',
      vendorId: 'VND-01',
      poNumber: 'PO-2026-100',
      invoiceDate: '2026-10-06',
      dueDate: '2026-11-06',
      items: [
        { itemId: 'ITM-1', sku: 'SVR-NODE-01', billedQuantity: 5, unitPrice: 110_000, lineTotal: 550_000 }, // 10% price increase (tolerance 1%)
        { itemId: 'ITM-2', sku: 'SW-CAB-10G', billedQuantity: 2, unitPrice: 50_000, lineTotal: 100_000 }
      ],
      subtotal: 650_000,
      taxAmount: 45_500,
      totalAmount: 695_500,
      bankAccountRef: 'KBANK-001',
      status: 'PENDING_VERIFICATION'
    };

    const result = ThreeWayMatchLogic.evaluate(basePo, baseGrn, priceHikeInvoice);

    assert.strictEqual(result.outcome, 'MISMATCH_PRICE');
    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.autoApproved, false);
    assert.strictEqual(result.discrepancies[0]?.discrepancyType, 'PRICE_VARIANCE');
  });

  test('detects MISMATCH_UNORDERED_ITEMS when phantom item is billed', () => {
    const phantomInvoice: VendorInvoice = {
      id: 'INV-04',
      invoiceNumber: 'INV-100-PHANTOM',
      vendorId: 'VND-01',
      poNumber: 'PO-2026-100',
      invoiceDate: '2026-10-06',
      dueDate: '2026-11-06',
      items: [
        { itemId: 'ITM-UNKNOWN', sku: 'UNORDERED-CABLE', billedQuantity: 10, unitPrice: 1_000, lineTotal: 10_000 }
      ],
      subtotal: 10_000,
      taxAmount: 700,
      totalAmount: 10_700,
      bankAccountRef: 'KBANK-001',
      status: 'PENDING_VERIFICATION'
    };

    const result = ThreeWayMatchLogic.evaluate(basePo, baseGrn, phantomInvoice);

    assert.strictEqual(result.outcome, 'MISMATCH_UNORDERED_ITEMS');
    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.discrepancies[0]?.discrepancyType, 'UNORDERED_ITEM');
  });

  test('triggers FRAUD_ANOMALY_DETECTED for negative or zero financial amounts', () => {
    const fraudulentInvoice: VendorInvoice = {
      id: 'INV-05',
      invoiceNumber: 'INV-100-FRAUD',
      vendorId: 'VND-01',
      poNumber: 'PO-2026-100',
      invoiceDate: '2026-10-06',
      dueDate: '2026-11-06',
      items: [],
      subtotal: -50_000,
      taxAmount: 0,
      totalAmount: -50_000,
      bankAccountRef: 'KBANK-001',
      status: 'PENDING_VERIFICATION'
    };

    const result = ThreeWayMatchLogic.evaluate(basePo, baseGrn, fraudulentInvoice);

    assert.strictEqual(result.outcome, 'FRAUD_ANOMALY_DETECTED');
    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.autoApproved, false);
  });
});

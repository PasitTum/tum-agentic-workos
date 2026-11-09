import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ThreeWayMatchLogic } from '../../src/domain/procurement/three-way-match.logic.js';
import { ProcurementEngineService } from '../../src/application/services/procurement-engine.service.js';
import { InMemoryDatabase } from '../../src/infrastructure/persistence/in-memory-db.js';
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

  test('holds invoice for Human-in-the-Loop approval when amount exceeds 500k THB', () => {
    const highValueInvoice: VendorInvoice = {
      id: 'INV-HIGH-VAL',
      invoiceNumber: 'INV-100-HIGH-VAL',
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

    // Default policy has 500k limit
    const result = ThreeWayMatchLogic.evaluate(basePo, baseGrn, highValueInvoice);

    assert.strictEqual(result.outcome, 'MATCH_PERFECT');
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.autoApproved, false);
    assert.strictEqual(result.requiresHumanApproval, true);
    assert.strictEqual(result.auditNotes.includes('Human-in-the-Loop'), true);
  });

  test('executes Human-in-the-Loop payment approval and calculates WHT', () => {
    const db = InMemoryDatabase.getInstance();
    const service = new ProcurementEngineService();

    // INV-2026-778 is seeded with 3,424,000 THB total (3.2M base + 7% VAT)
    // Run 3-way match
    const match = service.executeThreeWayMatch('INV-2026-778');
    assert.strictEqual(match.outcome, 'MATCH_PERFECT');
    assert.strictEqual(match.requiresHumanApproval, true);

    const invoiceBefore = db.invoices.get('INV-2026-778')!;
    assert.strictEqual(invoiceBefore.status, 'PENDING_HUMAN_APPROVAL');

    // Human Controller Approves (Dr. Ake, approvalLimit 10M THB)
    const approvalResult = service.approvePaymentDisbursement(
      'INV-2026-778',
      'EMP-CEO-01',
      'Hardware inspection verified by CPO and Finance Lead.',
      0.01 // 1% WHT on hardware
    );

    assert.strictEqual(approvalResult.invoice.status, 'PAYMENT_AUTHORIZED');
    assert.strictEqual(approvalResult.approval.approvedBy, 'EMP-CEO-01');
    assert.strictEqual(approvalResult.approval.whtAmount, 32_000); // 1% of 3.2M
    assert.strictEqual(approvalResult.approval.netPayableAmount, 3_392_000); // 3,424,000 - 32,000
    assert.strictEqual(approvalResult.approval.authorizationStamp.startsWith('HITL-AUTH-'), true);
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
        { itemId: 'ITM-1', sku: 'SVR-NODE-01', billedQuantity: 6, unitPrice: 100_000, lineTotal: 600_000 },
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
        { itemId: 'ITM-1', sku: 'SVR-NODE-01', billedQuantity: 5, unitPrice: 110_000, lineTotal: 550_000 },
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

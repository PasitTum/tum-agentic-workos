import test from 'node:test';
import assert from 'node:assert/strict';
import { GeneralLedgerSyncService } from '../../src/application/services/general-ledger-sync.service.js';
import { QuantumCryptoService } from '../../src/infrastructure/crypto/quantum-crypto.js';

test('GeneralLedgerSyncService: Posts balanced goods procurement journal voucher (Thai GAAP)', () => {
  const glService = new GeneralLedgerSyncService();

  const voucher = glService.postProcurementVoucher({
    invoiceId: 'INV-2026-TUM-001',
    purchaseOrderId: 'PO-2026-991',
    vendorId: 'VEN-DELL-TH',
    vendorName: 'Dell Technologies Thailand',
    baseAmountThb: 100000.0,
    vatRatePercent: 7.0,
    whtRatePercent: 0.0,
    description: 'Server hardware acquisition for Quantum Mesh'
  });

  assert.equal(voucher.isBalanced, true);
  assert.equal(voucher.status, 'POSTED');
  assert.equal(voucher.totalDebitThb, 107000.0);
  assert.equal(voucher.totalCreditThb, 107000.0);
  assert.equal(voucher.items.length, 3); // Expense (100k) + Input VAT (7k) + AP (107k)

  // Verify Quantum Seal
  assert.equal(voucher.quantumSeal.algorithm, 'NIST-FIPS-204-ML-DSA-65');
  assert.ok(voucher.quantumSeal.signature.startsWith('mldsa65_sig_'));
  assert.ok(voucher.quantumSeal.digest.length > 32);

  const isSealValid = glService.verifyVoucherSeal(voucher.voucherId);
  assert.equal(isSealValid, true);
});

test('GeneralLedgerSyncService: Posts service procurement with 7% VAT and 3% Withholding Tax', () => {
  const glService = new GeneralLedgerSyncService();

  const voucher = glService.postProcurementVoucher({
    invoiceId: 'INV-2026-CONSULT-88',
    purchaseOrderId: 'PO-2026-442',
    vendorId: 'VEN-BIG4-LEGAL',
    vendorName: 'Global Legal & Trust Advisors',
    baseAmountThb: 50000.0,
    vatRatePercent: 7.0,
    whtRatePercent: 3.0,
    description: 'Post-Quantum Cryptographic Compliance Advisory'
  });

  assert.equal(voucher.isBalanced, true);
  // Debit: 50,000 (Expense) + 3,500 (VAT 7%) = 53,500
  // Credit: 1,500 (WHT 3%) + 52,000 (Net AP) = 53,500
  assert.equal(voucher.totalDebitThb, 53500.0);
  assert.equal(voucher.totalCreditThb, 53500.0);
  assert.equal(voucher.items.length, 4);

  const whtItem = voucher.items.find(i => i.accountNumber === '2130-00');
  assert.ok(whtItem);
  assert.equal(whtItem?.amountThb, 1500.0);
  assert.equal(whtItem?.entryType, 'CREDIT');
});

test('GeneralLedgerSyncService: Translates voucher into SAP S/4HANA BAPI accounting document', () => {
  const glService = new GeneralLedgerSyncService();

  const voucher = glService.postProcurementVoucher({
    invoiceId: 'INV-SAP-BRIDGE-01',
    purchaseOrderId: 'PO-SAP-01',
    vendorId: 'VEN-SAP-TH',
    vendorName: 'Enterprise Cloud Solutions',
    baseAmountThb: 20000.0,
    vatRatePercent: 7.0,
    whtRatePercent: 0.0,
    description: 'SAP Cloud Platform License Fee'
  });

  const bapiDoc = glService.toSapBapiFormat(voucher.voucherId, 'TH01');

  assert.equal(bapiDoc.header.bapiDocType, 'KR');
  assert.equal(bapiDoc.header.companyCode, 'TH01');
  assert.equal(bapiDoc.header.reference, 'INV-SAP-BRIDGE-01');
  assert.equal(bapiDoc.items.length, 3);

  // Debit indicator 'S', Credit indicator 'H'
  const expenseLine = bapiDoc.items.find(i => i.glAccount === '510000');
  const apLine = bapiDoc.items.find(i => i.glAccount === '211000');

  assert.equal(expenseLine?.debitCreditIndicator, 'S');
  assert.equal(expenseLine?.amount, 20000.0);
  assert.equal(apLine?.debitCreditIndicator, 'H');
  assert.equal(apLine?.amount, 21400.0);
});

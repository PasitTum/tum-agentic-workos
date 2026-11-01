import crypto from 'node:crypto';
import {
  JournalLineItem,
  JournalVoucher,
  SapBapiAccountingDocument
} from '../../domain/accounting/accounting.types.js';
import { QuantumCryptoService, KeyPairPqc } from '../../infrastructure/crypto/quantum-crypto.js';
import { SovereignTelemetryBus } from '../../infrastructure/telemetry/sovereign-telemetry.js';

export interface ProcurementPostingInput {
  invoiceId: string;
  purchaseOrderId: string;
  vendorId: string;
  vendorName: string;
  baseAmountThb: number;
  vatRatePercent?: number; // default 7%
  whtRatePercent?: number; // default 0% (e.g., 3% for services)
  description: string;
}

export class GeneralLedgerSyncService {
  private vouchers: Map<string, JournalVoucher> = new Map();
  private ledgerSigningKey: KeyPairPqc;

  constructor(signingKey?: KeyPairPqc) {
    this.ledgerSigningKey = signingKey || QuantumCryptoService.generateKeyPair('NIST-FIPS-204-ML-DSA-65');
  }

  /**
   * Generates, balances, signs, and posts a Double-Entry General Ledger voucher
   * from an approved procurement/invoice event conforming to Thai GAAP & SAP S/4HANA standards.
   */
  public postProcurementVoucher(input: ProcurementPostingInput): JournalVoucher {
    const voucherId = `JV-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const postingDate = new Date().toISOString();

    const vatRate = input.vatRatePercent !== undefined ? input.vatRatePercent : 7.0;
    const whtRate = input.whtRatePercent !== undefined ? input.whtRatePercent : 0.0;

    const baseAmount = Number(input.baseAmountThb.toFixed(2));
    const vatAmount = Number(((baseAmount * vatRate) / 100).toFixed(2));
    const whtAmount = Number(((baseAmount * whtRate) / 100).toFixed(2));
    const netPayable = Number((baseAmount + vatAmount - whtAmount).toFixed(2));

    const items: JournalLineItem[] = [];
    let line = 1;

    // 1. Debit Expense / Inventory Account
    items.push({
      lineNo: line++,
      accountNumber: '5100-00',
      accountName: 'Operating & Materials Expense',
      entryType: 'DEBIT',
      amountThb: baseAmount,
      description: input.description
    });

    // 2. Debit Input VAT (if > 0)
    if (vatAmount > 0) {
      items.push({
        lineNo: line++,
        accountNumber: '1130-00',
        accountName: 'Input VAT (7%)',
        entryType: 'DEBIT',
        amountThb: vatAmount,
        description: `Input VAT 7% on ${input.invoiceId}`
      });
    }

    // 3. Credit Withholding Tax Payable (if > 0)
    if (whtAmount > 0) {
      items.push({
        lineNo: line++,
        accountNumber: '2130-00',
        accountName: `Withholding Tax Payable (${whtRate}%)`,
        entryType: 'CREDIT',
        amountThb: whtAmount,
        description: `WHT ${whtRate}% withheld from ${input.vendorName}`
      });
    }

    // 4. Credit Accounts Payable
    items.push({
      lineNo: line++,
      accountNumber: '2110-00',
      accountName: 'Accounts Payable - Trade Vendors',
      entryType: 'CREDIT',
      amountThb: netPayable,
      description: `Net payable to ${input.vendorName} for ${input.invoiceId}`
    });

    const totalDebit = Number(
      items.filter(i => i.entryType === 'DEBIT').reduce((s, i) => s + i.amountThb, 0).toFixed(2)
    );
    const totalCredit = Number(
      items.filter(i => i.entryType === 'CREDIT').reduce((s, i) => s + i.amountThb, 0).toFixed(2)
    );

    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001;

    if (!isBalanced) {
      throw new Error(`Double-Entry Accounting Invariant Violated: Total Debits (${totalDebit}) !== Total Credits (${totalCredit})`);
    }

    // Cryptographic sealing using NIST FIPS 204 ML-DSA-65
    const sealPayload = {
      voucherId,
      invoiceId: input.invoiceId,
      totalDebitThb: totalDebit,
      totalCreditThb: totalCredit,
      postingDate,
      itemCount: items.length
    };

    const quantumSeal = QuantumCryptoService.signEnvelope(sealPayload, this.ledgerSigningKey);

    const voucher: JournalVoucher = {
      voucherId,
      referenceDocumentId: input.invoiceId,
      fiscalYear: new Date().getFullYear(),
      postingDate,
      currency: 'THB',
      items,
      totalDebitThb: totalDebit,
      totalCreditThb: totalCredit,
      isBalanced: true,
      status: 'POSTED',
      quantumSeal
    };

    this.vouchers.set(voucherId, voucher);

    SovereignTelemetryBus.emit('AUDIT', 'GENERAL_LEDGER_POSTED', voucherId, 'SYSTEM', {
      referenceId: input.invoiceId,
      totalDebit,
      totalCredit,
      isBalanced
    });

    return voucher;
  }

  /**
   * Cryptographically verifies the quantum seal of a posted journal voucher
   */
  public verifyVoucherSeal(voucherId: string): boolean {
    const voucher = this.vouchers.get(voucherId);
    if (!voucher) return false;

    const sealPayload = {
      voucherId: voucher.voucherId,
      invoiceId: voucher.referenceDocumentId,
      totalDebitThb: voucher.totalDebitThb,
      totalCreditThb: voucher.totalCreditThb,
      postingDate: voucher.postingDate,
      itemCount: voucher.items.length
    };

    return QuantumCryptoService.verifyEnvelope(sealPayload, voucher.quantumSeal);
  }

  /**
   * Translates an internal Journal Voucher into SAP S/4HANA BAPI accounting document
   */
  public toSapBapiFormat(voucherId: string, companyCode: string = '1000'): SapBapiAccountingDocument {
    const voucher = this.vouchers.get(voucherId);
    if (!voucher) {
      throw new Error(`Journal Voucher ${voucherId} not found in General Ledger`);
    }

    return {
      header: {
        bapiDocType: 'KR', // Vendor Invoice in SAP standard
        companyCode,
        postingDate: voucher.postingDate.substring(0, 10).replace(/-/g, ''),
        reference: voucher.referenceDocumentId
      },
      items: voucher.items.map(item => ({
        itemNo: item.lineNo,
        glAccount: item.accountNumber.replace('-', ''),
        debitCreditIndicator: item.entryType === 'DEBIT' ? 'S' : 'H',
        amount: item.amountThb,
        currency: voucher.currency,
        itemText: item.description
      }))
    };
  }

  public getVoucher(voucherId: string): JournalVoucher | undefined {
    return this.vouchers.get(voucherId);
  }

  public getAllVouchers(): JournalVoucher[] {
    return Array.from(this.vouchers.values());
  }
}

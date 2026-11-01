import { QuantumEnvelope } from '../credentials/dac.types.js';

export type JournalEntryType = 'DEBIT' | 'CREDIT';

export interface JournalLineItem {
  lineNo: number;
  accountNumber: string; // e.g. "1130-00" (Input VAT), "2110-00" (Accounts Payable), "5100-00" (Expense)
  accountName: string;
  entryType: JournalEntryType;
  amountThb: number;
  description: string;
}

export interface JournalVoucher {
  voucherId: string;
  referenceDocumentId: string; // e.g. PO or Invoice ID
  fiscalYear: number;
  postingDate: string;
  currency: string;
  items: JournalLineItem[];
  totalDebitThb: number;
  totalCreditThb: number;
  isBalanced: boolean;
  status: 'POSTED' | 'REJECTED_UNBALANCED' | 'PENDING_APPROVAL';
  quantumSeal: QuantumEnvelope;
}

export interface SapBapiAccountingDocument {
  header: {
    bapiDocType: string;
    companyCode: string;
    postingDate: string;
    reference: string;
  };
  items: Array<{
    itemNo: number;
    glAccount: string;
    debitCreditIndicator: 'S' | 'H'; // SAP standard: S=Debit, H=Credit
    amount: number;
    currency: string;
    itemText: string;
  }>;
}

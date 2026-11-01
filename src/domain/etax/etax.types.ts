export type ETaxDocumentType =
  | 'T01' // e-Receipt (ใบรับ)
  | 'T02' // Invoice (ใบแจ้งหนี้)
  | 'T03' // e-Tax Invoice (ใบกำกับภาษี)
  | 'T04' // Tax Invoice / Receipt (ใบกำกับภาษี/ใบเสร็จรับเงิน)
  | '80'  // Debit Note (ใบเพิ่มหนี้)
  | '81'; // Credit Note (ใบลดหนี้)

export interface PartyTaxIdentity {
  name: string;
  taxId: string; // 13-digit Thai Tax ID or Citizen ID
  branchCode: string; // 5 digits, '00000' for Head Office (สำนักงานใหญ่)
  address: string;
  province: string;
  postalCode: string;
  countryCode: string; // 'TH'
  email?: string;
  phone?: string;
}

export interface ETaxLineItem {
  itemNumber: number;
  sku: string;
  description: string;
  quantity: number;
  unitCode: string; // e.g. 'C62' (unit) or 'EA'
  unitPrice: number;
  discountAmount?: number;
  lineTotal: number;
  vatExempt?: boolean;
}

export interface ETaxInvoice {
  id: string; // URN identifier
  documentType: ETaxDocumentType;
  invoiceNumber: string;
  issueDate: string; // ISO 8601
  seller: PartyTaxIdentity;
  buyer: PartyTaxIdentity;
  items: ETaxLineItem[];
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  vatRate: number; // 0.07
  vatAmount: number;
  grandTotal: number;
  amountInWords: string; // Thai Baht Text
  quantumSeal?: {
    algorithm: string;
    publicKey: string;
    signature: string;
    digest: string;
    timestamp: string;
  };
  xmlPayload?: string;
  status: 'DRAFT' | 'SEALED' | 'TRANSMITTED_RD' | 'ACKNOWLEDGED_RD' | 'REJECTED_RD';
}

export interface ETaxValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

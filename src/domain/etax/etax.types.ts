export type ETaxDocumentType =
  | 'T01' // e-Receipt (ใบรับ)
  | 'T02' // Invoice (ใบแจ้งหนี้)
  | 'T03' // e-Tax Invoice (ใบกำกับภาษี)
  | 'T04' // Tax Invoice / Receipt (ใบกำกับภาษี/ใบเสร็จรับเงิน)
  | '80'  // Debit Note (ใบเพิ่มหนี้)
  | '81'; // Credit Note (ใบลดหนี้)

export type ETaxPurposeCode =
  | 'CDNG01' // Price decreased (ลดราคาสินค้าเนื่องจากสินค้าผิดข้อกำหนด)
  | 'CDNG02' // Goods returned / damaged (สินค้าชำรุดเสียหาย/ส่งคืน)
  | 'CDNG03' // Service terminated (บอกเลิกสัญญาบริการ)
  | 'CDNG99' // Other credit note purpose (เหตุอื่นตามที่กฎหมายกำหนด)
  | 'DBNG01' // Price increased (คำนวณราคาสินค้าต่ำกว่าความเป็นจริง)
  | 'DBNG02' // Additional quantity (เพิ่มจำนวนสินค้า)
  | 'DBNG99'; // Other debit note purpose

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
  purposeCode?: ETaxPurposeCode;
  purposeReason?: string;
  originalDocumentRef?: {
    id: string;
    issueDate: string;
  };
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
  schemaVersion: string; // 'ETDA v2.1 (ER3-2560)'
  checkedElements: number;
  errors: string[];
  warnings: string[];
  validationDetails?: {
    taxIdValidated: boolean;
    branchCodeValidated: boolean;
    arithmeticValidated: boolean;
    signaturePresent: boolean;
    rootNamespaceValid: boolean;
  };
}

export interface ETaxSandboxSubmissionRequest {
  invoiceNumber: string;
  sellerTaxId: string;
  documentType: ETaxDocumentType;
  xmlPayload: string;
  environment?: 'SANDBOX' | 'PRODUCTION';
}

export interface ETaxSandboxSubmissionResponse {
  transactionId: string;
  statusCode: 'ACK-200' | 'REJ-422' | 'ERR-500';
  statusDescription: string;
  etdaSchemaCompliance: 'COMPLIANT_V2_1' | 'NON_COMPLIANT';
  rdSignature: string;
  receivedAt: string;
  testReceiptUrl: string;
  validationDetails?: ETaxValidationResult;
}

export interface ETaxTransmissionLog {
  id: string;
  transactionId: string;
  invoiceNumber: string;
  sellerTaxId: string;
  documentType: ETaxDocumentType;
  statusCode: string;
  statusDescription: string;
  timestamp: string;
  responsePayload: ETaxSandboxSubmissionResponse;
}

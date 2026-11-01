export type PRStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
export type POStatus = 'ISSUED' | 'ACKNOWLEDGED' | 'FULFILLED' | 'CANCELLED';
export type GRNStatus = 'RECEIVED' | 'PARTIAL' | 'REJECTED';
export type InvoiceStatus = 'PENDING_VERIFICATION' | 'MATCH_APPROVED' | 'MATCH_REJECTED' | 'PAID';

export interface LineItem {
  itemId: string;
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number; // In THB
  lineTotal: number;
}

export interface PurchaseRequisition {
  id: string;
  prNumber: string;
  requesterId: string;
  requesterType: 'HUMAN' | 'AGENT';
  departmentId: string;
  items: LineItem[];
  totalAmount: number;
  justification: string;
  status: PRStatus;
  approverId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  prNumber: string;
  vendorId: string;
  vendorName: string;
  items: LineItem[];
  subtotal: number;
  taxRate: number; // e.g. 0.07 for 7% VAT
  taxAmount: number;
  totalAmount: number;
  status: POStatus;
  issuedAt: string;
  paymentTerms: string;
}

export interface GoodsReceiptItem {
  itemId: string;
  sku: string;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  batchNumber?: string;
  notes?: string;
}

export interface GoodsReceiptNote {
  id: string;
  grnNumber: string;
  poNumber: string;
  warehouseId: string;
  inspectorId: string;
  inspectorType: 'HUMAN' | 'AGENT';
  receivedAt: string;
  items: GoodsReceiptItem[];
  status: GRNStatus;
}

export interface VendorInvoiceItem {
  itemId: string;
  sku: string;
  billedQuantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface VendorInvoice {
  id: string;
  invoiceNumber: string;
  vendorId: string;
  poNumber: string;
  grnNumber?: string;
  invoiceDate: string;
  dueDate: string;
  items: VendorInvoiceItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  bankAccountRef: string;
  status: InvoiceStatus;
}

export type MatchOutcome =
  | 'MATCH_PERFECT'
  | 'MATCH_WITHIN_TOLERANCE'
  | 'MISMATCH_QUANTITY'
  | 'MISMATCH_PRICE'
  | 'MISMATCH_UNORDERED_ITEMS'
  | 'FRAUD_ANOMALY_DETECTED';

export interface MatchDiscrepancy {
  itemId: string;
  sku: string;
  discrepancyType: 'PRICE_VARIANCE' | 'QUANTITY_EXCESS' | 'UNORDERED_ITEM' | 'DEFECTIVE_GOODS';
  expectedValue: number | string;
  actualValue: number | string;
  varianceDelta: number;
  explanation: string;
}

export interface ThreeWayMatchResult {
  id: string;
  invoiceNumber: string;
  poNumber: string;
  grnNumber: string;
  outcome: MatchOutcome;
  isValid: boolean;
  autoApproved: boolean;
  totalDiscrepancies: number;
  discrepancies: MatchDiscrepancy[];
  poTotal: number;
  invoiceTotal: number;
  varianceAmount: number;
  variancePercentage: number;
  auditNotes: string;
  evaluatedAt: string;
}

export interface MatchingPolicyConfig {
  priceTolerancePercentage: number; // e.g. 1.0 (1%)
  maxAutoApprovalThresholdTHB: number; // e.g. 500,000 THB
  strictItemCodeCheck: boolean;
  allowPartialDeliveryBilling: boolean;
}

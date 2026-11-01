import { InMemoryDatabase } from '../../infrastructure/persistence/in-memory-db.js';
import { ThreeWayMatchLogic } from '../../domain/procurement/three-way-match.logic.js';
import {
  PurchaseRequisition,
  PurchaseOrder,
  GoodsReceiptNote,
  VendorInvoice,
  ThreeWayMatchResult,
  MatchingPolicyConfig
} from '../../domain/procurement/procurement.types.js';
import {
  CreatePurchaseRequisitionSchema,
  CreatePurchaseOrderSchema,
  SubmitGoodsReceiptSchema,
  SubmitVendorInvoiceSchema
} from '../dto/schemas.js';
import { SovereignTelemetryBus } from '../../infrastructure/telemetry/sovereign-telemetry.js';

export class ProcurementEngineService {
  private db = InMemoryDatabase.getInstance();

  public createPurchaseRequisition(input: unknown): PurchaseRequisition {
    const validated = CreatePurchaseRequisitionSchema.parse(input);

    const totalAmount = validated.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const prNumber = `PR-${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();

    const pr: PurchaseRequisition = {
      id: `PR-ID-${Date.now()}`,
      prNumber,
      requesterId: validated.requesterId,
      requesterType: validated.requesterType,
      departmentId: validated.departmentId,
      items: validated.items.map(i => ({
        ...i,
        lineTotal: i.quantity * i.unitPrice
      })),
      totalAmount,
      justification: validated.justification,
      status: 'SUBMITTED',
      createdAt: now,
      updatedAt: now
    };

    this.db.purchaseRequisitions.set(pr.prNumber, pr);

    SovereignTelemetryBus.emit(
      'PROCUREMENT',
      'PR_SUBMITTED',
      pr.requesterId,
      pr.requesterType,
      { prNumber: pr.prNumber, totalAmount, itemsCount: pr.items.length }
    );

    return pr;
  }

  public approvePurchaseRequisition(prNumber: string, approverId: string): PurchaseRequisition {
    const pr = this.db.purchaseRequisitions.get(prNumber);
    if (!pr) {
      throw new Error(`Purchase Requisition '${prNumber}' not found.`);
    }

    // Verify approver authority
    const approver = this.db.employees.get(approverId);
    const approverAgent = this.db.agents.get(approverId);

    const limit = approver ? approver.approvalLimit : approverAgent ? approverAgent.spendingLimit : 0;
    if (limit < pr.totalAmount) {
      throw new Error(`Approver '${approverId}' has limit ${limit.toLocaleString()} THB, which is insufficient for PR amount ${pr.totalAmount.toLocaleString()} THB.`);
    }

    pr.status = 'APPROVED';
    pr.approverId = approverId;
    pr.updatedAt = new Date().toISOString();

    SovereignTelemetryBus.emit(
      'PROCUREMENT',
      'PR_APPROVED',
      approverId,
      approver ? 'HUMAN' : 'AGENT',
      { prNumber, approvedAmount: pr.totalAmount }
    );

    return pr;
  }

  public generatePurchaseOrder(input: unknown): PurchaseOrder {
    const validated = CreatePurchaseOrderSchema.parse(input);
    const pr = this.db.purchaseRequisitions.get(validated.prNumber);
    if (!pr) {
      throw new Error(`Purchase Requisition '${validated.prNumber}' not found.`);
    }
    if (pr.status !== 'APPROVED') {
      throw new Error(`Cannot issue PO for unapproved PR '${validated.prNumber}' (status: ${pr.status}).`);
    }

    const poNumber = `PO-${Date.now().toString().slice(-6)}`;
    const subtotal = pr.totalAmount;
    const taxAmount = Math.round(subtotal * validated.taxRate * 100) / 100;
    const totalAmount = subtotal + taxAmount;

    const po: PurchaseOrder = {
      id: `PO-ID-${Date.now()}`,
      poNumber,
      prNumber: pr.prNumber,
      vendorId: validated.vendorId,
      vendorName: validated.vendorName,
      items: pr.items,
      subtotal,
      taxRate: validated.taxRate,
      taxAmount,
      totalAmount,
      status: 'ISSUED',
      issuedAt: new Date().toISOString(),
      paymentTerms: validated.paymentTerms
    };

    this.db.purchaseOrders.set(po.poNumber, po);

    SovereignTelemetryBus.emit(
      'PROCUREMENT',
      'PO_ISSUED',
      validated.vendorId,
      'SYSTEM',
      { poNumber, vendor: validated.vendorName, totalAmount }
    );

    return po;
  }

  public submitGoodsReceipt(input: unknown): GoodsReceiptNote {
    const validated = SubmitGoodsReceiptSchema.parse(input);
    const po = this.db.purchaseOrders.get(validated.poNumber);
    if (!po) {
      throw new Error(`Referenced PO '${validated.poNumber}' not found.`);
    }

    const grnNumber = `GRN-${Date.now().toString().slice(-6)}`;
    const grn: GoodsReceiptNote = {
      id: `GRN-ID-${Date.now()}`,
      grnNumber,
      poNumber: validated.poNumber,
      warehouseId: validated.warehouseId,
      inspectorId: validated.inspectorId,
      inspectorType: validated.inspectorType,
      receivedAt: new Date().toISOString(),
      items: validated.items,
      status: validated.items.every(i => i.rejectedQuantity === 0) ? 'RECEIVED' : 'PARTIAL'
    };

    this.db.goodsReceipts.set(grn.grnNumber, grn);

    SovereignTelemetryBus.emit(
      'PROCUREMENT',
      'GRN_RECORDED',
      validated.inspectorId,
      validated.inspectorType,
      { grnNumber, poNumber: po.poNumber, status: grn.status }
    );

    return grn;
  }

  public submitVendorInvoice(input: unknown): VendorInvoice {
    const validated = SubmitVendorInvoiceSchema.parse(input);
    const po = this.db.purchaseOrders.get(validated.poNumber);
    if (!po) {
      throw new Error(`Referenced PO '${validated.poNumber}' not found for invoice.`);
    }

    const items = validated.items.map(i => ({
      ...i,
      lineTotal: i.billedQuantity * i.unitPrice
    }));

    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const taxAmount = Math.round(subtotal * validated.taxRate * 100) / 100;
    const totalAmount = subtotal + taxAmount;

    const invoice: VendorInvoice = {
      id: `INV-ID-${Date.now()}`,
      invoiceNumber: validated.invoiceNumber,
      vendorId: validated.vendorId,
      poNumber: validated.poNumber,
      grnNumber: validated.grnNumber,
      invoiceDate: new Date().toISOString(),
      dueDate: validated.dueDate,
      items,
      subtotal,
      taxAmount,
      totalAmount,
      bankAccountRef: validated.bankAccountRef,
      status: 'PENDING_VERIFICATION'
    };

    this.db.invoices.set(invoice.invoiceNumber, invoice);

    SovereignTelemetryBus.emit(
      'PROCUREMENT',
      'INVOICE_SUBMITTED',
      validated.vendorId,
      'SYSTEM',
      { invoiceNumber: invoice.invoiceNumber, poNumber: po.poNumber, totalAmount }
    );

    return invoice;
  }

  public executeThreeWayMatch(
    invoiceNumber: string,
    customPolicy?: MatchingPolicyConfig
  ): ThreeWayMatchResult {
    const invoice = this.db.invoices.get(invoiceNumber);
    if (!invoice) {
      throw new Error(`Invoice '${invoiceNumber}' not found.`);
    }

    const po = this.db.purchaseOrders.get(invoice.poNumber);
    if (!po) {
      throw new Error(`Purchase Order '${invoice.poNumber}' not found.`);
    }

    // Find associated GRN
    let grn: GoodsReceiptNote | undefined;
    if (invoice.grnNumber) {
      grn = this.db.goodsReceipts.get(invoice.grnNumber);
    } else {
      // Find latest GRN for this PO
      grn = Array.from(this.db.goodsReceipts.values()).find(g => g.poNumber === po.poNumber);
    }

    if (!grn) {
      throw new Error(`No Goods Receipt Note found for PO '${po.poNumber}'. Cannot perform 3-Way Match.`);
    }

    const matchResult = ThreeWayMatchLogic.evaluate(po, grn, invoice, customPolicy);
    this.db.matchResults.set(matchResult.invoiceNumber, matchResult);

    if (matchResult.isValid) {
      invoice.status = 'MATCH_APPROVED';
      if (matchResult.autoApproved) {
        po.status = 'FULFILLED';
      }
    } else {
      invoice.status = 'MATCH_REJECTED';
    }

    SovereignTelemetryBus.emit(
      'PROCUREMENT',
      'THREE_WAY_MATCH_COMPLETED',
      'AGT-P2P-MATCHER',
      'AGENT',
      {
        invoiceNumber,
        outcome: matchResult.outcome,
        isValid: matchResult.isValid,
        autoApproved: matchResult.autoApproved,
        varianceAmount: matchResult.varianceAmount
      }
    );

    return matchResult;
  }

  public listPurchaseOrders(): PurchaseOrder[] {
    return Array.from(this.db.purchaseOrders.values());
  }

  public listInvoices(): VendorInvoice[] {
    return Array.from(this.db.invoices.values());
  }

  public listMatchResults(): ThreeWayMatchResult[] {
    return Array.from(this.db.matchResults.values());
  }
}

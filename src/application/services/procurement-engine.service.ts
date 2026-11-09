import { InMemoryDatabase } from '../../infrastructure/persistence/in-memory-db.js';
import { ThreeWayMatchLogic } from '../../domain/procurement/three-way-match.logic.js';
import {
  PurchaseRequisition,
  PurchaseOrder,
  GoodsReceiptNote,
  VendorInvoice,
  ThreeWayMatchResult,
  MatchingPolicyConfig,
  HumanPaymentApproval
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
    const taxRate = validated.taxRate ?? 0.07;
    const taxAmount = subtotal * taxRate;
    const totalAmount = subtotal + taxAmount;

    const po: PurchaseOrder = {
      id: `PO-ID-${Date.now()}`,
      poNumber,
      prNumber: pr.prNumber,
      vendorId: validated.vendorId,
      vendorName: validated.vendorName,
      items: pr.items.map(i => ({ ...i })),
      subtotal,
      taxRate,
      taxAmount,
      totalAmount,
      status: 'ISSUED',
      issuedAt: new Date().toISOString(),
      paymentTerms: validated.paymentTerms ?? 'Net 30'
    };

    this.db.purchaseOrders.set(po.poNumber, po);

    SovereignTelemetryBus.emit(
      'PROCUREMENT',
      'PO_ISSUED',
      pr.requesterId,
      'SYSTEM',
      { poNumber: po.poNumber, vendorId: po.vendorId, totalAmount: po.totalAmount }
    );

    return po;
  }

  public submitGoodsReceipt(input: unknown): GoodsReceiptNote {
    const validated = SubmitGoodsReceiptSchema.parse(input);
    const po = this.db.purchaseOrders.get(validated.poNumber);
    if (!po) {
      throw new Error(`Purchase Order '${validated.poNumber}' not found.`);
    }
    if (po.status !== 'ISSUED' && po.status !== 'ACKNOWLEDGED') {
      throw new Error(`Cannot record goods receipt for PO in state '${po.status}'.`);
    }

    const grnNumber = `GRN-${Date.now().toString().slice(-6)}`;
    const items = validated.items.map(i => ({
      itemId: i.itemId,
      sku: i.sku,
      receivedQuantity: i.receivedQuantity,
      acceptedQuantity: i.acceptedQuantity,
      rejectedQuantity: i.rejectedQuantity,
      batchNumber: i.batchNumber,
      notes: i.notes
    }));

    const hasRejections = items.some(i => i.rejectedQuantity > 0);

    const grn: GoodsReceiptNote = {
      id: `GRN-ID-${Date.now()}`,
      grnNumber,
      poNumber: po.poNumber,
      warehouseId: validated.warehouseId,
      inspectorId: validated.inspectorId,
      inspectorType: validated.inspectorType,
      receivedAt: new Date().toISOString(),
      items,
      status: hasRejections ? 'PARTIAL' : 'RECEIVED'
    };

    this.db.goodsReceipts.set(grn.grnNumber, grn);

    SovereignTelemetryBus.emit(
      'PROCUREMENT',
      'GRN_RECORDED',
      validated.inspectorId,
      validated.inspectorType,
      { grnNumber: grn.grnNumber, poNumber: po.poNumber, status: grn.status }
    );

    return grn;
  }

  public submitVendorInvoice(input: unknown): VendorInvoice {
    const validated = SubmitVendorInvoiceSchema.parse(input);
    const po = this.db.purchaseOrders.get(validated.poNumber);
    if (!po) {
      throw new Error(`Purchase Order '${validated.poNumber}' not found.`);
    }

    const items = validated.items.map(i => ({
      itemId: i.itemId,
      sku: i.sku,
      billedQuantity: i.billedQuantity,
      unitPrice: i.unitPrice,
      lineTotal: i.billedQuantity * i.unitPrice
    }));

    const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
    const taxRate = validated.taxRate ?? 0.07;
    const taxAmount = subtotal * taxRate;
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
      if (matchResult.autoApproved) {
        invoice.status = 'MATCH_APPROVED';
        po.status = 'FULFILLED';
      } else {
        // Exceeds autonomous agent limit -> Hold for Human-in-the-Loop controller authorization
        invoice.status = 'PENDING_HUMAN_APPROVAL';
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
        requiresHumanApproval: matchResult.requiresHumanApproval,
        varianceAmount: matchResult.varianceAmount
      }
    );

    return matchResult;
  }

  /**
   * Human-in-the-Loop (HITL) Payment Approval
   * Authorizes disbursement for a 3-Way Matched invoice exceeding agent financial authority.
   */
  public approvePaymentDisbursement(
    invoiceNumber: string,
    approverId: string,
    remark?: string,
    whtRate: number = 0.01,
    disbursementChannel: string = 'SCB_CORPORATE_CONNECT'
  ): {
    invoice: VendorInvoice;
    approval: HumanPaymentApproval;
  } {
    const invoice = this.db.invoices.get(invoiceNumber);
    if (!invoice) {
      throw new Error(`Invoice '${invoiceNumber}' not found.`);
    }

    const approver = this.db.employees.get(approverId);
    if (!approver) {
      throw new Error(`Authorized employee '${approverId}' not found in workforce directory.`);
    }

    if (approver.approvalLimit < invoice.totalAmount) {
      throw new Error(
        `Insufficient approval authority: Approver '${approver.name}' has limit of ${approver.approvalLimit.toLocaleString()} THB, but invoice total is ${invoice.totalAmount.toLocaleString()} THB.`
      );
    }

    // Calculate Withholding Tax (WHT) on pre-VAT subtotal
    const whtAmount = Math.round(invoice.subtotal * whtRate * 100) / 100;
    const netPayableAmount = Math.round((invoice.totalAmount - whtAmount) * 100) / 100;
    const authStamp = `HITL-AUTH-${Date.now().toString(16).toUpperCase()}-${approverId}`;

    const approval: HumanPaymentApproval = {
      approvedBy: approverId,
      approverName: approver.name,
      approverRole: approver.title,
      approvedAt: new Date().toISOString(),
      disbursementChannel,
      whtRate,
      whtAmount,
      netPayableAmount,
      authorizationStamp: authStamp,
      remark: remark || 'Human-in-the-Loop financial controller approval released.'
    };

    invoice.status = 'PAYMENT_AUTHORIZED';
    invoice.humanApproval = approval;

    const po = this.db.purchaseOrders.get(invoice.poNumber);
    if (po) {
      po.status = 'FULFILLED';
    }

    SovereignTelemetryBus.emit(
      'PROCUREMENT',
      'P2P_HUMAN_PAYMENT_APPROVED',
      approverId,
      'HUMAN',
      {
        invoiceNumber,
        poNumber: invoice.poNumber,
        totalAmount: invoice.totalAmount,
        whtAmount,
        netPayableAmount,
        disbursementChannel,
        authorizationStamp: authStamp
      }
    );

    return {
      invoice,
      approval
    };
  }

  public rejectPayment(
    invoiceNumber: string,
    reviewerId: string,
    reason: string
  ): VendorInvoice {
    const invoice = this.db.invoices.get(invoiceNumber);
    if (!invoice) {
      throw new Error(`Invoice '${invoiceNumber}' not found.`);
    }

    invoice.status = 'MATCH_REJECTED';

    SovereignTelemetryBus.emit(
      'PROCUREMENT',
      'P2P_PAYMENT_REJECTED',
      reviewerId,
      'HUMAN',
      {
        invoiceNumber,
        reviewerId,
        reason
      }
    );

    return invoice;
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

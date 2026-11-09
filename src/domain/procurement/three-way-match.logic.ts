import {
  PurchaseOrder,
  GoodsReceiptNote,
  VendorInvoice,
  ThreeWayMatchResult,
  MatchOutcome,
  MatchDiscrepancy,
  MatchingPolicyConfig
} from './procurement.types.js';

export class ThreeWayMatchLogic {
  static readonly DEFAULT_POLICY: MatchingPolicyConfig = {
    priceTolerancePercentage: 1.0, // 1% tolerance
    maxAutoApprovalThresholdTHB: 500_000, // 500,000 THB max auto approval limit
    strictItemCodeCheck: true,
    allowPartialDeliveryBilling: true
  };

  /**
   * Executes autonomous 3-Way Matching across Purchase Order, Goods Receipt Note, and Vendor Invoice.
   */
  static evaluate(
    po: PurchaseOrder,
    grn: GoodsReceiptNote,
    invoice: VendorInvoice,
    policy: MatchingPolicyConfig = this.DEFAULT_POLICY
  ): ThreeWayMatchResult {
    const discrepancies: MatchDiscrepancy[] = [];

    // Basic consistency check
    if (invoice.poNumber !== po.poNumber || grn.poNumber !== po.poNumber) {
      discrepancies.push({
        itemId: 'HEADER_MISMATCH',
        sku: 'PO_REF',
        discrepancyType: 'UNORDERED_ITEM',
        expectedValue: po.poNumber,
        actualValue: `Inv:${invoice.poNumber}, GRN:${grn.poNumber}`,
        varianceDelta: 0,
        explanation: 'Reference PO numbers do not match across documents.'
      });
    }

    // Check for negative or absurd amounts (Fraud anomaly)
    if (invoice.totalAmount <= 0 || invoice.subtotal < 0) {
      return {
        id: `MATCH-${Date.now()}`,
        invoiceNumber: invoice.invoiceNumber,
        poNumber: po.poNumber,
        grnNumber: grn.grnNumber,
        outcome: 'FRAUD_ANOMALY_DETECTED',
        isValid: false,
        autoApproved: false,
        requiresHumanApproval: false,
        totalDiscrepancies: 1,
        discrepancies: [{
          itemId: 'INVOICE_TOTAL',
          sku: 'AMOUNT_CHECK',
          discrepancyType: 'PRICE_VARIANCE',
          expectedValue: '> 0',
          actualValue: invoice.totalAmount,
          varianceDelta: invoice.totalAmount,
          explanation: 'Fraud Anomaly: Negative or zero invoice amount detected.'
        }],
        poTotal: po.totalAmount,
        invoiceTotal: invoice.totalAmount,
        varianceAmount: Math.abs(invoice.totalAmount - po.totalAmount),
        variancePercentage: 100,
        auditNotes: 'Immediate security alert: Anomaly detected in invoice financial fields.',
        evaluatedAt: new Date().toISOString()
      };
    }

    const poItemMap = new Map(po.items.map(i => [i.sku, i]));
    const grnItemMap = new Map(grn.items.map(i => [i.sku, i]));

    let hasPriceMismatch = false;
    let hasQuantityMismatch = false;
    let hasUnorderedMismatch = false;

    for (const invItem of invoice.items) {
      const poItem = poItemMap.get(invItem.sku);
      const grnItem = grnItemMap.get(invItem.sku);

      // 1. Unordered item check
      if (!poItem) {
        hasUnorderedMismatch = true;
        discrepancies.push({
          itemId: invItem.itemId,
          sku: invItem.sku,
          discrepancyType: 'UNORDERED_ITEM',
          expectedValue: 'Present in PO',
          actualValue: 'Not ordered',
          varianceDelta: invItem.lineTotal,
          explanation: `Item ${invItem.sku} is present on the invoice but was never ordered in PO ${po.poNumber}.`
        });
        continue;
      }

      // 2. Goods receipt quantity check
      if (!grnItem) {
        hasQuantityMismatch = true;
        discrepancies.push({
          itemId: invItem.itemId,
          sku: invItem.sku,
          discrepancyType: 'QUANTITY_EXCESS',
          expectedValue: 0,
          actualValue: invItem.billedQuantity,
          varianceDelta: invItem.billedQuantity,
          explanation: `Item ${invItem.sku} was billed for ${invItem.billedQuantity} units, but 0 units were recorded in GRN ${grn.grnNumber}.`
        });
      } else {
        // Cannot bill more than accepted quantity
        if (invItem.billedQuantity > grnItem.acceptedQuantity) {
          hasQuantityMismatch = true;
          const excess = invItem.billedQuantity - grnItem.acceptedQuantity;
          discrepancies.push({
            itemId: invItem.itemId,
            sku: invItem.sku,
            discrepancyType: 'QUANTITY_EXCESS',
            expectedValue: grnItem.acceptedQuantity,
            actualValue: invItem.billedQuantity,
            varianceDelta: excess,
            explanation: `Billed quantity (${invItem.billedQuantity}) exceeds accepted received quantity (${grnItem.acceptedQuantity}) by ${excess} units.`
          });
        }
      }

      // 3. Price tolerance check
      const priceDelta = invItem.unitPrice - poItem.unitPrice;
      const priceVariancePercent = (priceDelta / poItem.unitPrice) * 100;

      if (priceDelta > 0) {
        if (priceVariancePercent > policy.priceTolerancePercentage) {
          hasPriceMismatch = true;
          discrepancies.push({
            itemId: invItem.itemId,
            sku: invItem.sku,
            discrepancyType: 'PRICE_VARIANCE',
            expectedValue: poItem.unitPrice,
            actualValue: invItem.unitPrice,
            varianceDelta: priceDelta,
            explanation: `Billed price (${invItem.unitPrice} THB) exceeds PO price (${poItem.unitPrice} THB) by ${priceVariancePercent.toFixed(2)}%, exceeding tolerance of ${policy.priceTolerancePercentage}%.`
          });
        }
      }
    }

    // Determine final outcome
    let outcome: MatchOutcome;
    if (hasUnorderedMismatch) {
      outcome = 'MISMATCH_UNORDERED_ITEMS';
    } else if (hasQuantityMismatch) {
      outcome = 'MISMATCH_QUANTITY';
    } else if (hasPriceMismatch) {
      outcome = 'MISMATCH_PRICE';
    } else if (discrepancies.length === 0) {
      outcome = 'MATCH_PERFECT';
    } else {
      outcome = 'MATCH_WITHIN_TOLERANCE';
    }

    const varianceAmount = Math.abs(invoice.totalAmount - po.totalAmount);
    const variancePercentage = po.totalAmount > 0 ? (varianceAmount / po.totalAmount) * 100 : 0;
    const isValid = outcome === 'MATCH_PERFECT' || outcome === 'MATCH_WITHIN_TOLERANCE';

    // Auto-approval rule
    const autoApproved = isValid && invoice.totalAmount <= policy.maxAutoApprovalThresholdTHB;
    const requiresHumanApproval = isValid && !autoApproved;

    let auditNotes: string;
    if (outcome === 'MATCH_PERFECT') {
      auditNotes = autoApproved
        ? `Autonomous 3-Way Match Verified: Perfect match across PO ${po.poNumber}, GRN ${grn.grnNumber}, and Invoice ${invoice.invoiceNumber}. Auto-approved for payment.`
        : `Autonomous 3-Way Match Verified: Perfect match across PO ${po.poNumber}, GRN ${grn.grnNumber}, and Invoice ${invoice.invoiceNumber}. Amount (${invoice.totalAmount.toLocaleString()} THB) exceeds agent limit; Human-in-the-Loop authorization required.`;
    } else if (outcome === 'MATCH_WITHIN_TOLERANCE') {
      auditNotes = `Autonomous 3-Way Match Verified: Minor variance (${variancePercentage.toFixed(2)}%) within permitted policy threshold (${policy.priceTolerancePercentage}%).`;
    } else {
      auditNotes = `Autonomous 3-Way Match FAILED: ${discrepancies.length} discrepancy(s) flagged for manual intervention or vendor dispute.`;
    }

    return {
      id: `MATCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      invoiceNumber: invoice.invoiceNumber,
      poNumber: po.poNumber,
      grnNumber: grn.grnNumber,
      outcome,
      isValid,
      autoApproved,
      requiresHumanApproval,
      totalDiscrepancies: discrepancies.length,
      discrepancies,
      poTotal: po.totalAmount,
      invoiceTotal: invoice.totalAmount,
      varianceAmount,
      variancePercentage,
      auditNotes,
      evaluatedAt: new Date().toISOString()
    };
  }
}

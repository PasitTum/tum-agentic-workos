import {
  ETaxInvoice,
  PartyTaxIdentity,
  ETaxValidationResult
} from './etax.types.js';

export class ETaxValidatorLogic {
  /**
   * Validates Thai 13-digit Tax ID / Citizen ID checksum (Modulo 11).
   */
  static validateThaiTaxId(taxId: string): boolean {
    if (!/^\d{13}$/.test(taxId)) {
      return false;
    }

    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(taxId[i]!, 10) * (13 - i);
    }

    const checkDigit = (11 - (sum % 11)) % 10;
    return checkDigit === parseInt(taxId[12]!, 10);
  }

  /**
   * Validates a 5-digit branch code (e.g. 00000).
   */
  static validateBranchCode(branchCode: string): boolean {
    return /^\d{5}$/.test(branchCode);
  }

  /**
   * Validates Party Tax Identity according to Revenue Department standards.
   */
  static validateParty(party: PartyTaxIdentity, role: 'Seller' | 'Buyer'): string[] {
    const errors: string[] = [];

    if (!party.name || party.name.trim().length === 0) {
      errors.push(`${role} name is required.`);
    }

    if (!this.validateThaiTaxId(party.taxId)) {
      errors.push(`${role} Tax ID '${party.taxId}' fails the official 13-digit Modulo 11 checksum.`);
    }

    if (!this.validateBranchCode(party.branchCode)) {
      errors.push(`${role} Branch Code '${party.branchCode}' must be a 5-digit numeric string (e.g. '00000' for Head Office).`);
    }

    if (!party.postalCode || !/^\d{5}$/.test(party.postalCode)) {
      errors.push(`${role} postal code must be a 5-digit numeric string.`);
    }

    return errors;
  }

  /**
   * Performs full e-Tax Invoice validation against ETDA / RD rules.
   */
  static validateInvoice(invoice: ETaxInvoice): ETaxValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Party identity checks
    errors.push(...this.validateParty(invoice.seller, 'Seller'));
    errors.push(...this.validateParty(invoice.buyer, 'Buyer'));

    // 2. Line items check
    if (!invoice.items || invoice.items.length === 0) {
      errors.push('e-Tax Invoice must contain at least 1 line item.');
    } else {
      let calculatedSubtotal = 0;
      invoice.items.forEach((item, idx) => {
        if (item.quantity <= 0) {
          errors.push(`Item ${idx + 1} (${item.sku}): quantity must be positive.`);
        }
        if (item.unitPrice < 0) {
          errors.push(`Item ${idx + 1} (${item.sku}): unit price cannot be negative.`);
        }
        const expectedTotal = Math.round((item.quantity * item.unitPrice - (item.discountAmount || 0)) * 100) / 100;
        if (Math.abs(item.lineTotal - expectedTotal) > 0.05) {
          errors.push(`Item ${idx + 1} (${item.sku}): line total mismatch. Expected ${expectedTotal}, got ${item.lineTotal}.`);
        }
        calculatedSubtotal += item.lineTotal;
      });

      // 3. Tax and total calculations check
      const diffSubtotal = Math.abs(invoice.subtotal - calculatedSubtotal);
      if (diffSubtotal > 0.05) {
        errors.push(`Invoice subtotal mismatch: items sum to ${calculatedSubtotal}, but declared subtotal is ${invoice.subtotal}.`);
      }

      const expectedVat = Math.round(invoice.taxableAmount * invoice.vatRate * 100) / 100;
      if (Math.abs(invoice.vatAmount - expectedVat) > 0.05) {
        errors.push(`VAT calculation variance: expected ${expectedVat} (${invoice.vatRate * 100}%), got ${invoice.vatAmount}.`);
      }

      const expectedGrandTotal = Math.round((invoice.taxableAmount + invoice.vatAmount) * 100) / 100;
      if (Math.abs(invoice.grandTotal - expectedGrandTotal) > 0.05) {
        errors.push(`Grand total mismatch: expected ${expectedGrandTotal}, got ${invoice.grandTotal}.`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

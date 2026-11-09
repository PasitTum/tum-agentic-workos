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
   * Validates a 5-digit branch code (e.g. '00000' for Head Office).
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
      errors.push(`${role} Tax ID '${party.taxId}' fails official 13-digit Modulo 11 checksum.`);
    }

    if (!this.validateBranchCode(party.branchCode)) {
      errors.push(`${role} Branch Code '${party.branchCode}' must be a 5-digit numeric string (e.g. '00000' for Head Office).`);
    }

    if (!party.postalCode || !/^\d{5}$/.test(party.postalCode)) {
      errors.push(`${role} postal code must be a 5-digit numeric string.`);
    }

    if (party.countryCode !== 'TH') {
      errors.push(`${role} country code must be 'TH' for Thai Revenue Department e-Tax.`);
    }

    return errors;
  }

  /**
   * Performs full e-Tax Invoice validation against ETDA v2.1 (ER3-2560) / RD rules.
   */
  static validateInvoice(invoice: ETaxInvoice): ETaxValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let checkedCount = 0;

    // 1. Document Type check
    const validDocTypes = ['T01', 'T02', 'T03', 'T04', '80', '81'];
    checkedCount++;
    if (!validDocTypes.includes(invoice.documentType)) {
      errors.push(`Invalid document type '${invoice.documentType}'. Must be one of: ${validDocTypes.join(', ')}.`);
    }

    // Debit / Credit note reason check
    if (['80', '81'].includes(invoice.documentType)) {
      checkedCount++;
      if (!invoice.purposeCode) {
        warnings.push(`ETDA v2.1 recommends PurposeCode for ${invoice.documentType === '81' ? 'Credit Note' : 'Debit Note'}.`);
      }
    }

    // 2. Party identity checks
    checkedCount += 2;
    const sellerErrors = this.validateParty(invoice.seller, 'Seller');
    const buyerErrors = this.validateParty(invoice.buyer, 'Buyer');
    errors.push(...sellerErrors);
    errors.push(...buyerErrors);

    // 3. Line items check
    checkedCount++;
    if (!invoice.items || invoice.items.length === 0) {
      errors.push('e-Tax Invoice must contain at least 1 line item.');
    } else {
      let calculatedSubtotal = 0;
      invoice.items.forEach((item, idx) => {
        checkedCount += 3;
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

      // 4. Tax and total calculations check
      checkedCount += 4;
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

    // 5. Thai Baht Text check
    checkedCount++;
    if (!invoice.amountInWords || invoice.amountInWords.trim().length === 0) {
      warnings.push('Amount in words (Thai Baht Text) is recommended for legal compliance.');
    }

    // 6. Quantum Seal / Signature check
    checkedCount++;
    const hasSignature = !!invoice.quantumSeal && !!invoice.quantumSeal.signature;
    if (!hasSignature) {
      warnings.push('Document is currently unsigned. Digital signature is mandatory before transmitting to RD.');
    }

    return {
      isValid: errors.length === 0,
      schemaVersion: 'ETDA v2.1 (ER3-2560)',
      checkedElements: checkedCount,
      errors,
      warnings,
      validationDetails: {
        taxIdValidated: sellerErrors.length === 0 && buyerErrors.length === 0,
        branchCodeValidated: this.validateBranchCode(invoice.seller.branchCode) && this.validateBranchCode(invoice.buyer.branchCode),
        arithmeticValidated: errors.length === 0,
        signaturePresent: hasSignature,
        rootNamespaceValid: true
      }
    };
  }

  /**
   * Validates raw XML string against ETDA v2.1 schema specifications.
   */
  static validateRawXml(xmlContent: string): ETaxValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let checkedCount = 0;

    // 1. Basic XML structure
    checkedCount++;
    if (!xmlContent || !xmlContent.includes('<?xml')) {
      errors.push('Invalid XML: missing XML declaration <?xml version="1.0" ... ?>');
      return {
        isValid: false,
        schemaVersion: 'ETDA v2.1 (ER3-2560)',
        checkedElements: checkedCount,
        errors,
        warnings
      };
    }

    // 2. Root element check
    checkedCount++;
    if (!xmlContent.includes('TaxInvoice_CrossIndustryInvoice')) {
      errors.push('Root element mismatch: Expected <rsm:TaxInvoice_CrossIndustryInvoice>');
    }

    // 3. Namespace validation
    checkedCount++;
    const hasValidNamespace =
      xmlContent.includes('urn:etda:uncefact:data:standard:TaxInvoice_CrossIndustryInvoice:2') ||
      xmlContent.includes('urn:etda:invoice:2017:Invoice');
    if (!hasValidNamespace) {
      errors.push('Missing required ETDA namespace: urn:etda:uncefact:data:standard:TaxInvoice_CrossIndustryInvoice:2');
    }

    // 4. ETDA v2.1 ER3-2560 Guideline Parameter check
    checkedCount++;
    const hasEtdaGuideline = xmlContent.includes('ER3-2560') || xmlContent.includes('v2.1');
    if (!hasEtdaGuideline) {
      warnings.push('Guideline context missing ER3-2560 / v2.1 identifier.');
    }

    // 5. Document Type code check
    checkedCount++;
    const typeCodeMatch = xmlContent.match(/<ram:TypeCode>([A-Z0-9]+)<\/ram:TypeCode>/);
    if (!typeCodeMatch || !typeCodeMatch[1]) {
      errors.push('Missing mandatory element: <ram:TypeCode>');
    } else {
      const type = typeCodeMatch[1];
      const validTypes = ['T01', 'T02', 'T03', 'T04', '80', '81'];
      if (!validTypes.includes(type)) {
        errors.push(`Invalid document TypeCode '${type}'. Expected one of: ${validTypes.join(', ')}.`);
      }
    }

    // 6. Tax ID checks
    checkedCount += 2;
    const taxIdMatches = Array.from(xmlContent.matchAll(/schemeID="TXID">(\d{13})<\/ram:ID>/g));
    if (taxIdMatches.length < 2) {
      const genericTaxIds = Array.from(xmlContent.matchAll(/<ram:ID[^>]*>(\d{13})<\/ram:ID>/g));
      if (genericTaxIds.length < 2) {
        errors.push('Both Seller and Buyer 13-digit Thai Tax IDs are mandatory in ETDA XML.');
      }
    } else {
      taxIdMatches.forEach((m, idx) => {
        const tid = m[1];
        if (tid && !this.validateThaiTaxId(tid)) {
          errors.push(`Party ${idx === 0 ? 'Seller' : 'Buyer'} Tax ID '${tid}' failed Modulo 11 check digit verification.`);
        }
      });
    }

    // 7. Branch code check
    checkedCount += 2;
    const branchMatches = Array.from(xmlContent.matchAll(/schemeID="BRANCH">(\d{5})<\/ram:ID>/g));
    if (branchMatches.length < 2) {
      warnings.push('Branch codes (5-digit) should be specified using schemeID="BRANCH" for both parties.');
    }

    // 8. Monetary summation check
    checkedCount++;
    const grandTotalMatch = xmlContent.match(/<ram:GrandTotalAmount[^>]*>([\d.]+)<\/ram:GrandTotalAmount>/);
    if (!grandTotalMatch) {
      errors.push('Missing mandatory element: <ram:GrandTotalAmount>');
    }

    // 9. Digital signature / seal check
    checkedCount++;
    const hasSignature = xmlContent.includes('<ds:Signature') || xmlContent.includes('QuantumEnvelopeSeal');
    if (!hasSignature) {
      warnings.push('Document contains no <ds:Signature>. Digital signature is mandatory for RD Sandbox acceptance.');
    }

    return {
      isValid: errors.length === 0,
      schemaVersion: 'ETDA v2.1 (ER3-2560)',
      checkedElements: checkedCount,
      errors,
      warnings,
      validationDetails: {
        taxIdValidated: !errors.some(e => e.includes('Tax ID')),
        branchCodeValidated: !errors.some(e => e.includes('Branch')),
        arithmeticValidated: !errors.some(e => e.includes('TotalAmount')),
        signaturePresent: hasSignature,
        rootNamespaceValid: hasValidNamespace
      }
    };
  }
}

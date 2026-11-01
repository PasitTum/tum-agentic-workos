import { QuantumCryptoService } from '../../infrastructure/crypto/quantum-crypto.js';
import { ETaxValidatorLogic } from '../../domain/etax/etax-validator.logic.js';
import { ETaxXmlBuilderLogic } from '../../domain/etax/etax-xml-builder.logic.js';
import { bahtText } from '../../domain/etax/baht-text.js';
import {
  ETaxInvoice,
  PartyTaxIdentity,
  ETaxLineItem,
  ETaxDocumentType
} from '../../domain/etax/etax.types.js';
import { SovereignTelemetryBus } from '../../infrastructure/telemetry/sovereign-telemetry.js';

export interface CreateETaxInvoiceRequest {
  documentType?: ETaxDocumentType;
  invoiceNumber: string;
  seller: PartyTaxIdentity;
  buyer: PartyTaxIdentity;
  items: Array<{
    itemNumber: number;
    sku: string;
    description: string;
    quantity: number;
    unitCode?: string;
    unitPrice: number;
    discountAmount?: number;
  }>;
  vatRate?: number;
}

export class ETaxService {
  private eTaxInvoices = new Map<string, ETaxInvoice>();
  private sovereignKeyPair = QuantumCryptoService.generateKeyPair('NIST-FIPS-204-ML-DSA-65');

  public generateAndSealInvoice(request: CreateETaxInvoiceRequest): ETaxInvoice {
    const vatRate = request.vatRate ?? 0.07;
    const documentType = request.documentType ?? 'T03';

    // Calculate line items
    const items: ETaxLineItem[] = request.items.map(item => {
      const discount = item.discountAmount ?? 0;
      const lineTotal = Math.round((item.quantity * item.unitPrice - discount) * 100) / 100;
      return {
        itemNumber: item.itemNumber,
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        unitCode: item.unitCode ?? 'C62',
        unitPrice: item.unitPrice,
        discountAmount: discount,
        lineTotal
      };
    });

    const subtotal = Math.round(items.reduce((sum, i) => sum + i.lineTotal, 0) * 100) / 100;
    const taxableAmount = subtotal;
    const vatAmount = Math.round(taxableAmount * vatRate * 100) / 100;
    const grandTotal = Math.round((taxableAmount + vatAmount) * 100) / 100;
    const amountInWords = bahtText(grandTotal);

    const draftInvoice: ETaxInvoice = {
      id: `urn:etda:etax:${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      documentType,
      invoiceNumber: request.invoiceNumber,
      issueDate: new Date().toISOString(),
      seller: request.seller,
      buyer: request.buyer,
      items,
      subtotal,
      totalDiscount: 0,
      taxableAmount,
      vatRate,
      vatAmount,
      grandTotal,
      amountInWords,
      status: 'DRAFT'
    };

    // 1. Strict ETDA & Revenue Department Schema Validation
    const validation = ETaxValidatorLogic.validateInvoice(draftInvoice);
    if (!validation.isValid) {
      throw new Error(`e-Tax Invoice validation failed:\n${validation.errors.join('\n')}`);
    }

    // 2. Cryptographic Quantum e-Seal (NIST FIPS 204 ML-DSA-65)
    const envelope = QuantumCryptoService.signEnvelope({
      invoiceNumber: draftInvoice.invoiceNumber,
      sellerTaxId: draftInvoice.seller.taxId,
      buyerTaxId: draftInvoice.buyer.taxId,
      grandTotal: draftInvoice.grandTotal,
      issueDate: draftInvoice.issueDate
    }, this.sovereignKeyPair);

    draftInvoice.quantumSeal = {
      algorithm: envelope.algorithm,
      publicKey: envelope.publicKey,
      signature: envelope.signature,
      digest: envelope.digest,
      timestamp: envelope.issuedAt
    };
    draftInvoice.status = 'SEALED';

    // 3. Build ETDA Canonical XML
    draftInvoice.xmlPayload = ETaxXmlBuilderLogic.buildXml(draftInvoice);

    this.eTaxInvoices.set(draftInvoice.invoiceNumber, draftInvoice);

    SovereignTelemetryBus.emit(
      'PROCUREMENT',
      'ETAX_INVOICE_SEALED',
      request.seller.taxId,
      'SYSTEM',
      {
        invoiceNumber: draftInvoice.invoiceNumber,
        grandTotal: draftInvoice.grandTotal,
        amountInWords: draftInvoice.amountInWords,
        algorithm: envelope.algorithm
      }
    );

    return draftInvoice;
  }

  public getInvoice(invoiceNumber: string): ETaxInvoice | undefined {
    return this.eTaxInvoices.get(invoiceNumber);
  }

  public listInvoices(): ETaxInvoice[] {
    return Array.from(this.eTaxInvoices.values());
  }
}

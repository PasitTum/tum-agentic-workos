import { QuantumCryptoService } from '../../infrastructure/crypto/quantum-crypto.js';
import { ETaxValidatorLogic } from '../../domain/etax/etax-validator.logic.js';
import { ETaxXmlBuilderLogic } from '../../domain/etax/etax-xml-builder.logic.js';
import { ETaxSandboxClient } from '../../infrastructure/etax/etax-sandbox-client.js';
import { bahtText } from '../../domain/etax/baht-text.js';
import {
  ETaxInvoice,
  PartyTaxIdentity,
  ETaxLineItem,
  ETaxDocumentType,
  ETaxValidationResult,
  ETaxSandboxSubmissionResponse,
  ETaxTransmissionLog
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
  purposeCode?: any;
  purposeReason?: string;
}

export class ETaxService {
  private eTaxInvoices = new Map<string, ETaxInvoice>();
  private sovereignKeyPair = QuantumCryptoService.generateKeyPair('NIST-FIPS-204-ML-DSA-65');
  private sandboxClient = ETaxSandboxClient.getInstance();

  constructor() {
    this.seedDefaultInvoices();
  }

  private seedDefaultInvoices(): void {
    // Seed an initial standard invoice for DataDynamics
    try {
      this.generateAndSealInvoice({
        documentType: 'T03',
        invoiceNumber: 'INV-2026-778',
        seller: {
          name: 'DataDynamics Thailand Co., Ltd.',
          taxId: '0105558000018',
          branchCode: '00000',
          address: '123 Computer Center, Rama 9',
          province: 'Bangkok',
          postalCode: '10310',
          countryCode: 'TH'
        },
        buyer: {
          name: 'TUM Group Holdings Co., Ltd.',
          taxId: '0105561023453',
          branchCode: '00000',
          address: '1 Sovereign Tower, Sathorn',
          province: 'Bangkok',
          postalCode: '10120',
          countryCode: 'TH'
        },
        items: [
          {
            itemNumber: 1,
            sku: 'NV-H200-SXM',
            description: 'Nvidia H200 SXM 141GB Compute Node Server',
            quantity: 2,
            unitCode: 'C62',
            unitPrice: 1_600_000
          }
        ]
      });
    } catch {
      // In-memory initial seed fallback
    }
  }

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
      purposeCode: request.purposeCode,
      purposeReason: request.purposeReason,
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

  public async submitToSandbox(invoiceNumber: string): Promise<ETaxSandboxSubmissionResponse> {
    const invoice = this.eTaxInvoices.get(invoiceNumber);
    if (!invoice) {
      throw new Error(`e-Tax Invoice '${invoiceNumber}' not found.`);
    }

    if (!invoice.xmlPayload) {
      invoice.xmlPayload = ETaxXmlBuilderLogic.buildXml(invoice);
    }

    const response = await this.sandboxClient.submitInvoice({
      invoiceNumber: invoice.invoiceNumber,
      sellerTaxId: invoice.seller.taxId,
      documentType: invoice.documentType,
      xmlPayload: invoice.xmlPayload,
      environment: 'SANDBOX'
    });

    if (response.statusCode === 'ACK-200') {
      invoice.status = 'ACKNOWLEDGED_RD';
    } else {
      invoice.status = 'REJECTED_RD';
    }

    return response;
  }

  public validateRawXml(xmlPayload: string): ETaxValidationResult {
    return ETaxValidatorLogic.validateRawXml(xmlPayload);
  }

  public getSandboxTransmissionLogs(): ETaxTransmissionLog[] {
    return this.sandboxClient.getTransmissionLogs();
  }

  public getInvoice(invoiceNumber: string): ETaxInvoice | undefined {
    return this.eTaxInvoices.get(invoiceNumber);
  }

  public listInvoices(): ETaxInvoice[] {
    return Array.from(this.eTaxInvoices.values());
  }
}

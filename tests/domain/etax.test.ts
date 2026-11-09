import { test, describe } from 'node:test';
import assert from 'node:assert';
import { bahtText } from '../../src/domain/etax/baht-text.js';
import { ETaxValidatorLogic } from '../../src/domain/etax/etax-validator.logic.js';
import { ETaxXmlBuilderLogic } from '../../src/domain/etax/etax-xml-builder.logic.js';
import { ETaxInvoice } from '../../src/domain/etax/etax.types.js';
import { ETaxSandboxClient } from '../../src/infrastructure/etax/etax-sandbox-client.js';

describe('Thai RD e-Tax Invoice & e-Receipt (WOS-EPIC-07)', () => {
  test('converts numeric values to accurate Thai Baht Text', () => {
    assert.strictEqual(bahtText(0), 'ศูนย์บาทถ้วน');
    assert.strictEqual(bahtText(21), 'ยี่สิบเอ็ดบาทถ้วน');
    assert.strictEqual(bahtText(101), 'หนึ่งร้อยเอ็ดบาทถ้วน');
    assert.strictEqual(bahtText(1_605_000.50), 'หนึ่งล้านหกแสนห้าพันบาทห้าสิบสตางค์');
    assert.strictEqual(bahtText(10_000_000), 'สิบล้านบาทถ้วน');
  });

  test('validates Thai 13-digit Tax ID using Modulo 11 checksum', () => {
    const calculateValidId = (base12: string) => {
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        sum += parseInt(base12[i]!, 10) * (13 - i);
      }
      const check = (11 - (sum % 11)) % 10;
      return base12 + check.toString();
    };

    const validId = calculateValidId('010556102345');
    assert.strictEqual(ETaxValidatorLogic.validateThaiTaxId(validId), true);

    // Corrupted ID must fail
    const invalidId = validId.slice(0, 12) + ((parseInt(validId[12]!, 10) + 1) % 10).toString();
    assert.strictEqual(ETaxValidatorLogic.validateThaiTaxId(invalidId), false);

    // Non-13 digits must fail
    assert.strictEqual(ETaxValidatorLogic.validateThaiTaxId('1234'), false);
    assert.strictEqual(ETaxValidatorLogic.validateThaiTaxId('abcdefghijklm'), false);
  });

  test('validates 5-digit branch code', () => {
    assert.strictEqual(ETaxValidatorLogic.validateBranchCode('00000'), true);
    assert.strictEqual(ETaxValidatorLogic.validateBranchCode('00001'), true);
    assert.strictEqual(ETaxValidatorLogic.validateBranchCode('000'), false);
    assert.strictEqual(ETaxValidatorLogic.validateBranchCode('MAIN1'), false);
  });

  test('validates and generates ETDA Canonical XML invoice', () => {
    const validSellerId = '010556102345';
    const sum1 = validSellerId.split('').reduce((acc, d, i) => acc + parseInt(d, 10) * (13 - i), 0);
    const check1 = (11 - (sum1 % 11)) % 10;
    const sellerTaxId = validSellerId + check1;

    const validBuyerId = '010753600001';
    const sum2 = validBuyerId.split('').reduce((acc, d, i) => acc + parseInt(d, 10) * (13 - i), 0);
    const check2 = (11 - (sum2 % 11)) % 10;
    const buyerTaxId = validBuyerId + check2;

    const invoice: ETaxInvoice = {
      id: 'urn:etda:test:001',
      documentType: 'T03',
      invoiceNumber: 'INV-2026-ETAX-001',
      issueDate: '2026-11-01T12:00:00.000Z',
      seller: {
        name: 'TUM Group Holdings Co., Ltd.',
        taxId: sellerTaxId,
        branchCode: '00000',
        address: '1 Sovereign Tower, Sathorn',
        province: 'Bangkok',
        postalCode: '10120',
        countryCode: 'TH'
      },
      buyer: {
        name: 'National Digital Identity Partner Corp.',
        taxId: buyerTaxId,
        branchCode: '00001',
        address: '88 Cyber Gateway, Silom',
        province: 'Bangkok',
        postalCode: '10500',
        countryCode: 'TH'
      },
      items: [
        {
          itemNumber: 1,
          sku: 'AI-SERVER-CLUSTER',
          description: 'Autonomous Inference Cluster Node A',
          quantity: 2,
          unitCode: 'C62',
          unitPrice: 1_000_000,
          lineTotal: 2_000_000
        }
      ],
      subtotal: 2_000_000,
      totalDiscount: 0,
      taxableAmount: 2_000_000,
      vatRate: 0.07,
      vatAmount: 140_000,
      grandTotal: 2_140_000,
      amountInWords: 'สองล้านหนึ่งแสนสี่หมื่นบาทถ้วน',
      quantumSeal: {
        algorithm: 'NIST-FIPS-204-ML-DSA-65',
        publicKey: 'pk_sample',
        signature: 'sig_sample_mldsa65',
        digest: 'digest_sha3_sample',
        timestamp: '2026-11-01T12:00:00.000Z'
      },
      status: 'SEALED'
    };

    const validation = ETaxValidatorLogic.validateInvoice(invoice);
    assert.strictEqual(validation.isValid, true);
    assert.strictEqual(validation.errors.length, 0);

    const xml = ETaxXmlBuilderLogic.buildXml(invoice);
    assert.strictEqual(xml.includes('urn:etda:invoice:2017:Invoice'), true);
    assert.strictEqual(xml.includes('TaxInvoice_CrossIndustryInvoice:2'), true);
    assert.strictEqual(xml.includes('ER3-2560'), true);
    assert.strictEqual(xml.includes('INV-2026-ETAX-001'), true);
    assert.strictEqual(xml.includes('2140000.00'), true);
    assert.strictEqual(xml.includes('NIST-FIPS-204-ML-DSA-65'), true);

    // Validate raw XML output
    const rawValidation = ETaxValidatorLogic.validateRawXml(xml);
    assert.strictEqual(rawValidation.isValid, true);
    assert.strictEqual(rawValidation.errors.length, 0);
  });

  test('validates ETDA v2.1 Credit Note (Type 81) with reference', () => {
    const calculateValidId = (base12: string) => {
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        sum += parseInt(base12[i]!, 10) * (13 - i);
      }
      return base12 + ((11 - (sum % 11)) % 10).toString();
    };

    const sellerTaxId = calculateValidId('010555800001');
    const buyerTaxId = calculateValidId('010753600002');

    const creditNote: ETaxInvoice = {
      id: 'urn:etda:cn:001',
      documentType: '81',
      invoiceNumber: 'CN-2026-009',
      issueDate: '2026-11-02T10:00:00.000Z',
      purposeCode: 'CDNG01',
      purposeReason: 'Defective server node returned for credit',
      originalDocumentRef: {
        id: 'INV-2026-ETAX-001',
        issueDate: '2026-11-01T12:00:00.000Z'
      },
      seller: {
        name: 'TUM Enterprise Solutions Co., Ltd.',
        taxId: sellerTaxId,
        branchCode: '00000',
        address: '1 Sovereign Tower',
        province: 'Bangkok',
        postalCode: '10120',
        countryCode: 'TH'
      },
      buyer: {
        name: 'Bangkok Cloud Infras PLC',
        taxId: buyerTaxId,
        branchCode: '00000',
        address: '99 Silom Road',
        province: 'Bangkok',
        postalCode: '10500',
        countryCode: 'TH'
      },
      items: [
        {
          itemNumber: 1,
          sku: 'QUANTUM-NODE-RETURN',
          description: 'Returned Accelerator Card',
          quantity: 1,
          unitCode: 'C62',
          unitPrice: 100_000,
          lineTotal: 100_000
        }
      ],
      subtotal: 100_000,
      totalDiscount: 0,
      taxableAmount: 100_000,
      vatRate: 0.07,
      vatAmount: 7_000,
      grandTotal: 107_000,
      amountInWords: 'หนึ่งแสนเจ็ดพันบาทถ้วน',
      status: 'SEALED'
    };

    const xml = ETaxXmlBuilderLogic.buildXml(creditNote);
    assert.strictEqual(xml.includes('<ram:TypeCode>81</ram:TypeCode>'), true);
    assert.strictEqual(xml.includes('CDNG01'), true);
    assert.strictEqual(xml.includes('INV-2026-ETAX-001'), true);

    const validation = ETaxValidatorLogic.validateRawXml(xml);
    assert.strictEqual(validation.isValid, true);
  });

  test('submits valid ETDA v2.1 XML to RD Sandbox Gateway and receives ACK-200', async () => {
    const calculateValidId = (base12: string) => {
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        sum += parseInt(base12[i]!, 10) * (13 - i);
      }
      return base12 + ((11 - (sum % 11)) % 10).toString();
    };

    const sellerTaxId = calculateValidId('010555800001');
    const buyerTaxId = calculateValidId('010753600002');

    const invoice: ETaxInvoice = {
      id: 'urn:etda:sandbox:001',
      documentType: 'T03',
      invoiceNumber: 'INV-2026-SANDBOX-TEST',
      issueDate: new Date().toISOString(),
      seller: {
        name: 'TUM Group Holdings Co., Ltd.',
        taxId: sellerTaxId,
        branchCode: '00000',
        address: '1 Sovereign Tower',
        province: 'Bangkok',
        postalCode: '10120',
        countryCode: 'TH'
      },
      buyer: {
        name: 'Siam Datacenter Partners',
        taxId: buyerTaxId,
        branchCode: '00000',
        address: '500 Rama 4 Road',
        province: 'Bangkok',
        postalCode: '10110',
        countryCode: 'TH'
      },
      items: [{
        itemNumber: 1,
        sku: 'AI-CORE-H200',
        description: 'AI Compute Core',
        quantity: 1,
        unitCode: 'C62',
        unitPrice: 500_000,
        lineTotal: 500_000
      }],
      subtotal: 500_000,
      totalDiscount: 0,
      taxableAmount: 500_000,
      vatRate: 0.07,
      vatAmount: 35_000,
      grandTotal: 535_000,
      amountInWords: 'ห้าแสนสามหมื่นห้าพันบาทถ้วน',
      quantumSeal: {
        algorithm: 'NIST-FIPS-204-ML-DSA-65',
        publicKey: 'pk_sovereign_rd_test',
        signature: 'sig_rd_mldsa65_sample',
        digest: 'digest_sha3_256_test',
        timestamp: new Date().toISOString()
      },
      status: 'SEALED'
    };

    const xml = ETaxXmlBuilderLogic.buildXml(invoice);
    const sandboxClient = ETaxSandboxClient.getInstance();

    const response = await sandboxClient.submitInvoice({
      invoiceNumber: invoice.invoiceNumber,
      sellerTaxId: invoice.seller.taxId,
      documentType: invoice.documentType,
      xmlPayload: xml,
      environment: 'SANDBOX'
    });

    assert.strictEqual(response.statusCode, 'ACK-200');
    assert.strictEqual(response.etdaSchemaCompliance, 'COMPLIANT_V2_1');
    assert.strictEqual(response.transactionId.startsWith('RD-SBX-'), true);
    assert.strictEqual(response.testReceiptUrl.includes('etax.rd.go.th'), true);

    const logs = sandboxClient.getTransmissionLogs();
    assert.strictEqual(logs.length > 0, true);
    assert.strictEqual(logs[0]?.invoiceNumber, 'INV-2026-SANDBOX-TEST');
  });
});

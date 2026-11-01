import { test, describe } from 'node:test';
import assert from 'node:assert';
import { bahtText } from '../../src/domain/etax/baht-text.js';
import { ETaxValidatorLogic } from '../../src/domain/etax/etax-validator.logic.js';
import { ETaxXmlBuilderLogic } from '../../src/domain/etax/etax-xml-builder.logic.js';
import { ETaxInvoice } from '../../src/domain/etax/etax.types.js';

describe('Thai RD e-Tax Invoice & e-Receipt (WOS-EPIC-07)', () => {
  test('converts numeric values to accurate Thai Baht Text', () => {
    assert.strictEqual(bahtText(0), 'ศูนย์บาทถ้วน');
    assert.strictEqual(bahtText(21), 'ยี่สิบเอ็ดบาทถ้วน');
    assert.strictEqual(bahtText(101), 'หนึ่งร้อยเอ็ดบาทถ้วน');
    assert.strictEqual(bahtText(1_605_000.50), 'หนึ่งล้านหกแสนห้าพันบาทห้าสิบสตางค์');
    assert.strictEqual(bahtText(10_000_000), 'สิบล้านบาทถ้วน');
  });

  test('validates Thai 13-digit Tax ID using Modulo 11 checksum', () => {
    // Valid standard Thai 13-digit IDs with correct Modulo 11 check digit
    // Example: 0105558000018
    // 0*13 + 1*12 + 0*11 + 5*10 + 5*9 + 5*8 + 8*7 + 0*6 + 0*5 + 0*4 + 0*3 + 1*2 = 12 + 50 + 45 + 40 + 56 + 2 = 205
    // 205 % 11 = 7. 11 - 7 = 4 % 10 = 4.
    // Let's compute a known valid: 1100700123453 (check digit: 3)
    // Or test algorithmic check:
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
    assert.strictEqual(xml.includes('INV-2026-ETAX-001'), true);
    assert.strictEqual(xml.includes('2140000.00'), true);
    assert.strictEqual(xml.includes('NIST-FIPS-204-ML-DSA-65'), true);
  });
});

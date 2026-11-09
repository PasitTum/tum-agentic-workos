import { ETaxInvoice, ETaxDocumentType } from './etax.types.js';

export class ETaxXmlBuilderLogic {
  /**
   * Returns human-readable Thai document type label per ETDA ER3-2560.
   */
  public static getDocumentName(type: ETaxDocumentType): string {
    switch (type) {
      case 'T01': return 'ใบรับอิเล็กทรอนิกส์ (e-Receipt)';
      case 'T02': return 'ใบแจ้งหนี้อิเล็กทรอนิกส์ (Invoice)';
      case 'T03': return 'ใบกำกับภาษีอิเล็กทรอนิกส์ (e-Tax Invoice)';
      case 'T04': return 'ใบเสร็จรับเงิน/ใบกำกับภาษีอิเล็กทรอนิกส์ (e-Tax Invoice / Receipt)';
      case '80': return 'ใบเพิ่มหนี้อิเล็กทรอนิกส์ (Debit Note)';
      case '81': return 'ใบลดหนี้อิเล็กทรอนิกส์ (Credit Note)';
      default: return 'ใบกำกับภาษีอิเล็กทรอนิกส์ (e-Tax Invoice)';
    }
  }

  /**
   * Builds an ETDA v2.1 (ER3-2560) / Thai Revenue Department standard XML invoice document.
   */
  static buildXml(invoice: ETaxInvoice): string {
    const documentName = this.getDocumentName(invoice.documentType);

    const itemsXml = invoice.items.map(item => `
      <ram:IncludedSupplyChainTradeLineItem>
        <ram:AssociatedDocumentLineDocument>
          <ram:LineID>${item.itemNumber}</ram:LineID>
        </ram:AssociatedDocumentLineDocument>
        <ram:SpecifiedTradeProduct>
          <ram:ID>${this.escapeXml(item.sku)}</ram:ID>
          <ram:Name>${this.escapeXml(item.description)}</ram:Name>
        </ram:SpecifiedTradeProduct>
        <ram:SpecifiedLineTradeAgreement>
          <ram:GrossPriceProductTradePrice>
            <ram:ChargeAmount currencyID="THB">${item.unitPrice.toFixed(2)}</ram:ChargeAmount>
          </ram:GrossPriceProductTradePrice>
        </ram:SpecifiedLineTradeAgreement>
        <ram:SpecifiedLineTradeDelivery>
          <ram:BilledQuantity unitCode="${item.unitCode || 'C62'}">${item.quantity.toFixed(2)}</ram:BilledQuantity>
        </ram:SpecifiedLineTradeDelivery>
        <ram:SpecifiedLineTradeSettlement>
          <ram:ApplicableTradeTax>
            <ram:TypeCode>VAT</ram:TypeCode>
            <ram:CalculatedRate>${(invoice.vatRate * 100).toFixed(0)}</ram:CalculatedRate>
            <ram:BasisAmount currencyID="THB">${item.lineTotal.toFixed(2)}</ram:BasisAmount>
          </ram:ApplicableTradeTax>
          <ram:SpecifiedTradeSettlementLineMonetarySummation>
            <ram:LineTotalAmount currencyID="THB">${item.lineTotal.toFixed(2)}</ram:LineTotalAmount>
          </ram:SpecifiedTradeSettlementLineMonetarySummation>
        </ram:SpecifiedLineTradeSettlement>
      </ram:IncludedSupplyChainTradeLineItem>
    `).join('');

    const purposeXml = invoice.purposeCode ? `
    <ram:PurposeCode>${invoice.purposeCode}</ram:PurposeCode>
    <ram:Purpose>${this.escapeXml(invoice.purposeReason || 'Discrepancy adjustment')}</ram:Purpose>` : '';

    const originalRefXml = invoice.originalDocumentRef ? `
    <ram:AdditionalReferencedDocument>
      <ram:IssuerAssignedID>${this.escapeXml(invoice.originalDocumentRef.id)}</ram:IssuerAssignedID>
      <ram:IssueDateTime>${invoice.originalDocumentRef.issueDate}</ram:IssueDateTime>
      <ram:ReferenceTypeCode>1</ram:ReferenceTypeCode>
    </ram:AdditionalReferencedDocument>` : '';

    const quantumSealXml = invoice.quantumSeal ? `
  <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" id="QuantumEnvelopeSeal">
    <ds:SignedInfo>
      <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
      <ds:SignatureMethod Algorithm="urn:nist:fips:204:${invoice.quantumSeal.algorithm}"/>
      <ds:Reference URI="">
        <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha3-256"/>
        <ds:DigestValue>${invoice.quantumSeal.digest}</ds:DigestValue>
      </ds:Reference>
    </ds:SignedInfo>
    <ds:SignatureValue>${invoice.quantumSeal.signature}</ds:SignatureValue>
    <ds:KeyInfo>
      <ds:KeyName>${this.escapeXml(invoice.quantumSeal.publicKey)}</ds:KeyName>
      <ds:KeyValue>
        <ds:RSAKeyValue>
          <ds:Modulus>NIST_FIPS_204_PQC_AUTHENTIC_SEAL_${invoice.quantumSeal.digest.slice(0, 32)}</ds:Modulus>
          <ds:Exponent>AQAB</ds:Exponent>
        </ds:RSAKeyValue>
      </ds:KeyValue>
    </ds:KeyInfo>
  </ds:Signature>` : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:TaxInvoice_CrossIndustryInvoice 
  xmlns:rsm="urn:etda:uncefact:data:standard:TaxInvoice_CrossIndustryInvoice:2" 
  xmlns:ram="urn:etda:uncefact:data:standard:TaxInvoice_ReusableAggregateBusinessInformationEntity:2" 
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#" 
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:legacy="urn:etda:invoice:2017:Invoice"
  xsi:schemaLocation="urn:etda:uncefact:data:standard:TaxInvoice_CrossIndustryInvoice:2 TaxInvoice_CrossIndustryInvoice_2p1.xsd">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID schemeAgencyID="ETDA" schemeVersionID="v2.1">ER3-2560</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${this.escapeXml(invoice.invoiceNumber)}</ram:ID>
    <ram:Name>${this.escapeXml(documentName)}</ram:Name>
    <ram:TypeCode>${invoice.documentType}</ram:TypeCode>
    <ram:IssueDateTime>${invoice.issueDate}</ram:IssueDateTime>${purposeXml}
    <ram:IncludedNote>
      <ram:Subject>จำนวนเงินตัวอักษร (Thai Baht Text)</ram:Subject>
      <ram:Content>${this.escapeXml(invoice.amountInWords)}</ram:Content>
    </ram:IncludedNote>${originalRefXml}
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${this.escapeXml(invoice.seller.name)}</ram:Name>
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeAgencyName="RD" schemeID="TXID">${invoice.seller.taxId}</ram:ID>
        </ram:SpecifiedTaxRegistration>
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeAgencyName="RD" schemeID="BRANCH">${invoice.seller.branchCode}</ram:ID>
        </ram:SpecifiedTaxRegistration>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${invoice.seller.postalCode}</ram:PostcodeCode>
          <ram:LineOne>${this.escapeXml(invoice.seller.address)}</ram:LineOne>
          <ram:CityName>${this.escapeXml(invoice.seller.province)}</ram:CityName>
          <ram:CountryID>${invoice.seller.countryCode}</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${this.escapeXml(invoice.buyer.name)}</ram:Name>
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeAgencyName="RD" schemeID="TXID">${invoice.buyer.taxId}</ram:ID>
        </ram:SpecifiedTaxRegistration>
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeAgencyName="RD" schemeID="BRANCH">${invoice.buyer.branchCode}</ram:ID>
        </ram:SpecifiedTaxRegistration>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${invoice.buyer.postalCode}</ram:PostcodeCode>
          <ram:LineOne>${this.escapeXml(invoice.buyer.address)}</ram:LineOne>
          <ram:CityName>${this.escapeXml(invoice.buyer.province)}</ram:CityName>
          <ram:CountryID>${invoice.buyer.countryCode}</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>THB</ram:InvoiceCurrencyCode>
      <ram:ApplicableTradeTax>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:CalculatedRate>${(invoice.vatRate * 100).toFixed(0)}</ram:CalculatedRate>
        <ram:BasisAmount currencyID="THB">${invoice.taxableAmount.toFixed(2)}</ram:BasisAmount>
        <ram:CalculatedAmount currencyID="THB">${invoice.vatAmount.toFixed(2)}</ram:CalculatedAmount>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount currencyID="THB">${invoice.subtotal.toFixed(2)}</ram:LineTotalAmount>
        <ram:AllowanceTotalAmount currencyID="THB">${(invoice.totalDiscount || 0).toFixed(2)}</ram:AllowanceTotalAmount>
        <ram:TaxBasisTotalAmount currencyID="THB">${invoice.taxableAmount.toFixed(2)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="THB">${invoice.vatAmount.toFixed(2)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount currencyID="THB">${invoice.grandTotal.toFixed(2)}</ram:GrandTotalAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
    ${itemsXml.trim()}
  </rsm:SupplyChainTradeTransaction>${quantumSealXml}
</rsm:TaxInvoice_CrossIndustryInvoice>`.trim();
  }

  private static escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&'"]/g, c => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }
}

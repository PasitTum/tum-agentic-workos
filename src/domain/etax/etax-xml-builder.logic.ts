import { ETaxInvoice } from './etax.types.js';

export class ETaxXmlBuilderLogic {
  /**
   * Builds an ETDA / Thai Revenue Department standard XML invoice document.
   */
  static buildXml(invoice: ETaxInvoice): string {
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
          <ram:BilledQuantity unitCode="${item.unitCode}">${item.quantity.toFixed(2)}</ram:BilledQuantity>
        </ram:SpecifiedLineTradeDelivery>
        <ram:SpecifiedLineTradeSettlement>
          <ram:SpecifiedTradeSettlementLineMonetarySummation>
            <ram:LineTotalAmount currencyID="THB">${item.lineTotal.toFixed(2)}</ram:LineTotalAmount>
          </ram:SpecifiedTradeSettlementLineMonetarySummation>
        </ram:SpecifiedLineTradeSettlement>
      </ram:IncludedSupplyChainTradeLineItem>
    `).join('');

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
    </ds:KeyInfo>
  </ds:Signature>` : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:TaxInvoice_CrossIndustryInvoice xmlns:rsm="urn:etda:invoice:2017:Invoice" xmlns:ram="urn:etda:invoice:2017:Invoice:RAM" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID schemeAgencyID="ETDA">v2.1</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${this.escapeXml(invoice.invoiceNumber)}</ram:ID>
    <ram:Name>ใบกำกับภาษีอิเล็กทรอนิกส์ (e-Tax Invoice)</ram:Name>
    <ram:TypeCode>${invoice.documentType}</ram:TypeCode>
    <ram:IssueDateTime>${invoice.issueDate}</ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${this.escapeXml(invoice.seller.name)}</ram:Name>
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeAgencyName="RD" schemeID="TXID">${invoice.seller.taxId}</ram:ID>
        </ram:SpecifiedTaxRegistration>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${invoice.seller.postalCode}</ram:PostcodeCode>
          <ram:LineOne>${this.escapeXml(invoice.seller.address)}</ram:LineOne>
          <ram:CountryID>${invoice.seller.countryCode}</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${this.escapeXml(invoice.buyer.name)}</ram:Name>
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeAgencyName="RD" schemeID="TXID">${invoice.buyer.taxId}</ram:ID>
        </ram:SpecifiedTaxRegistration>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${invoice.buyer.postalCode}</ram:PostcodeCode>
          <ram:LineOne>${this.escapeXml(invoice.buyer.address)}</ram:LineOne>
          <ram:CountryID>${invoice.buyer.countryCode}</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>THB</ram:InvoiceCurrencyCode>
      <ram:ApplicableTradeTax>
        <ram:CalculatedRate>${(invoice.vatRate * 100).toFixed(0)}</ram:CalculatedRate>
        <ram:BasisAmount currencyID="THB">${invoice.taxableAmount.toFixed(2)}</ram:BasisAmount>
        <ram:CalculatedAmount currencyID="THB">${invoice.vatAmount.toFixed(2)}</ram:CalculatedAmount>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount currencyID="THB">${invoice.subtotal.toFixed(2)}</ram:LineTotalAmount>
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

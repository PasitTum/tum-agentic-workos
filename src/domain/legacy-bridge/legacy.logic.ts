import {
  LegacyErpPayload,
  NormalizedErpRecord
} from './legacy.types.js';

export class LegacyAdapterLogic {
  /**
   * Normalizes SAP S/4HANA PO / Invoice / Vendor structures to Sovereign WorkOS format.
   */
  static normalizeSapPayload(payload: LegacyErpPayload): NormalizedErpRecord {
    const raw = payload.rawPayload;
    const normalizedData: Record<string, unknown> = {};

    if (payload.entityType === 'PURCHASE_ORDER') {
      normalizedData.poNumber = raw.EBELN || raw.poNumber || payload.externalEntityId;
      normalizedData.vendorId = raw.LIFNR || raw.vendorId;
      normalizedData.totalAmount = Number(raw.NETWR || raw.totalAmount || 0);
      normalizedData.currency = raw.WAERS || 'THB';
      normalizedData.status = 'ISSUED';
    } else if (payload.entityType === 'INVOICE') {
      normalizedData.invoiceNumber = raw.BELNR || raw.invoiceNumber || payload.externalEntityId;
      normalizedData.poNumber = raw.EBELN || raw.poNumber;
      normalizedData.totalAmount = Number(raw.RMWWR || raw.totalAmount || 0);
      normalizedData.status = 'PENDING_VERIFICATION';
    } else {
      Object.assign(normalizedData, raw);
    }

    return {
      tumId: `TUM-SAP-${payload.externalEntityId}`,
      externalSystem: 'SAP_S4HANA',
      externalId: payload.externalEntityId,
      entityType: payload.entityType,
      data: normalizedData,
      status: 'SYNCED',
      lastSyncedAt: new Date().toISOString(),
      checksum: Buffer.from(JSON.stringify(raw)).toString('base64').slice(0, 16)
    };
  }

  /**
   * Normalizes Salesforce CRM records.
   */
  static normalizeSalesforcePayload(payload: LegacyErpPayload): NormalizedErpRecord {
    const raw = payload.rawPayload;
    return {
      tumId: `TUM-SF-${payload.externalEntityId}`,
      externalSystem: 'SALESFORCE_CRM',
      externalId: payload.externalEntityId,
      entityType: payload.entityType,
      data: {
        crmAccountId: raw.AccountId || payload.externalEntityId,
        name: raw.Name || raw.AccountName,
        industry: raw.Industry,
        annualRevenue: raw.AnnualRevenue,
        stage: raw.StageName || 'Active'
      },
      status: 'SYNCED',
      lastSyncedAt: new Date().toISOString(),
      checksum: Buffer.from(JSON.stringify(raw)).toString('base64').slice(0, 16)
    };
  }
}

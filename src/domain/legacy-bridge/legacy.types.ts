export type ExternalSystemType = 'SAP_S4HANA' | 'SALESFORCE_CRM' | 'ORACLE_NETSUITE';
export type SyncDirection = 'INBOUND' | 'OUTBOUND';
export type SyncStatus = 'PENDING' | 'SYNCED' | 'FAILED' | 'RETRYING';

export interface LegacyErpPayload {
  externalSystem: ExternalSystemType;
  externalEntityId: string;
  entityType: 'PURCHASE_ORDER' | 'INVOICE' | 'VENDOR' | 'EMPLOYEE';
  rawPayload: Record<string, unknown>;
  receivedAt: string;
}

export interface NormalizedErpRecord {
  tumId: string;
  externalSystem: ExternalSystemType;
  externalId: string;
  entityType: string;
  data: Record<string, unknown>;
  status: SyncStatus;
  lastSyncedAt: string;
  checksum: string;
}

export interface LegacyAdapterMappingRule {
  externalField: string;
  tumField: string;
  transform?: (value: unknown) => unknown;
}

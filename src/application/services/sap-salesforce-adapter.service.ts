import { InMemoryDatabase } from '../../infrastructure/persistence/in-memory-db.js';
import { LegacyAdapterLogic } from '../../domain/legacy-bridge/legacy.logic.js';
import {
  NormalizedErpRecord
} from '../../domain/legacy-bridge/legacy.types.js';
import { LegacySyncPayloadSchema } from '../dto/schemas.js';
import { SovereignTelemetryBus } from '../../infrastructure/telemetry/sovereign-telemetry.js';

export class SapSalesforceAdapterService {
  private db = InMemoryDatabase.getInstance();

  public syncInboundPayload(input: unknown): NormalizedErpRecord {
    const validated = LegacySyncPayloadSchema.parse(input);

    const payload = {
      externalSystem: validated.externalSystem,
      externalEntityId: validated.externalEntityId,
      entityType: validated.entityType,
      rawPayload: validated.rawPayload,
      receivedAt: new Date().toISOString()
    };

    let normalized: NormalizedErpRecord;

    if (validated.externalSystem === 'SAP_S4HANA') {
      normalized = LegacyAdapterLogic.normalizeSapPayload(payload);
    } else if (validated.externalSystem === 'SALESFORCE_CRM') {
      normalized = LegacyAdapterLogic.normalizeSalesforcePayload(payload);
    } else {
      normalized = {
        tumId: `TUM-EXT-${validated.externalEntityId}`,
        externalSystem: validated.externalSystem,
        externalId: validated.externalEntityId,
        entityType: validated.entityType,
        data: validated.rawPayload,
        status: 'SYNCED',
        lastSyncedAt: new Date().toISOString(),
        checksum: 'checksum-generic'
      };
    }

    this.db.legacyRecords.set(normalized.tumId, normalized);

    SovereignTelemetryBus.emit(
      'AUDIT',
      'LEGACY_RECORD_SYNCHRONIZED',
      validated.externalEntityId,
      'SYSTEM',
      {
        externalSystem: validated.externalSystem,
        tumId: normalized.tumId,
        entityType: normalized.entityType
      }
    );

    return normalized;
  }

  public getRecord(tumId: string): NormalizedErpRecord | undefined {
    return this.db.legacyRecords.get(tumId);
  }

  public listRecords(): NormalizedErpRecord[] {
    return Array.from(this.db.legacyRecords.values());
  }
}

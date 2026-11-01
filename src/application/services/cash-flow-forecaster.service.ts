/**
 * TUM Agentic WorkOS — Cash Flow & Treasury Forecasting Service
 * Clean Architecture Application Service
 */

import { randomUUID } from 'node:crypto';
import type {
  CashFlowEvent,
  QuantumSealedTreasuryForecast
} from '../../domain/treasury/cash-flow.types.js';
import { CashFlowLogic } from '../../domain/treasury/cash-flow.logic.js';
import { QuantumCryptoService, KeyPairPqc } from '../../infrastructure/crypto/quantum-crypto.js';

export class CashFlowForecasterService {
  private events: Map<string, CashFlowEvent> = new Map();
  private forecasts: Map<string, QuantumSealedTreasuryForecast> = new Map();
  private keyPair: KeyPairPqc;

  constructor(keyPair?: KeyPairPqc) {
    this.keyPair = keyPair ?? QuantumCryptoService.generateKeyPair('NIST-FIPS-204-ML-DSA-65');
  }

  public registerCashEvent(event: CashFlowEvent): void {
    if (event.amountThb <= 0) {
      throw new Error(`Amount must be positive, got ${event.amountThb}`);
    }
    if (event.reliabilityFactor < 0 || event.reliabilityFactor > 1.0) {
      throw new Error(`Reliability factor must be between 0.0 and 1.0, got ${event.reliabilityFactor}`);
    }
    this.events.set(event.id, event);
  }

  public listEvents(): CashFlowEvent[] {
    return Array.from(this.events.values());
  }

  public generateForecast(
    startingBalanceThb: number = 10_000_000,
    minimumBufferThb: number = 2_000_000,
    horizonDays: number = 60
  ): QuantumSealedTreasuryForecast {
    const forecastId = `FCST-${randomUUID()}`;
    const allEvents = Array.from(this.events.values());

    const forecast = CashFlowLogic.projectCashFlow(
      forecastId,
      startingBalanceThb,
      minimumBufferThb,
      horizonDays,
      allEvents
    );

    const envelope = QuantumCryptoService.signEnvelope(forecast, this.keyPair);

    const sealedForecast: QuantumSealedTreasuryForecast = {
      forecast,
      quantumSignatureHex: envelope.signature,
      algorithm: 'ML-DSA-65',
      keyId: this.keyPair.keyId
    };

    this.forecasts.set(forecastId, sealedForecast);
    return sealedForecast;
  }

  public getForecast(forecastId: string): QuantumSealedTreasuryForecast | undefined {
    return this.forecasts.get(forecastId);
  }
}

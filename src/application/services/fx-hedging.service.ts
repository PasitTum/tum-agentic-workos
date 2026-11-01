import { FxHedgingLogic } from '../../domain/fx-hedging/fx-hedging.logic.js';
import {
  FxSpotRate,
  FxExposure,
  FxForwardContract,
  FxHedgeEvaluation,
  SupportedCurrency
} from '../../domain/fx-hedging/fx-hedging.types.js';
import { SovereignTelemetryBus } from '../../infrastructure/telemetry/sovereign-telemetry.js';

export class FxHedgingService {
  private exposures = new Map<string, FxExposure>();
  private contracts = new Map<string, FxForwardContract>();
  private spotRates = new Map<SupportedCurrency, FxSpotRate>();

  constructor() {
    this.seedDefaultRates();
  }

  private seedDefaultRates() {
    this.spotRates.set('USD', {
      baseCurrency: 'USD',
      quoteCurrency: 'THB',
      rate: 36.50,
      interestRateBase: 0.045,
      interestRateThb: 0.0225,
      asOf: new Date().toISOString()
    });
    this.spotRates.set('EUR', {
      baseCurrency: 'EUR',
      quoteCurrency: 'THB',
      rate: 39.80,
      interestRateBase: 0.035,
      interestRateThb: 0.0225,
      asOf: new Date().toISOString()
    });
    this.spotRates.set('SGD', {
      baseCurrency: 'SGD',
      quoteCurrency: 'THB',
      rate: 27.50,
      interestRateBase: 0.030,
      interestRateThb: 0.0225,
      asOf: new Date().toISOString()
    });
  }

  public recordForeignExposure(
    poNumber: string,
    vendorId: string,
    foreignCurrency: SupportedCurrency,
    foreignAmount: number,
    paymentDueDate: string
  ): FxExposure {
    const spot = this.spotRates.get(foreignCurrency);
    const rate = spot ? spot.rate : 35.0;
    const initialThbEquivalent = Math.round(foreignAmount * rate * 100) / 100;
    const exposureId = `EXP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const exposure: FxExposure = {
      exposureId,
      poNumber,
      vendorId,
      foreignCurrency,
      foreignAmount,
      spotRateAtOrder: rate,
      initialThbEquivalent,
      paymentDueDate
    };

    this.exposures.set(exposureId, exposure);

    SovereignTelemetryBus.emit(
      'PROCUREMENT',
      'FX_EXPOSURE_RECORDED',
      vendorId,
      'SYSTEM',
      { exposureId, currency: foreignCurrency, amount: foreignAmount, thbVal: initialThbEquivalent }
    );

    return exposure;
  }

  public evaluateHedge(exposureId: string, daysToMaturity = 60): FxHedgeEvaluation {
    const exposure = this.exposures.get(exposureId);
    if (!exposure) {
      throw new Error(`FX Exposure '${exposureId}' not found.`);
    }

    const spot = this.spotRates.get(exposure.foreignCurrency);
    if (!spot) {
      throw new Error(`Spot rate unavailable for currency '${exposure.foreignCurrency}'.`);
    }

    return FxHedgingLogic.evaluateExposure(exposure, spot, daysToMaturity);
  }

  public executeForwardHedge(
    exposureId: string,
    counterpartyBank = 'Bangkok Bank PCL',
    daysToMaturity = 60
  ): FxForwardContract {
    const exposure = this.exposures.get(exposureId);
    if (!exposure) {
      throw new Error(`FX Exposure '${exposureId}' not found.`);
    }

    const spot = this.spotRates.get(exposure.foreignCurrency);
    if (!spot) {
      throw new Error(`Spot rate unavailable for currency '${exposure.foreignCurrency}'.`);
    }

    const forwardRate = FxHedgingLogic.calculateForwardRate(spot, daysToMaturity);
    const lockedThbAmount = Math.round(exposure.foreignAmount * forwardRate * 100) / 100;
    const contractId = `FWD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const contract: FxForwardContract = {
      contractId,
      exposureId,
      pair: `${exposure.foreignCurrency}/THB`,
      foreignCurrency: exposure.foreignCurrency,
      notionalAmount: exposure.foreignAmount,
      contractForwardRate: forwardRate,
      lockedThbAmount,
      maturityDate: exposure.paymentDueDate,
      counterpartyBank,
      status: 'ACTIVE',
      unrealizedGainLossTHB: 0,
      createdAt: new Date().toISOString()
    };

    this.contracts.set(contractId, contract);

    SovereignTelemetryBus.emit(
      'PROCUREMENT',
      'FX_FORWARD_EXECUTED',
      counterpartyBank,
      'SYSTEM',
      { contractId, pair: contract.pair, notional: contract.notionalAmount, lockedThb: lockedThbAmount }
    );

    return contract;
  }

  public updateMtm(contractId: string, currentMarketForwardRate: number): FxForwardContract {
    const contract = this.contracts.get(contractId);
    if (!contract) {
      throw new Error(`Contract '${contractId}' not found.`);
    }

    contract.unrealizedGainLossTHB = FxHedgingLogic.calculateMtm(contract, currentMarketForwardRate);
    return contract;
  }

  public listContracts(): FxForwardContract[] {
    return Array.from(this.contracts.values());
  }
}

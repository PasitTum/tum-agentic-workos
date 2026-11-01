/**
 * TUM Agentic WorkOS — Treasury & Cash Flow Domain Logic
 * Pure Functional Architecture (Deterministic, Side-Effect Free)
 */

import {
  CashFlowEvent,
  DailyProjection,
  TreasuryForecast
} from './cash-flow.types.js';

export class CashFlowLogic {
  /**
   * Projects daily balance across the specified horizon.
   */
  public static projectCashFlow(
    forecastId: string,
    startingBalanceThb: number,
    minimumBufferThb: number,
    horizonDays: number,
    events: readonly CashFlowEvent[]
  ): TreasuryForecast {
    if (horizonDays <= 0 || horizonDays > 365) {
      throw new Error(`Horizon days must be between 1 and 365, got ${horizonDays}`);
    }
    if (startingBalanceThb < 0) {
      throw new Error('Starting treasury balance cannot be negative');
    }

    let currentBalance = startingBalanceThb;
    let totalInflow = 0;
    let totalOutflow = 0;
    let earliestDeficitDay: number | null = null;

    const dailyProjections: DailyProjection[] = [];

    for (let day = 0; day <= horizonDays; day++) {
      const dayEvents = events.filter(e => e.dueDayOffset === day);

      let dayInflow = 0;
      let dayOutflow = 0;

      for (const ev of dayEvents) {
        const weightedAmount = ev.amountThb * ev.reliabilityFactor;
        if (ev.category === 'RECEIVABLE_INFLOW') {
          dayInflow += weightedAmount;
        } else {
          dayOutflow += ev.amountThb; // Outflows are fully reserved
        }
      }

      totalInflow += dayInflow;
      totalOutflow += dayOutflow;
      currentBalance = currentBalance + dayInflow - dayOutflow;

      if (currentBalance < minimumBufferThb && earliestDeficitDay === null) {
        earliestDeficitDay = day;
      }

      dailyProjections.push({
        day,
        inflowThb: Math.round(dayInflow * 100) / 100,
        outflowThb: Math.round(dayOutflow * 100) / 100,
        netDailyThb: Math.round((dayInflow - dayOutflow) * 100) / 100,
        cumulativeBalanceThb: Math.round(currentBalance * 100) / 100
      });
    }

    const isLiquidityCrunchPredicted = earliestDeficitDay !== null;
    let recommendedAction: TreasuryForecast['recommendedAction'] = 'SUFFICIENT_LIQUIDITY';

    if (isLiquidityCrunchPredicted && earliestDeficitDay !== null) {
      if (earliestDeficitDay <= 14) {
        // Immediate short term deficit: draw credit or early payment
        recommendedAction = 'DRAW_REVOLVING_CREDIT';
      } else if (earliestDeficitDay <= 30) {
        recommendedAction = 'OFFER_EARLY_PAYMENT_DISCOUNT';
      } else {
        recommendedAction = 'DEFER_CAPEX_EXPENSE';
      }
    }

    return {
      forecastId,
      startingBalanceThb,
      minimumBufferThb,
      horizonDays,
      totalProjectedInflowThb: Math.round(totalInflow * 100) / 100,
      totalProjectedOutflowThb: Math.round(totalOutflow * 100) / 100,
      projectedEndingBalanceThb: Math.round(currentBalance * 100) / 100,
      isLiquidityCrunchPredicted,
      earliestDeficitDay,
      recommendedAction,
      dailyProjections,
      generatedAt: new Date().toISOString()
    };
  }
}

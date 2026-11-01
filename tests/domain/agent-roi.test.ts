import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AgentRoiLogic } from '../../src/domain/agent-roi/agent-roi.logic.js';
import { AgentRoiService } from '../../src/application/services/agent-roi.service.js';

describe('Autonomous Agent ROI & Token Valuation Ledger (WOS-EPIC-12)', () => {
  it('calculates compute cost in THB based on model pricing rates', () => {
    // 1,000,000 input tokens at 3.50 THB + 500,000 output tokens at 14.00 THB = 3.50 + 7.00 = 10.50 THB
    const flashCost = AgentRoiLogic.calculateTokenCost(1_000_000, 500_000, 'gemini-3.8-flash');
    assert.equal(flashCost, 10.50);

    // 100,000 input tokens at 105 THB/M = 10.50 THB
    // 50,000 output tokens at 525 THB/M = 26.25 THB
    // Total = 36.75 THB
    const sonnetCost = AgentRoiLogic.calculateTokenCost(100_000, 50, 'claude-3.7-sonnet');
    assert.ok(sonnetCost > 10.0);
  });

  it('computes holistic ROI scorecard and assigns efficiency tier', () => {
    const service = new AgentRoiService();

    // Log token usages for Agent-Arbiter
    service.logTokenUsage('AGENT-ARBITER-01', 'TASK-01', 'gemini-3.8-flash', 200_000, 50_000);
    service.logTokenUsage('AGENT-ARBITER-01', 'TASK-02', 'gemini-3.8-flash', 300_000, 80_000);

    // Total cost will be around ~3-5 THB
    // Now attribute business value: 50,000 THB cost savings on contract dispute avoidance
    service.logBusinessValue(
      'AGENT-ARBITER-01',
      'TASK-01',
      'RISK_AVOIDANCE',
      50000,
      'ARBITRATION-DECISION-991'
    );

    const scorecard = service.getAgentRoiScorecard('AGENT-ARBITER-01');
    assert.equal(scorecard.agentId, 'AGENT-ARBITER-01');
    assert.ok(scorecard.totalComputeCostTHB > 0);
    assert.equal(scorecard.totalBusinessValueTHB, 50000);
    assert.ok(scorecard.roiMultiplier > 100);
    assert.equal(scorecard.efficiencyTier, 'EXCEPTIONAL');
  });

  it('marks an agent as UNPROFITABLE when token compute cost exceeds business value', () => {
    const service = new AgentRoiService();

    // Spend heavy Sonnet tokens with zero value
    service.logTokenUsage('AGENT-INEFFICIENT-01', 'TASK-FAIL', 'claude-3.7-sonnet', 5_000_000, 2_000_000);
    // 5M * 105 = 525 THB, 2M * 525 = 1050 THB => ~1,575 THB cost
    // Value = 100 THB
    service.logBusinessValue(
      'AGENT-INEFFICIENT-01',
      'TASK-FAIL',
      'TIME_SAVED',
      100,
      'MINOR-LOG-SCRAPE'
    );

    const scorecard = service.getAgentRoiScorecard('AGENT-INEFFICIENT-01');
    assert.ok(scorecard.roiMultiplier < 1.0);
    assert.equal(scorecard.efficiencyTier, 'UNPROFITABLE');
    assert.ok(scorecard.netValueContributionTHB < 0);
  });
});

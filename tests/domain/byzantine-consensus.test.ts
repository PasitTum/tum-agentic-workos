import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ByzantineConsensusLogic } from '../../src/domain/consensus/byzantine-consensus.logic.js';
import { ConsensusProposal } from '../../src/domain/consensus/consensus.types.js';

describe('Multi-Agent Swarm Byzantine Consensus (WOS-EPIC-09)', () => {
  const baseProposal: ConsensusProposal = {
    proposalId: 'PROP-TEST-001',
    transactionRef: 'TX-DISBURSE-50M',
    requestedAmountTHB: 50_000_000,
    description: 'High-value data center acquisition funding',
    totalVotersRequired: 4,
    quorumThreshold: 3,
    allowVeto: true,
    ballots: [],
    expiresAt: new Date(Date.now() + 3600_000).toISOString()
  };

  test('reports PENDING status while ballots are incomplete', () => {
    const proposal: ConsensusProposal = {
      ...baseProposal,
      ballots: [
        {
          agentId: 'AGT-CFO',
          agentRole: 'CHIEF_FINANCIAL_AGENT',
          decision: 'APPROVE',
          justification: 'Budget allocations confirmed.',
          signature: 'sig_cfo',
          castAt: new Date().toISOString()
        }
      ]
    };

    const result = ByzantineConsensusLogic.evaluate(proposal);
    assert.strictEqual(result.status, 'PENDING');
    assert.strictEqual(result.isApproved, false);
    assert.strictEqual(result.approvals, 1);
  });

  test('achieves CONSENSUS_REACHED when quorum threshold is reached (3 of 4 approvals)', () => {
    const proposal: ConsensusProposal = {
      ...baseProposal,
      ballots: [
        {
          agentId: 'AGT-CFO',
          agentRole: 'CHIEF_FINANCIAL_AGENT',
          decision: 'APPROVE',
          justification: 'Budget confirmed.',
          signature: 'sig_cfo',
          castAt: new Date().toISOString()
        },
        {
          agentId: 'AGT-AUDITOR',
          agentRole: 'SOVEREIGN_COMPLIANCE_AUDITOR',
          decision: 'APPROVE',
          justification: 'All documentation verified.',
          signature: 'sig_aud',
          castAt: new Date().toISOString()
        },
        {
          agentId: 'AGT-TREASURY',
          agentRole: 'LIQUIDITY_DISBURSEMENT_AGENT',
          decision: 'APPROVE',
          justification: 'Cash flow reserves adequate.',
          signature: 'sig_tr',
          castAt: new Date().toISOString()
        }
      ]
    };

    const result = ByzantineConsensusLogic.evaluate(proposal);
    assert.strictEqual(result.status, 'CONSENSUS_REACHED');
    assert.strictEqual(result.isApproved, true);
    assert.strictEqual(result.approvals, 3);
    assert.strictEqual(result.vetoTriggered, false);
  });

  test('halts and rejects transaction when Security Sentry casts an absolute veto', () => {
    const proposal: ConsensusProposal = {
      ...baseProposal,
      ballots: [
        {
          agentId: 'AGT-CFO',
          agentRole: 'CHIEF_FINANCIAL_AGENT',
          decision: 'APPROVE',
          justification: 'Looks fine.',
          signature: 'sig_cfo',
          castAt: new Date().toISOString()
        },
        {
          agentId: 'AGT-EBPF-SENTRY',
          agentRole: 'SECURITY_SENTRY_AGENT',
          decision: 'REJECT',
          justification: 'Anomaly detected in destination escrow IBAN route.',
          signature: 'sig_sentry',
          castAt: new Date().toISOString()
        }
      ]
    };

    const result = ByzantineConsensusLogic.evaluate(proposal);
    assert.strictEqual(result.status, 'CONSENSUS_REJECTED');
    assert.strictEqual(result.isApproved, false);
    assert.strictEqual(result.vetoTriggered, true);
    assert.strictEqual(result.vetoReason?.includes('Security Veto cast'), true);
  });
});

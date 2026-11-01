import { ByzantineConsensusLogic } from '../../domain/consensus/byzantine-consensus.logic.js';
import {
  ConsensusProposal,
  ConsensusEvaluationResult,
  Ballot,
  VoteDecision
} from '../../domain/consensus/consensus.types.js';
import { SovereignTelemetryBus } from '../../infrastructure/telemetry/sovereign-telemetry.js';

export interface CreateProposalRequest {
  transactionRef: string;
  requestedAmountTHB: number;
  description: string;
  totalVotersRequired?: number;
  quorumThreshold?: number;
  allowVeto?: boolean;
  durationMinutes?: number;
}

export class ByzantineConsensusService {
  private proposals = new Map<string, ConsensusProposal>();

  public createProposal(request: CreateProposalRequest): ConsensusProposal {
    const proposalId = `PROP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const duration = request.durationMinutes ?? 60;
    const expiresAt = new Date(Date.now() + duration * 60 * 1000).toISOString();

    const proposal: ConsensusProposal = {
      proposalId,
      transactionRef: request.transactionRef,
      requestedAmountTHB: request.requestedAmountTHB,
      description: request.description,
      totalVotersRequired: request.totalVotersRequired ?? 4,
      quorumThreshold: request.quorumThreshold ?? 3,
      allowVeto: request.allowVeto ?? true,
      ballots: [],
      expiresAt
    };

    this.proposals.set(proposalId, proposal);

    SovereignTelemetryBus.emit(
      'AUDIT',
      'SWARM_CONSENSUS_PROPOSAL_CREATED',
      'SWARM_ROUTER',
      'SYSTEM',
      {
        proposalId,
        transactionRef: proposal.transactionRef,
        amount: proposal.requestedAmountTHB,
        threshold: proposal.quorumThreshold
      }
    );

    return proposal;
  }

  public castBallot(
    proposalId: string,
    agentId: string,
    agentRole: string,
    decision: VoteDecision,
    justification: string,
    signature: string
  ): ConsensusEvaluationResult {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal '${proposalId}' not found.`);
    }

    // Check if agent already voted
    const existingIdx = proposal.ballots.findIndex(b => b.agentId === agentId);
    const ballot: Ballot = {
      agentId,
      agentRole,
      decision,
      justification,
      signature,
      castAt: new Date().toISOString()
    };

    if (existingIdx >= 0) {
      proposal.ballots[existingIdx] = ballot;
    } else {
      proposal.ballots.push(ballot);
    }

    const evalResult = ByzantineConsensusLogic.evaluate(proposal);

    SovereignTelemetryBus.emit(
      'AUDIT',
      'SWARM_BALLOT_CAST',
      agentId,
      'AGENT',
      {
        proposalId,
        decision,
        status: evalResult.status,
        approvals: evalResult.approvals
      }
    );

    return evalResult;
  }

  public getProposal(proposalId: string): ConsensusProposal | undefined {
    return this.proposals.get(proposalId);
  }

  public evaluateProposal(proposalId: string): ConsensusEvaluationResult {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal '${proposalId}' not found.`);
    }
    return ByzantineConsensusLogic.evaluate(proposal);
  }
}

import {
  ConsensusProposal,
  ConsensusEvaluationResult,
  ConsensusStatus
} from './consensus.types.js';

export class ByzantineConsensusLogic {
  /**
   * Evaluates swarm voting ballots against Byzantine Fault Tolerant quorum rules.
   */
  static evaluate(proposal: ConsensusProposal, currentTime: Date = new Date()): ConsensusEvaluationResult {
    const isExpired = currentTime.getTime() > new Date(proposal.expiresAt).getTime();
    const ballots = proposal.ballots || [];

    let approvals = 0;
    let rejections = 0;
    let abstentions = 0;
    let vetoTriggered = false;
    let vetoReason: string | undefined;

    // Tally votes
    for (const b of ballots) {
      if (b.decision === 'APPROVE') {
        approvals++;
      } else if (b.decision === 'REJECT') {
        rejections++;
        if (proposal.allowVeto && (b.agentRole.includes('SECURITY') || b.agentRole.includes('AUDIT') || b.agentRole.includes('SENTRY'))) {
          vetoTriggered = true;
          vetoReason = `Security Veto cast by ${b.agentId} (${b.agentRole}): ${b.justification}`;
        }
      } else {
        abstentions++;
      }
    }

    let status: ConsensusStatus;
    let isApproved = false;
    let summary: string;

    if (vetoTriggered) {
      status = 'CONSENSUS_REJECTED';
      isApproved = false;
      summary = `Consensus Failed: Absolute veto exercised by security sentry. ${vetoReason}`;
    } else if (approvals >= proposal.quorumThreshold) {
      status = 'CONSENSUS_REACHED';
      isApproved = true;
      summary = `Consensus Reached: ${approvals}/${proposal.totalVotersRequired} swarm approvals attained (Threshold: ${proposal.quorumThreshold}).`;
    } else if (rejections > (proposal.totalVotersRequired - proposal.quorumThreshold)) {
      // Impossible to reach quorum even if remaining vote approve
      status = 'CONSENSUS_REJECTED';
      isApproved = false;
      summary = `Consensus Rejected: Rejection count (${rejections}) exceeds tolerance boundary.`;
    } else if (isExpired) {
      status = 'TIMEOUT_QUORUM_FAILED';
      isApproved = false;
      summary = `Consensus Timeout: Quorum not achieved before expiration window (${proposal.expiresAt}).`;
    } else {
      status = 'PENDING';
      isApproved = false;
      summary = `Voting in progress: ${ballots.length}/${proposal.totalVotersRequired} ballots received.`;
    }

    return {
      proposalId: proposal.proposalId,
      status,
      isApproved,
      totalVotesCast: ballots.length,
      approvals,
      rejections,
      abstentions,
      vetoTriggered,
      vetoReason,
      summary,
      resolvedAt: new Date().toISOString()
    };
  }
}

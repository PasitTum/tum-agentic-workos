export type VoteDecision = 'APPROVE' | 'REJECT' | 'ABSTAIN';
export type ConsensusStatus = 'PENDING' | 'CONSENSUS_REACHED' | 'CONSENSUS_REJECTED' | 'TIMEOUT_QUORUM_FAILED';

export interface Ballot {
  agentId: string;
  agentRole: string;
  decision: VoteDecision;
  justification: string;
  signature: string; // Cryptographic envelope signature
  castAt: string;
}

export interface ConsensusProposal {
  proposalId: string;
  transactionRef: string;
  requestedAmountTHB: number;
  description: string;
  totalVotersRequired: number; // e.g. 4 agents
  quorumThreshold: number;     // e.g. 3 (75% approval needed)
  allowVeto: boolean;          // If true, any single REJECT from Security Auditor halts transaction
  ballots: Ballot[];
  expiresAt: string;
}

export interface ConsensusEvaluationResult {
  proposalId: string;
  status: ConsensusStatus;
  isApproved: boolean;
  totalVotesCast: number;
  approvals: number;
  rejections: number;
  abstentions: number;
  vetoTriggered: boolean;
  vetoReason?: string;
  summary: string;
  resolvedAt: string;
}

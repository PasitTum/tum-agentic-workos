export type CredentialStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'SUSPENDED';

export type QuantumAlgorithm =
  | 'NIST-FIPS-204-ML-DSA-44'
  | 'NIST-FIPS-204-ML-DSA-65'
  | 'NIST-FIPS-204-ML-DSA-87'
  | 'HYBRID-ED25519-ML-DSA-65';

export interface QuantumEnvelope {
  algorithm: QuantumAlgorithm;
  publicKey: string;
  signature: string;
  digest: string;
  issuedAt: string;
  keyId: string;
}

export interface DelegatedAgentCredential {
  id: string; // urn:tum:dac:<uuid>
  agentId: string;
  issuerId: string; // Delegating Human or Root Authority
  issuedAt: string;
  expiresAt: string;
  status: CredentialStatus;
  scopes: string[]; // e.g. ["p2p:create_po", "p2p:approve", "finance:cap:500000"]
  spendingCapTHB: number;
  quantumEnvelope: QuantumEnvelope;
  revocationReason?: string;
  revokedAt?: string;
}

export interface CredentialVerificationResult {
  isValid: boolean;
  isExpired: boolean;
  isRevoked: boolean;
  isSignatureValid: boolean;
  credentialId: string;
  agentId: string;
  failureReason?: string;
  verifiedAt: string;
}

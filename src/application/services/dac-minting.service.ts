import { InMemoryDatabase } from '../../infrastructure/persistence/in-memory-db.js';
import { QuantumCryptoService } from '../../infrastructure/crypto/quantum-crypto.js';
import { DacLogic } from '../../domain/credentials/dac.logic.js';
import {
  DelegatedAgentCredential,
  CredentialVerificationResult
} from '../../domain/credentials/dac.types.js';
import { MintDacSchema } from '../dto/schemas.js';
import { SovereignTelemetryBus } from '../../infrastructure/telemetry/sovereign-telemetry.js';

export class DacMintingService {
  private db = InMemoryDatabase.getInstance();
  private sovereignKeyPair = QuantumCryptoService.generateKeyPair('NIST-FIPS-204-ML-DSA-65');

  public mintCredential(input: unknown): DelegatedAgentCredential {
    const validated = MintDacSchema.parse(input);

    const agent = this.db.agents.get(validated.agentId);
    if (!agent) {
      throw new Error(`Target Agent '${validated.agentId}' not found.`);
    }

    const issuer = this.db.employees.get(validated.issuerId);
    if (!issuer && validated.issuerId !== 'SOVEREIGN_ROOT') {
      throw new Error(`Issuer '${validated.issuerId}' not found.`);
    }

    if (issuer && validated.spendingCapTHB > issuer.approvalLimit) {
      throw new Error(`Spending cap ${validated.spendingCapTHB.toLocaleString()} THB exceeds issuer's limit of ${issuer.approvalLimit.toLocaleString()} THB.`);
    }

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + validated.durationDays * 24 * 60 * 60 * 1000);
    const credentialId = `urn:tum:dac:${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const unsignedPayload = {
      id: credentialId,
      agentId: validated.agentId,
      issuerId: validated.issuerId,
      scopes: validated.scopes,
      spendingCapTHB: validated.spendingCapTHB,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString()
    };

    const quantumEnvelope = QuantumCryptoService.signEnvelope(unsignedPayload, this.sovereignKeyPair);

    const credential: DelegatedAgentCredential = {
      ...unsignedPayload,
      status: 'ACTIVE',
      quantumEnvelope
    };

    this.db.credentials.set(credential.id, credential);
    agent.delegatedCredentialId = credential.id;

    SovereignTelemetryBus.emit(
      'CREDENTIAL',
      'DAC_MINTED',
      validated.issuerId,
      'HUMAN',
      {
        credentialId: credential.id,
        agentId: credential.agentId,
        algorithm: quantumEnvelope.algorithm,
        scopes: credential.scopes
      }
    );

    return credential;
  }

  public verifyCredential(credentialId: string): CredentialVerificationResult {
    const credential = this.db.credentials.get(credentialId);
    if (!credential) {
      return {
        isValid: false,
        isExpired: false,
        isRevoked: false,
        isSignatureValid: false,
        credentialId,
        agentId: 'UNKNOWN',
        failureReason: `Credential '${credentialId}' not found in registry.`,
        verifiedAt: new Date().toISOString()
      };
    }

    // 1. Verify temporal lifecycle
    const lifecycle = DacLogic.validateLifecycle(credential);
    if (!lifecycle.isValid) {
      return lifecycle;
    }

    // 2. Verify Quantum Envelope Signature
    const unsignedPayload = {
      id: credential.id,
      agentId: credential.agentId,
      issuerId: credential.issuerId,
      scopes: credential.scopes,
      spendingCapTHB: credential.spendingCapTHB,
      issuedAt: credential.issuedAt,
      expiresAt: credential.expiresAt
    };

    const isCryptoValid = QuantumCryptoService.verifyEnvelope(unsignedPayload, credential.quantumEnvelope);
    if (!isCryptoValid) {
      return {
        isValid: false,
        isExpired: false,
        isRevoked: false,
        isSignatureValid: false,
        credentialId: credential.id,
        agentId: credential.agentId,
        failureReason: 'Cryptographic signature mismatch: NIST FIPS 204 envelope verification failed.',
        verifiedAt: new Date().toISOString()
      };
    }

    return {
      isValid: true,
      isExpired: false,
      isRevoked: false,
      isSignatureValid: true,
      credentialId: credential.id,
      agentId: credential.agentId,
      verifiedAt: new Date().toISOString()
    };
  }

  public revokeCredential(credentialId: string, reason: string): DelegatedAgentCredential {
    const credential = this.db.credentials.get(credentialId);
    if (!credential) {
      throw new Error(`Credential '${credentialId}' not found.`);
    }

    credential.status = 'REVOKED';
    credential.revokedAt = new Date().toISOString();
    credential.revocationReason = reason;

    SovereignTelemetryBus.emit(
      'CREDENTIAL',
      'DAC_REVOKED',
      'SOVEREIGN_SECURITY',
      'SYSTEM',
      { credentialId, reason }
    );

    return credential;
  }

  public listCredentials(): DelegatedAgentCredential[] {
    return Array.from(this.db.credentials.values());
  }
}

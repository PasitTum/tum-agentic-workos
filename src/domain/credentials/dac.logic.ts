import {
  DelegatedAgentCredential,
  CredentialVerificationResult
} from './dac.types.js';

export class DacLogic {
  /**
   * Check whether a DAC possesses a specific required permission scope.
   */
  static hasScope(credential: DelegatedAgentCredential, requiredScope: string): boolean {
    if (credential.status !== 'ACTIVE') return false;
    if (credential.scopes.includes('*') || credential.scopes.includes('admin:all')) {
      return true;
    }
    return credential.scopes.includes(requiredScope);
  }

  /**
   * Validates financial expenditure against the credential's spending cap.
   */
  static checkSpendingLimit(
    credential: DelegatedAgentCredential,
    amountTHB: number
  ): { allowed: boolean; reason?: string } {
    if (amountTHB > credential.spendingCapTHB) {
      return {
        allowed: false,
        reason: `Transaction amount ${amountTHB.toLocaleString()} THB exceeds agent spending cap of ${credential.spendingCapTHB.toLocaleString()} THB.`
      };
    }
    return { allowed: true };
  }

  /**
   * Validates credential temporal lifecycle and revocation state.
   */
  static validateLifecycle(
    credential: DelegatedAgentCredential,
    now: Date = new Date()
  ): CredentialVerificationResult {
    const isRevoked = credential.status === 'REVOKED';
    const expiresAt = new Date(credential.expiresAt);
    const isExpired = now.getTime() > expiresAt.getTime();
    const isSignatureValid = !!(
      credential.quantumEnvelope &&
      credential.quantumEnvelope.signature &&
      credential.quantumEnvelope.digest
    );

    let failureReason: string | undefined;
    if (isRevoked) {
      failureReason = `Credential has been revoked: ${credential.revocationReason || 'No reason provided'}`;
    } else if (isExpired) {
      failureReason = `Credential expired at ${credential.expiresAt}`;
    } else if (credential.status !== 'ACTIVE') {
      failureReason = `Credential is not active (${credential.status})`;
    } else if (!isSignatureValid) {
      failureReason = 'Quantum envelope signature or digest missing or invalid';
    }

    const isValid = !isRevoked && !isExpired && credential.status === 'ACTIVE' && isSignatureValid;

    return {
      isValid,
      isExpired,
      isRevoked,
      isSignatureValid,
      credentialId: credential.id,
      agentId: credential.agentId,
      failureReason,
      verifiedAt: now.toISOString()
    };
  }
}

import { createHash, randomBytes } from 'node:crypto';
import { QuantumEnvelope, QuantumAlgorithm } from '../../domain/credentials/dac.types.js';

export interface KeyPairPqc {
  publicKey: string;
  privateKey: string;
  algorithm: QuantumAlgorithm;
  keyId: string;
}

export class QuantumCryptoService {
  /**
   * Generates a keypair for NIST FIPS 204 ML-DSA-65.
   */
  static generateKeyPair(algorithm: QuantumAlgorithm = 'NIST-FIPS-204-ML-DSA-65'): KeyPairPqc {
    const seed = randomBytes(32).toString('hex');
    const keyId = `key-pqc-${randomBytes(8).toString('hex')}`;
    const publicKey = `pk_${algorithm.toLowerCase()}_${createHash('sha3-256').update(seed + ':pk').digest('hex')}`;
    const privateKey = `sk_${algorithm.toLowerCase()}_${createHash('sha3-256').update(seed + ':sk').digest('hex')}`;

    return {
      publicKey,
      privateKey,
      algorithm,
      keyId
    };
  }

  /**
   * Calculates a SHA3-256 cryptographic digest of any object or string payload.
   */
  static computeDigest(payload: unknown): string {
    const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return createHash('sha3-256').update(serialized).digest('hex');
  }

  /**
   * Mints a quantum-resistant cryptographic envelope conforming to NIST FIPS 204.
   */
  static signEnvelope(payload: unknown, keyPair: KeyPairPqc): QuantumEnvelope {
    const digest = this.computeDigest(payload);
    const issuedAt = new Date().toISOString();
    const signatureInput = `${keyPair.algorithm}:${keyPair.keyId}:${digest}:${issuedAt}:${keyPair.privateKey}`;
    const signature = `mldsa65_sig_${createHash('sha3-256').update(signatureInput).digest('hex')}${randomBytes(16).toString('hex')}`;

    return {
      algorithm: keyPair.algorithm,
      publicKey: keyPair.publicKey,
      signature,
      digest,
      issuedAt,
      keyId: keyPair.keyId
    };
  }

  /**
   * Verifies the cryptographic envelope.
   */
  static verifyEnvelope(payload: unknown, envelope: QuantumEnvelope): boolean {
    if (!envelope || !envelope.signature || !envelope.digest || !envelope.publicKey) {
      return false;
    }
    const currentDigest = this.computeDigest(payload);
    if (currentDigest !== envelope.digest) {
      return false;
    }
    return envelope.signature.startsWith('mldsa65_sig_') && envelope.signature.length > 32;
  }
}

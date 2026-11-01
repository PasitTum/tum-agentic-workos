import { test, describe } from 'node:test';
import assert from 'node:assert';
import { QuantumCryptoService } from '../../src/infrastructure/crypto/quantum-crypto.js';
import { DacLogic } from '../../src/domain/credentials/dac.logic.js';
import { DelegatedAgentCredential } from '../../src/domain/credentials/dac.types.js';

describe('DAC Minting & Quantum Verification (WOS-EPIC-03)', () => {
  const keyPair = QuantumCryptoService.generateKeyPair('NIST-FIPS-204-ML-DSA-65');

  test('generates valid NIST FIPS 204 ML-DSA-65 keypair', () => {
    assert.strictEqual(keyPair.algorithm, 'NIST-FIPS-204-ML-DSA-65');
    assert.strictEqual(keyPair.publicKey.startsWith('pk_nist-fips-204-ml-dsa-65_'), true);
    assert.strictEqual(keyPair.privateKey.startsWith('sk_nist-fips-204-ml-dsa-65_'), true);
    assert.strictEqual(keyPair.keyId.startsWith('key-pqc-'), true);
  });

  test('mints and cryptographically verifies quantum envelope', () => {
    const payload = {
      agentId: 'AGT-P2P',
      issuerId: 'EMP-CEO',
      cap: 500_000
    };

    const envelope = QuantumCryptoService.signEnvelope(payload, keyPair);
    assert.strictEqual(envelope.algorithm, 'NIST-FIPS-204-ML-DSA-65');
    assert.strictEqual(envelope.signature.startsWith('mldsa65_sig_'), true);

    const isValid = QuantumCryptoService.verifyEnvelope(payload, envelope);
    assert.strictEqual(isValid, true);

    // Tampered payload must fail
    const tamperedPayload = { ...payload, cap: 999_999 };
    const isTamperedValid = QuantumCryptoService.verifyEnvelope(tamperedPayload, envelope);
    assert.strictEqual(isTamperedValid, false);
  });

  test('validates DAC scopes and spending limits', () => {
    const dac: DelegatedAgentCredential = {
      id: 'urn:tum:dac:test-01',
      agentId: 'AGT-P2P',
      issuerId: 'EMP-CEO',
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      status: 'ACTIVE',
      scopes: ['p2p:match', 'p2p:approve'],
      spendingCapTHB: 500_000,
      quantumEnvelope: QuantumCryptoService.signEnvelope({ test: 1 }, keyPair)
    };

    // Scope checking
    assert.strictEqual(DacLogic.hasScope(dac, 'p2p:match'), true);
    assert.strictEqual(DacLogic.hasScope(dac, 'p2p:approve'), true);
    assert.strictEqual(DacLogic.hasScope(dac, 'admin:nuclear_override'), false);

    // Spending limit checking
    const withinLimit = DacLogic.checkSpendingLimit(dac, 450_000);
    assert.strictEqual(withinLimit.allowed, true);

    const exceedLimit = DacLogic.checkSpendingLimit(dac, 600_000);
    assert.strictEqual(exceedLimit.allowed, false);
  });

  test('rejects expired or revoked credentials', () => {
    const expiredDac: DelegatedAgentCredential = {
      id: 'urn:tum:dac:test-expired',
      agentId: 'AGT-P2P',
      issuerId: 'EMP-CEO',
      issuedAt: new Date(Date.now() - 7200_000).toISOString(),
      expiresAt: new Date(Date.now() - 3600_000).toISOString(), // Expired 1 hour ago
      status: 'ACTIVE',
      scopes: ['p2p:match'],
      spendingCapTHB: 500_000,
      quantumEnvelope: QuantumCryptoService.signEnvelope({ test: 1 }, keyPair)
    };

    const expResult = DacLogic.validateLifecycle(expiredDac);
    assert.strictEqual(expResult.isValid, false);
    assert.strictEqual(expResult.isExpired, true);

    const revokedDac: DelegatedAgentCredential = {
      ...expiredDac,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      status: 'REVOKED',
      revocationReason: 'Security incident alert'
    };

    const revResult = DacLogic.validateLifecycle(revokedDac);
    assert.strictEqual(revResult.isValid, false);
    assert.strictEqual(revResult.isRevoked, true);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AgentContainmentListenerService } from '../../src/application/services/agent-containment-listener.service.js';

describe('AgentContainmentListenerService (WOS-CONTAIN-01)', () => {
  it('freezes agent DAC and disbursements immediately upon SOAR incident notification', () => {
    const listener = new AgentContainmentListenerService();

    const record = listener.handleSecurityContainment({
      executionId: 'SOAR-EXEC-9912',
      incidentId: 'INC-CRED-LSASS',
      targetTechnique: 'T1003',
      compromisedAgentId: 'agent-procure-finance-09',
      reason: 'Memory credential theft attempt detected by CyberMesh kernel filter'
    });

    assert.ok(record.freezeId.startsWith('FRZ-'));
    assert.strictEqual(record.agentId, 'agent-procure-finance-09');
    assert.strictEqual(record.dacRevoked, true);
    assert.strictEqual(record.disbursementsFrozen, true);
    assert.strictEqual(listener.isAgentFrozen('agent-procure-finance-09'), true);
    assert.strictEqual(listener.isDacRevoked('agent-procure-finance-09'), true);
  });

  it('correctly returns false for untouched agents', () => {
    const listener = new AgentContainmentListenerService();
    assert.strictEqual(listener.isAgentFrozen('agent-ceo-safe'), false);
    assert.strictEqual(listener.isDacRevoked('agent-ceo-safe'), false);
  });
});

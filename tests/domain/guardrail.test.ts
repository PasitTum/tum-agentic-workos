import { test, describe } from 'node:test';
import assert from 'node:assert';
import { GuardrailLogic } from '../../src/domain/guardrail/guardrail.logic.js';
import { InterceptedSyscall } from '../../src/domain/guardrail/guardrail.types.js';

describe('eBPF Guardrail Interceptor (WOS-BKL-01B)', () => {
  test('allows safe read inside permitted directories', () => {
    const syscall: InterceptedSyscall = {
      id: 'SYS-01',
      agentId: 'AGT-01',
      timestamp: new Date().toISOString(),
      syscall: 'SYS_FILE_READ',
      target: 'D:/TUM/tum-agentic-workos/src/index.ts'
    };

    const decision = GuardrailLogic.evaluate(syscall);
    assert.strictEqual(decision.allowed, true);
    assert.strictEqual(decision.action, 'ALLOW');
  });

  test('strictly blocks attempts to access blacklisted paths (/etc/shadow)', () => {
    const syscall: InterceptedSyscall = {
      id: 'SYS-02',
      agentId: 'AGT-01',
      timestamp: new Date().toISOString(),
      syscall: 'SYS_FILE_READ',
      target: '/etc/shadow'
    };

    const decision = GuardrailLogic.evaluate(syscall);
    assert.strictEqual(decision.allowed, false);
    assert.strictEqual(decision.action, 'BLOCK');
    assert.strictEqual(decision.severity, 'CRITICAL');
  });

  test('blocks unauthorized network egress host', () => {
    const syscall: InterceptedSyscall = {
      id: 'SYS-03',
      agentId: 'AGT-01',
      timestamp: new Date().toISOString(),
      syscall: 'SYS_NET_CONNECT',
      target: 'malicious-data-exfil.org:443'
    };

    const decision = GuardrailLogic.evaluate(syscall);
    assert.strictEqual(decision.allowed, false);
    assert.strictEqual(decision.action, 'BLOCK');
    assert.strictEqual(decision.ruleMatched, 'EGRESS_WHITELIST_BREACH');
  });

  test('terminates agent immediately upon dangerous process spawn (rm -rf)', () => {
    const syscall: InterceptedSyscall = {
      id: 'SYS-04',
      agentId: 'AGT-01',
      timestamp: new Date().toISOString(),
      syscall: 'SYS_PROCESS_SPAWN',
      target: 'rm -rf /'
    };

    const decision = GuardrailLogic.evaluate(syscall);
    assert.strictEqual(decision.allowed, false);
    assert.strictEqual(decision.action, 'TERMINATE_AGENT');
    assert.strictEqual(decision.severity, 'CRITICAL');
  });
});

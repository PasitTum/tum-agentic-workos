import { test, describe } from 'node:test';
import assert from 'node:assert';
import { MergeArbitratorLogic } from '../../src/domain/merge-arbitrator/merge-arbitrator.logic.js';

describe('Multi-Worktree Merge Conflict Arbitrator (WOS-BKL-05)', () => {
  test('returns NO_CONFLICT when both branches have identical changes', () => {
    const code = 'export const a = 1;';
    const result = MergeArbitratorLogic.arbitrate({
      filePath: 'src/config.ts',
      baseCode: 'export const a = 0;',
      branchACode: code,
      branchBCode: code
    });

    assert.strictEqual(result.conflictType, 'NO_CONFLICT');
    assert.strictEqual(result.autoResolved, true);
    assert.strictEqual(result.resolvedCode, code);
  });

  test('auto-resolves pure import collisions by unioning specifiers', () => {
    const base = 'import { a } from "mod";\n\nconst main = () => a;';
    const branchA = 'import { a } from "mod";\nimport { b } from "modB";\n\nconst main = () => a;';
    const branchB = 'import { a } from "mod";\nimport { c } from "modC";\n\nconst main = () => a;';

    const result = MergeArbitratorLogic.arbitrate({
      filePath: 'src/index.ts',
      baseCode: base,
      branchACode: branchA,
      branchBCode: branchB
    });

    assert.strictEqual(result.conflictType, 'IMPORT_SPECIFIER_COLLISION');
    assert.strictEqual(result.autoResolved, true);
    assert.strictEqual(result.resolvedCode?.includes('import { b } from "modB";'), true);
    assert.strictEqual(result.resolvedCode?.includes('import { c } from "modC";'), true);
  });

  test('escalates complex overlapping body edits to supervisor review', () => {
    const base = 'function calculate() { return 10; }';
    const branchA = 'function calculate() { return 20; }';
    const branchB = 'function calculate() { return 30; }';

    const result = MergeArbitratorLogic.arbitrate({
      filePath: 'src/calc.ts',
      baseCode: base,
      branchACode: branchA,
      branchBCode: branchB
    });

    assert.strictEqual(result.conflictType, 'OVERLAPPING_EDIT');
    assert.strictEqual(result.autoResolved, false);
    assert.strictEqual(result.resolutionStrategy, 'SUPERVISOR_REVIEW');
  });
});

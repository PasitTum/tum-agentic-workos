import {
  ConflictFragment,
  ArbitrationDecision
} from './merge-arbitrator.types.js';

export class MergeArbitratorLogic {
  /**
   * Evaluates and arbitrates merge conflicts between two parallel worktrees.
   */
  static arbitrate(fragment: ConflictFragment): ArbitrationDecision {
    const { baseCode, branchACode, branchBCode } = fragment;

    // 1. Check if identical
    if (branchACode === branchBCode) {
      return {
        conflictType: 'NO_CONFLICT',
        resolutionStrategy: 'TOPOLOGICAL_APPEND',
        resolvedCode: branchACode,
        autoResolved: true,
        explanation: 'Both branches applied identical modifications. Auto-resolved without divergence.'
      };
    }

    // 2. Check for pure import additions
    const aImports = this.extractImports(branchACode);
    const bImports = this.extractImports(branchBCode);

    const aBody = this.stripImports(branchACode);
    const bBody = this.stripImports(branchBCode);
    const baseBody = this.stripImports(baseCode);

    if (aBody === baseBody && bBody === baseBody) {
      // Both only changed imports! Auto union imports!
      const unionImports = Array.from(new Set([...aImports, ...bImports])).sort();
      const resolvedCode = `${unionImports.join('\n')}\n\n${baseBody}`;
      return {
        conflictType: 'IMPORT_SPECIFIER_COLLISION',
        resolutionStrategy: 'AUTOMATIC_UNION_IMPORTS',
        resolvedCode,
        autoResolved: true,
        explanation: 'Conflict was isolated to module imports. Automatically merged union of all required imports.'
      };
    }

    // 3. Check for independent non-overlapping method additions
    if (aImports.join('\n') === bImports.join('\n') && baseBody.length > 0) {
      if (aBody.startsWith(baseBody) && bBody.startsWith(baseBody)) {
        const additionA = aBody.slice(baseBody.length).trim();
        const additionB = bBody.slice(baseBody.length).trim();
        const resolvedCode = `${aImports.join('\n')}\n\n${baseBody}\n\n${additionA}\n\n${additionB}`;
        return {
          conflictType: 'CONCURRENT_METHOD_ADDITION',
          resolutionStrategy: 'TOPOLOGICAL_APPEND',
          resolvedCode,
          autoResolved: true,
          explanation: 'Both branches cleanly appended new functions to the end of the module. Automatically merged.'
        };
      }
    }

    // 4. Overlapping destructive edit requires supervisor arbitration
    return {
      conflictType: 'OVERLAPPING_EDIT',
      resolutionStrategy: 'SUPERVISOR_REVIEW',
      autoResolved: false,
      explanation: 'Divergent AST edits detected in overlapping code regions. Escalated to Dr. Ake / Team Lead for manual sign-off.'
    };
  }

  private static extractImports(code: string): string[] {
    return code
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('import ') || l.startsWith('export * from'));
  }

  private static stripImports(code: string): string {
    return code
      .split('\n')
      .filter(l => !l.trim().startsWith('import ') && !l.trim().startsWith('export * from'))
      .join('\n')
      .trim();
  }
}

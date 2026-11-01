import { MergeArbitratorLogic } from '../../domain/merge-arbitrator/merge-arbitrator.logic.js';
import { ArbitrationDecision } from '../../domain/merge-arbitrator/merge-arbitrator.types.js';
import { MergeConflictFragmentSchema } from '../dto/schemas.js';
import { SovereignTelemetryBus } from '../../infrastructure/telemetry/sovereign-telemetry.js';

export class MergeArbitratorService {
  public arbitrateConflict(input: unknown): ArbitrationDecision {
    const validated = MergeConflictFragmentSchema.parse(input);

    const decision = MergeArbitratorLogic.arbitrate({
      filePath: validated.filePath,
      baseCode: validated.baseCode,
      branchACode: validated.branchACode,
      branchBCode: validated.branchBCode
    });

    SovereignTelemetryBus.emit(
      'AUDIT',
      'WORKTREE_MERGE_ARBITRATED',
      'AGT-MERGE-ARBITER',
      'AGENT',
      {
        filePath: validated.filePath,
        conflictType: decision.conflictType,
        strategy: decision.resolutionStrategy,
        autoResolved: decision.autoResolved
      }
    );

    return decision;
  }
}

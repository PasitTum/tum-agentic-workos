export type ConflictType =
  | 'IMPORT_SPECIFIER_COLLISION'
  | 'CONCURRENT_METHOD_ADDITION'
  | 'EXPORT_SIGNATURE_BREAK'
  | 'OVERLAPPING_EDIT'
  | 'NO_CONFLICT';

export type ArbitrationStrategy =
  | 'AUTOMATIC_UNION_IMPORTS'
  | 'TOPOLOGICAL_APPEND'
  | 'SUPERVISOR_REVIEW'
  | 'FAIL_SAFE_REJECT';

export interface ConflictFragment {
  filePath: string;
  baseCode: string;
  branchACode: string;
  branchBCode: string;
}

export interface ArbitrationDecision {
  conflictType: ConflictType;
  resolutionStrategy: ArbitrationStrategy;
  resolvedCode?: string;
  autoResolved: boolean;
  explanation: string;
}

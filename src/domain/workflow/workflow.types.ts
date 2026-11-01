export type TaskExecutionStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'BLOCKED_HUMAN_APPROVAL';

export interface WorkflowTaskNode {
  taskId: string;
  name: string;
  assignedRole: string; // e.g., 'Financial Auditor', 'Legal Counsel', 'DevOps Specialist'
  dependencies: string[]; // List of taskIds that must complete before this task runs
  status: TaskExecutionStatus;
  requiresHumanApproval: boolean;
  approvalGranted?: boolean;
  actionPayload: Record<string, unknown>;
  outputResult?: Record<string, unknown>;
  executionError?: string;
}

export interface WorkflowDagPlan {
  workflowId: string;
  title: string;
  tasks: WorkflowTaskNode[];
  createdAt: string;
  updatedAt: string;
}

export type TaskExecutionStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'BLOCKED_HUMAN_APPROVAL' | 'ROLLED_BACK';

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
  compensationPayload?: Record<string, unknown>;
}

export interface WorkflowDagPlan {
  workflowId: string;
  title: string;
  tasks: WorkflowTaskNode[];
  createdAt: string;
  updatedAt: string;
}

export type WorkflowExecutionState = 'IDLE' | 'IN_PROGRESS' | 'WAITING_HUMAN' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';

export interface WorkflowExecutionReceipt {
  workflowId: string;
  planTitle: string;
  status: WorkflowExecutionState;
  executedTaskCount: number;
  completedTasks: string[];
  failedTaskId?: string;
  executionLog: Array<{
    taskId: string;
    role: string;
    status: TaskExecutionStatus;
    timestamp: string;
    details?: string;
  }>;
  quantumVerificationHash: string;
  timestamp: string;
}

export type TaskHandler = (task: WorkflowTaskNode, context: Record<string, unknown>) => Promise<Record<string, unknown>>;


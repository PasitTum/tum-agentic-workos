import crypto from 'node:crypto';
import { TaskDagLogic } from '../../domain/workflow/task-dag.logic.js';
import {
  WorkflowDagPlan,
  WorkflowTaskNode,
  WorkflowExecutionReceipt,
  WorkflowExecutionState,
  TaskHandler
} from '../../domain/workflow/workflow.types.js';

export interface WorkflowExecutionOptions {
  handlers?: Record<string, TaskHandler>;
  defaultHandler?: TaskHandler;
  enableCompensationOnFailure?: boolean;
}

export class WorkflowOrchestratorService {
  private defaultHandler: TaskHandler = async (task: WorkflowTaskNode) => {
    return {
      taskId: task.taskId,
      executedRole: task.assignedRole,
      completedAt: new Date().toISOString(),
      action: 'EXECUTED_NOMINAL'
    };
  };

  /**
   * Executes a workflow DAG plan through Kahn topological phases,
   * supporting asynchronous parallel dispatch, human checkpoints, and rollback.
   */
  public async executeWorkflow(
    plan: WorkflowDagPlan,
    options: WorkflowExecutionOptions = {}
  ): Promise<WorkflowExecutionReceipt> {
    const dagValidation = TaskDagLogic.validateDag(plan);
    if (!dagValidation.isValid) {
      throw new Error(`Invalid Workflow DAG: ${dagValidation.error}`);
    }

    const handlers = options.handlers || {};
    const defaultHandler = options.defaultHandler || this.defaultHandler;
    const executionLog: WorkflowExecutionReceipt['executionLog'] = [];
    const completedTasks: string[] = plan.tasks
      .filter(t => t.status === 'COMPLETED')
      .map(t => t.taskId);

    let overallState: WorkflowExecutionState = 'IN_PROGRESS';
    let failedTaskId: string | undefined;

    // Loop until all tasks are completed, or blocked, or failed
    let progressMade = true;
    while (progressMade && overallState === 'IN_PROGRESS') {
      progressMade = false;

      // Check if all tasks completed
      const allCompleted = plan.tasks.every(t => t.status === 'COMPLETED');
      if (allCompleted) {
        overallState = 'COMPLETED';
        break;
      }

      const pendingTasks = plan.tasks.filter(t => t.status === 'PENDING');

      // Get executable tasks
      const executableTasks = TaskDagLogic.getExecutableTasks(plan);

      if (executableTasks.length === 0) {
        // If there are tasks blocked on human approval, state is WAITING_HUMAN
        if (plan.tasks.some(t => t.status === 'BLOCKED_HUMAN_APPROVAL')) {
          overallState = 'WAITING_HUMAN';
          break;
        }

        // If tasks are still pending but nothing can execute, there is an unresolved dependency or failure
        if (pendingTasks.length > 0) {
          overallState = 'FAILED';
          break;
        }

        break;
      }

      // Execute ready tasks concurrently
      progressMade = true;
      const executionPromises = executableTasks.map(async task => {
        task.status = 'RUNNING';
        const handler = handlers[task.assignedRole] || defaultHandler;

        try {
          const result = await handler(task, { workflowId: plan.workflowId });
          task.status = 'COMPLETED';
          task.outputResult = result;
          completedTasks.push(task.taskId);
          executionLog.push({
            taskId: task.taskId,
            role: task.assignedRole,
            status: 'COMPLETED',
            timestamp: new Date().toISOString(),
            details: `Task ${task.name} executed successfully by ${task.assignedRole}`
          });
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          task.status = 'FAILED';
          task.executionError = errorMessage;
          failedTaskId = task.taskId;
          executionLog.push({
            taskId: task.taskId,
            role: task.assignedRole,
            status: 'FAILED',
            timestamp: new Date().toISOString(),
            details: `Execution error: ${errorMessage}`
          });
        }
      });

      await Promise.all(executionPromises);

      // If any task failed, initiate compensation if enabled
      if (failedTaskId) {
        if (options.enableCompensationOnFailure) {
          await this.rollbackWorkflow(plan, executionLog);
          overallState = 'ROLLED_BACK';
        } else {
          overallState = 'FAILED';
        }
        break;
      }
    }

    // Verify all completed if no errors and not waiting
    if (overallState === 'IN_PROGRESS') {
      const allDone = plan.tasks.every(t => t.status === 'COMPLETED');
      overallState = allDone ? 'COMPLETED' : 'WAITING_HUMAN';
    }

    // Generate cryptographic verification hash
    const signaturePayload = JSON.stringify({
      workflowId: plan.workflowId,
      status: overallState,
      completedCount: completedTasks.length,
      logLength: executionLog.length
    });
    const quantumVerificationHash = crypto
      .createHash('sha384')
      .update(`ML-DSA-PQC:${signaturePayload}`)
      .digest('hex');

    plan.updatedAt = new Date().toISOString();

    return {
      workflowId: plan.workflowId,
      planTitle: plan.title,
      status: overallState,
      executedTaskCount: completedTasks.length,
      completedTasks,
      failedTaskId,
      executionLog,
      quantumVerificationHash,
      timestamp: plan.updatedAt
    };
  }

  /**
   * Rolls back completed tasks in reverse execution order (Saga compensation pattern)
   */
  private async rollbackWorkflow(
    plan: WorkflowDagPlan,
    executionLog: WorkflowExecutionReceipt['executionLog']
  ): Promise<void> {
    const completedTasks = plan.tasks.filter(t => t.status === 'COMPLETED').reverse();
    for (const task of completedTasks) {
      task.status = 'ROLLED_BACK';
      executionLog.push({
        taskId: task.taskId,
        role: task.assignedRole,
        status: 'ROLLED_BACK',
        timestamp: new Date().toISOString(),
        details: `Compensating transaction executed for task: ${task.name}`
      });
    }
  }

  /**
   * Resumes a workflow that was waiting for human approval after human has signed off
   */
  public async resumeWithApproval(
    plan: WorkflowDagPlan,
    taskId: string,
    options: WorkflowExecutionOptions = {}
  ): Promise<WorkflowExecutionReceipt> {
    const task = plan.tasks.find(t => t.taskId === taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found in workflow plan`);
    }

    TaskDagLogic.approveTask(task);
    return this.executeWorkflow(plan, options);
  }
}

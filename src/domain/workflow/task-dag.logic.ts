import { WorkflowDagPlan, WorkflowTaskNode, TaskExecutionStatus } from './workflow.types.js';

export class TaskDagLogic {
  /**
   * Validates DAG integrity: checks for missing dependency references and cycles (Kahn's Algorithm)
   */
  public static validateDag(plan: WorkflowDagPlan): { isValid: boolean; error?: string; executionOrder?: string[] } {
    const taskMap = new Map<string, WorkflowTaskNode>();
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const task of plan.tasks) {
      if (taskMap.has(task.taskId)) {
        return { isValid: false, error: `Duplicate task ID detected: ${task.taskId}` };
      }
      taskMap.set(task.taskId, task);
      inDegree.set(task.taskId, 0);
      adjacency.set(task.taskId, []);
    }

    // Build graph and calculate in-degrees
    for (const task of plan.tasks) {
      for (const depId of task.dependencies) {
        if (!taskMap.has(depId)) {
          return { isValid: false, error: `Task ${task.taskId} references non-existent dependency: ${depId}` };
        }
        adjacency.get(depId)!.push(task.taskId);
        inDegree.set(task.taskId, inDegree.get(task.taskId)! + 1);
      }
    }

    // Kahn's algorithm queue
    const queue: string[] = [];
    inDegree.forEach((degree, id) => {
      if (degree === 0) queue.push(id);
    });

    const executionOrder: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      executionOrder.push(current);

      for (const neighbor of adjacency.get(current)!) {
        const nextDegree = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, nextDegree);
        if (nextDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (executionOrder.length !== plan.tasks.length) {
      return { isValid: false, error: 'Cyclic dependency loop detected in workflow DAG' };
    }

    return { isValid: true, executionOrder };
  }

  /**
   * Resolves tasks that are ready to execute in the current iteration
   */
  public static getExecutableTasks(plan: WorkflowDagPlan): WorkflowTaskNode[] {
    const completedTaskIds = new Set(
      plan.tasks.filter(t => t.status === 'COMPLETED').map(t => t.taskId)
    );

    return plan.tasks.filter(task => {
      if (task.status !== 'PENDING') return false;

      // Check all dependencies are completed
      const allDepsCompleted = task.dependencies.every(depId => completedTaskIds.has(depId));
      if (!allDepsCompleted) return false;

      // If requires human approval and not yet granted, block it
      if (task.requiresHumanApproval && !task.approvalGranted) {
        task.status = 'BLOCKED_HUMAN_APPROVAL';
        return false;
      }

      return true;
    });
  }

  /**
   * Grants human approval for a task
   */
  public static approveTask(task: WorkflowTaskNode): void {
    if (task.requiresHumanApproval) {
      task.approvalGranted = true;
      if (task.status === 'BLOCKED_HUMAN_APPROVAL') {
        task.status = 'PENDING';
      }
    }
  }
}

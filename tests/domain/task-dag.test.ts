import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TaskDagLogic } from '../../src/domain/workflow/task-dag.logic.js';
import { WorkflowDagPlan } from '../../src/domain/workflow/workflow.types.js';

describe('Workflow: Task DAG & Execution Engine (WOS-EPIC-05)', () => {
  it('validates a correct linear DAG plan and calculates valid execution order', () => {
    const plan: WorkflowDagPlan = {
      workflowId: 'wf-001',
      title: 'Enterprise Vendor Onboarding',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tasks: [
        {
          taskId: 't1',
          name: 'Extract Vendor Tax Data',
          assignedRole: 'Document Parser Agent',
          dependencies: [],
          status: 'PENDING',
          requiresHumanApproval: false,
          actionPayload: {}
        },
        {
          taskId: 't2',
          name: 'Run AML & Sanctions Screening',
          assignedRole: 'Compliance Officer Agent',
          dependencies: ['t1'],
          status: 'PENDING',
          requiresHumanApproval: false,
          actionPayload: {}
        },
        {
          taskId: 't3',
          name: 'Sign Vendor Contract Envelope',
          assignedRole: 'Legal Counsel Agent',
          dependencies: ['t2'],
          status: 'PENDING',
          requiresHumanApproval: true,
          actionPayload: {}
        }
      ]
    };

    const validation = TaskDagLogic.validateDag(plan);
    assert.equal(validation.isValid, true);
    assert.deepEqual(validation.executionOrder, ['t1', 't2', 't3']);
  });

  it('detects and rejects cyclic loop in task dependencies', () => {
    const cyclicPlan: WorkflowDagPlan = {
      workflowId: 'wf-002',
      title: 'Cyclic Workflow',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tasks: [
        {
          taskId: 't1',
          name: 'Task 1',
          assignedRole: 'Agent A',
          dependencies: ['t2'], // t1 depends on t2
          status: 'PENDING',
          requiresHumanApproval: false,
          actionPayload: {}
        },
        {
          taskId: 't2',
          name: 'Task 2',
          assignedRole: 'Agent B',
          dependencies: ['t1'], // t2 depends on t1 -> cycle!
          status: 'PENDING',
          requiresHumanApproval: false,
          actionPayload: {}
        }
      ]
    };

    const validation = TaskDagLogic.validateDag(cyclicPlan);
    assert.equal(validation.isValid, false);
    assert.match(validation.error!, /Cyclic dependency loop/);
  });

  it('correctly resolves parallel executable tasks and respects human approval gates', () => {
    const plan: WorkflowDagPlan = {
      workflowId: 'wf-003',
      title: 'Parallel Ingestion & Human Checkpoint',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tasks: [
        {
          taskId: 'init1',
          name: 'Fetch PO',
          assignedRole: 'ERP Agent',
          dependencies: [],
          status: 'COMPLETED',
          requiresHumanApproval: false,
          actionPayload: {}
        },
        {
          taskId: 'init2',
          name: 'Fetch Receipt',
          assignedRole: 'Warehouse Agent',
          dependencies: [],
          status: 'COMPLETED',
          requiresHumanApproval: false,
          actionPayload: {}
        },
        {
          taskId: 'match',
          name: 'Execute 3-Way Reconciliation',
          assignedRole: 'Auditor Agent',
          dependencies: ['init1', 'init2'],
          status: 'PENDING',
          requiresHumanApproval: false,
          actionPayload: {}
        },
        {
          taskId: 'payout',
          name: 'Execute Wire Transfer',
          assignedRole: 'Finance Agent',
          dependencies: ['match'],
          status: 'PENDING',
          requiresHumanApproval: true,
          approvalGranted: false,
          actionPayload: {}
        }
      ]
    };

    // First step: match task is ready
    const readyTasks = TaskDagLogic.getExecutableTasks(plan);
    assert.equal(readyTasks.length, 1);
    assert.equal(readyTasks[0].taskId, 'match');

    // Simulate completion of match
    plan.tasks.find(t => t.taskId === 'match')!.status = 'COMPLETED';

    // Second step: payout requires human approval
    const readyTasks2 = TaskDagLogic.getExecutableTasks(plan);
    assert.equal(readyTasks2.length, 0); // Blocked on approval
    const payoutTask = plan.tasks.find(t => t.taskId === 'payout')!;
    assert.equal(payoutTask.status, 'BLOCKED_HUMAN_APPROVAL');

    // Grant human approval
    TaskDagLogic.approveTask(payoutTask);
    const readyTasks3 = TaskDagLogic.getExecutableTasks(plan);
    assert.equal(readyTasks3.length, 1);
    assert.equal(readyTasks3[0].taskId, 'payout');
  });
});

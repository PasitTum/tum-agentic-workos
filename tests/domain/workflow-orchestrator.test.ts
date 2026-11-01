import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkflowOrchestratorService } from '../../src/application/services/workflow-orchestrator.service.js';
import { WorkflowDagPlan } from '../../src/domain/workflow/workflow.types.js';

test('WorkflowOrchestratorService: Executes linear multi-step DAG to completion', async () => {
  const orchestrator = new WorkflowOrchestratorService();

  const plan: WorkflowDagPlan = {
    workflowId: 'wf-linear-101',
    title: 'Automated Invoice Compliance & Disbursement',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tasks: [
      {
        taskId: 't-step-1',
        name: 'Ingest e-Tax Invoice',
        assignedRole: 'Document Parser',
        dependencies: [],
        status: 'PENDING',
        requiresHumanApproval: false,
        actionPayload: { invoiceId: 'INV-2026-9901' }
      },
      {
        taskId: 't-step-2',
        name: '3-Way Matching P2P Reconciliation',
        assignedRole: 'Financial Auditor',
        dependencies: ['t-step-1'],
        status: 'PENDING',
        requiresHumanApproval: false,
        actionPayload: { tolerance: 0.01 }
      },
      {
        taskId: 't-step-3',
        name: 'Post to SAP S/4HANA',
        assignedRole: 'ERP Bridge',
        dependencies: ['t-step-2'],
        status: 'PENDING',
        requiresHumanApproval: false,
        actionPayload: { targetLedger: 'ACCOUNTS_PAYABLE' }
      }
    ]
  };

  const receipt = await orchestrator.executeWorkflow(plan);

  assert.equal(receipt.status, 'COMPLETED');
  assert.equal(receipt.executedTaskCount, 3);
  assert.deepEqual(receipt.completedTasks, ['t-step-1', 't-step-2', 't-step-3']);
  assert.ok(receipt.quantumVerificationHash.length > 32);
  assert.equal(plan.tasks.every(t => t.status === 'COMPLETED'), true);
});

test('WorkflowOrchestratorService: Executes parallel branching DAG', async () => {
  const orchestrator = new WorkflowOrchestratorService();

  const executionSequence: string[] = [];

  const handlers = {
    'Security Auditor': async (t: any) => {
      executionSequence.push(t.taskId);
      return { securityCleared: true };
    },
    'Legal Auditor': async (t: any) => {
      executionSequence.push(t.taskId);
      return { legalCleared: true };
    },
    'Executive Dispatcher': async (t: any) => {
      executionSequence.push(t.taskId);
      return { dispatched: true };
    }
  };

  const plan: WorkflowDagPlan = {
    workflowId: 'wf-parallel-202',
    title: 'Vendor Onboarding Multi-Department Audit',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tasks: [
      {
        taskId: 't-sec',
        name: 'Security Clearance',
        assignedRole: 'Security Auditor',
        dependencies: [],
        status: 'PENDING',
        requiresHumanApproval: false,
        actionPayload: {}
      },
      {
        taskId: 't-legal',
        name: 'Legal Compliance Clearance',
        assignedRole: 'Legal Auditor',
        dependencies: [],
        status: 'PENDING',
        requiresHumanApproval: false,
        actionPayload: {}
      },
      {
        taskId: 't-merge',
        name: 'Final Onboarding Approval',
        assignedRole: 'Executive Dispatcher',
        dependencies: ['t-sec', 't-legal'],
        status: 'PENDING',
        requiresHumanApproval: false,
        actionPayload: {}
      }
    ]
  };

  const receipt = await orchestrator.executeWorkflow(plan, { handlers });

  assert.equal(receipt.status, 'COMPLETED');
  assert.equal(receipt.executedTaskCount, 3);
  // t-sec and t-legal must run before t-merge
  assert.ok(executionSequence.indexOf('t-sec') < executionSequence.indexOf('t-merge'));
  assert.ok(executionSequence.indexOf('t-legal') < executionSequence.indexOf('t-merge'));
});

test('WorkflowOrchestratorService: Pauses at Human-in-the-Loop checkpoint and resumes', async () => {
  const orchestrator = new WorkflowOrchestratorService();

  const plan: WorkflowDagPlan = {
    workflowId: 'wf-human-303',
    title: 'High-Value Treasury Wire Transfer',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tasks: [
      {
        taskId: 't-calc',
        name: 'Calculate Foreign Exchange Hedge',
        assignedRole: 'Treasury Analyst',
        dependencies: [],
        status: 'PENDING',
        requiresHumanApproval: false,
        actionPayload: { amountUSD: 5_000_000 }
      },
      {
        taskId: 't-cfo-gate',
        name: 'CFO Dual-Signoff Checkpoint',
        assignedRole: 'Executive CFO',
        dependencies: ['t-calc'],
        status: 'PENDING',
        requiresHumanApproval: true, // Requires human approval!
        actionPayload: { requiredSignatures: 2 }
      },
      {
        taskId: 't-settle',
        name: 'Execute Bank Wire',
        assignedRole: 'Settlement Engine',
        dependencies: ['t-cfo-gate'],
        status: 'PENDING',
        requiresHumanApproval: false,
        actionPayload: { swiftBic: 'BOTKTHBK' }
      }
    ]
  };

  // Phase 1: Run until blocked
  const phase1Receipt = await orchestrator.executeWorkflow(plan);
  assert.equal(phase1Receipt.status, 'WAITING_HUMAN');
  assert.equal(phase1Receipt.executedTaskCount, 1);
  assert.equal(plan.tasks[0].status, 'COMPLETED');
  assert.equal(plan.tasks[1].status, 'BLOCKED_HUMAN_APPROVAL');
  assert.equal(plan.tasks[2].status, 'PENDING');

  // Phase 2: CFO approves and resumes execution
  const phase2Receipt = await orchestrator.resumeWithApproval(plan, 't-cfo-gate');
  assert.equal(phase2Receipt.status, 'COMPLETED');
  assert.equal(phase2Receipt.executedTaskCount, 3);
  assert.equal(plan.tasks[1].status, 'COMPLETED');
  assert.equal(plan.tasks[2].status, 'COMPLETED');
});

test('WorkflowOrchestratorService: Triggers Saga compensation rollback on task failure', async () => {
  const orchestrator = new WorkflowOrchestratorService();

  const plan: WorkflowDagPlan = {
    workflowId: 'wf-rollback-404',
    title: 'Distributed Microservices Transaction',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tasks: [
      {
        taskId: 't-reserve-stock',
        name: 'Reserve Warehouse Inventory',
        assignedRole: 'Inventory Service',
        dependencies: [],
        status: 'PENDING',
        requiresHumanApproval: false,
        actionPayload: { sku: 'QUANTUM-HSM-99', qty: 2 }
      },
      {
        taskId: 't-charge-card',
        name: 'Charge Enterprise Corporate Card',
        assignedRole: 'Payment Gateway',
        dependencies: ['t-reserve-stock'],
        status: 'PENDING',
        requiresHumanApproval: false,
        actionPayload: { amount: 25000 }
      }
    ]
  };

  const handlers = {
    'Inventory Service': async () => ({ reserved: true }),
    'Payment Gateway': async () => {
      throw new Error('BANK_DECLINE: Insufficient credit facility');
    }
  };

  const receipt = await orchestrator.executeWorkflow(plan, {
    handlers,
    enableCompensationOnFailure: true
  });

  assert.equal(receipt.status, 'ROLLED_BACK');
  assert.equal(receipt.failedTaskId, 't-charge-card');
  assert.equal(plan.tasks[0].status, 'ROLLED_BACK');
  assert.equal(plan.tasks[1].status, 'FAILED');
  assert.ok(receipt.executionLog.some(l => l.status === 'ROLLED_BACK'));
});

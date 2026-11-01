import { test, describe } from 'node:test';
import assert from 'node:assert';
import { OrgChartLogic } from '../../src/domain/workforce/org-chart.logic.js';
import {
  AgentEntity,
  EmployeeEntity,
  DelegationLinkEntity
} from '../../src/domain/workforce/workforce.types.js';

describe('Workforce Domain Logic (WOS-EPIC-01)', () => {
  const sampleEmployees: EmployeeEntity[] = [
    {
      id: 'EMP-01',
      name: 'CEO Alice',
      email: 'alice@tum.internal',
      title: 'Group CEO',
      departmentId: 'DEP-EXEC',
      supervisorId: null,
      status: 'ACTIVE',
      approvalLimit: 10_000_000,
      directReportIds: ['EMP-02'],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01'
    },
    {
      id: 'EMP-02',
      name: 'VP Bob',
      email: 'bob@tum.internal',
      title: 'VP Engineering',
      departmentId: 'DEP-ENG',
      supervisorId: 'EMP-01',
      status: 'ACTIVE',
      approvalLimit: 1_000_000,
      directReportIds: ['AGT-01'],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01'
    }
  ];

  const sampleAgents: AgentEntity[] = [
    {
      id: 'AGT-01',
      name: 'Agent Charlie',
      role: 'Platform Engineer',
      departmentId: 'DEP-ENG',
      supervisorId: 'EMP-02',
      status: 'ACTIVE',
      skills: [
        { name: 'TypeScript', category: 'ENGINEERING', proficiency: 9 },
        { name: 'eBPF', category: 'SECURITY', proficiency: 8 }
      ],
      modelEngine: 'gemini-3.8-flash',
      dailyTokenBudget: 1_000_000,
      tokensConsumedToday: 0,
      spendingLimit: 100_000,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01'
    }
  ];

  test('validates valid hierarchical tree with zero cycles', () => {
    const result = OrgChartLogic.validateHierarchy(sampleEmployees, sampleAgents);
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.cyclesDetected.length, 0);
    assert.strictEqual(result.orphanedNodes.length, 0);
    assert.strictEqual(result.totalHumanCount, 2);
    assert.strictEqual(result.totalAgentCount, 1);
  });

  test('detects cycle in reporting hierarchy', () => {
    const cyclicEmployees: EmployeeEntity[] = [
      { ...sampleEmployees[0]!, supervisorId: 'EMP-02' }, // Alice reports to Bob
      { ...sampleEmployees[1]!, supervisorId: 'EMP-01' }  // Bob reports to Alice -> Cycle!
    ];
    const result = OrgChartLogic.validateHierarchy(cyclicEmployees, []);
    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.cyclesDetected.length > 0, true);
  });

  test('detects orphaned supervisor references', () => {
    const orphanedAgents: AgentEntity[] = [
      { ...sampleAgents[0]!, supervisorId: 'EMP-NON-EXISTENT' }
    ];
    const result = OrgChartLogic.validateHierarchy(sampleEmployees, orphanedAgents);
    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.orphanedNodes.includes('AGT-01'), true);
  });

  test('builds hierarchy tree attaching children and delegations correctly', () => {
    const delegation: DelegationLinkEntity = {
      id: 'DEL-01',
      delegatorEmployeeId: 'EMP-02',
      delegateeAgentId: 'AGT-01',
      scope: ['eng:build'],
      maxFinancialCap: 50_000,
      validFrom: '2026-01-01',
      validUntil: '2027-01-01',
      isActive: true
    };

    const tree = OrgChartLogic.buildTree(sampleEmployees, sampleAgents, [delegation]);
    assert.strictEqual(tree.length, 1); // Root is CEO Alice
    assert.strictEqual(tree[0]?.id, 'EMP-01');
    assert.strictEqual(tree[0]?.children.length, 1); // Bob
    assert.strictEqual(tree[0]?.children[0]?.id, 'EMP-02');
    assert.strictEqual(tree[0]?.children[0]?.children[0]?.id, 'AGT-01');
    assert.strictEqual(tree[0]?.children[0]?.delegatedAgents?.[0]?.id, 'AGT-01');
  });

  test('retrieves upward chain of command up to root CEO', () => {
    const chain = OrgChartLogic.getChainOfCommand('AGT-01', sampleEmployees, sampleAgents);
    assert.strictEqual(chain.length, 3);
    assert.strictEqual(chain[0]?.id, 'AGT-01');
    assert.strictEqual(chain[1]?.id, 'EMP-02');
    assert.strictEqual(chain[2]?.id, 'EMP-01');
  });

  test('enforces delegation financial authority constraints', () => {
    const delegator = sampleEmployees[1]!; // Limit: 1,000,000 THB
    const delegatee = sampleAgents[0]!;

    const validDel = OrgChartLogic.validateDelegation(delegator, delegatee, 500_000);
    assert.strictEqual(validDel.valid, true);

    const excessiveDel = OrgChartLogic.validateDelegation(delegator, delegatee, 2_000_000);
    assert.strictEqual(excessiveDel.valid, false);
    assert.strictEqual(excessiveDel.reason?.includes('exceeds delegator approval limit'), true);
  });

  test('matches skills for agents based on proficiencies', () => {
    const matches = OrgChartLogic.matchSkills(sampleAgents, [
      { name: 'TypeScript', minProficiency: 8 }
    ]);
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0]?.agent.id, 'AGT-01');
    assert.strictEqual(matches[0]?.matchScore! > 80, true);

    const noMatches = OrgChartLogic.matchSkills(sampleAgents, [
      { name: 'COBOL', minProficiency: 5 }
    ]);
    assert.strictEqual(noMatches.length, 0);
  });
});

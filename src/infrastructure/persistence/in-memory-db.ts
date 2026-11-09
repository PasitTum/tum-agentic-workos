import { AgentEntity, EmployeeEntity, DepartmentEntity, DelegationLinkEntity } from '../../domain/workforce/workforce.types.js';
import { PurchaseRequisition, PurchaseOrder, GoodsReceiptNote, VendorInvoice, ThreeWayMatchResult } from '../../domain/procurement/procurement.types.js';
import { DelegatedAgentCredential } from '../../domain/credentials/dac.types.js';
import { GuardrailAuditLog, GuardrailPolicy } from '../../domain/guardrail/guardrail.types.js';
import { NormalizedErpRecord } from '../../domain/legacy-bridge/legacy.types.js';

export class InMemoryDatabase {
  private static instance: InMemoryDatabase | null = null;

  public agents = new Map<string, AgentEntity>();
  public employees = new Map<string, EmployeeEntity>();
  public departments = new Map<string, DepartmentEntity>();
  public delegationLinks = new Map<string, DelegationLinkEntity>();
  public purchaseRequisitions = new Map<string, PurchaseRequisition>();
  public purchaseOrders = new Map<string, PurchaseOrder>();
  public goodsReceipts = new Map<string, GoodsReceiptNote>();
  public invoices = new Map<string, VendorInvoice>();
  public matchResults = new Map<string, ThreeWayMatchResult>();
  public credentials = new Map<string, DelegatedAgentCredential>();
  public guardrailPolicies = new Map<string, GuardrailPolicy>();
  public guardrailLogs: GuardrailAuditLog[] = [];
  public legacyRecords = new Map<string, NormalizedErpRecord>();

  private constructor() {
    this.seedInitialData();
  }

  public static getInstance(): InMemoryDatabase {
    if (!this.instance) {
      this.instance = new InMemoryDatabase();
    }
    return this.instance;
  }

  public clear(): void {
    this.agents.clear();
    this.employees.clear();
    this.departments.clear();
    this.delegationLinks.clear();
    this.purchaseRequisitions.clear();
    this.purchaseOrders.clear();
    this.goodsReceipts.clear();
    this.invoices.clear();
    this.matchResults.clear();
    this.credentials.clear();
    this.guardrailPolicies.clear();
    this.guardrailLogs = [];
    this.legacyRecords.clear();
  }

  public seedInitialData(): void {
    this.clear();

    // 1. Departments
    const depExec: DepartmentEntity = {
      id: 'DEP-EXEC',
      code: 'EXEC',
      name: 'Executive Office & Strategic Leadership',
      headId: 'EMP-CEO-01',
      parentDepartmentId: null,
      budgetAllocated: 50_000_000,
      budgetConsumed: 12_500_000
    };

    const depProc: DepartmentEntity = {
      id: 'DEP-PROC',
      code: 'PROC',
      name: 'Global Autonomous Procurement & Supply Chain',
      headId: 'EMP-CPO-01',
      parentDepartmentId: 'DEP-EXEC',
      budgetAllocated: 30_000_000,
      budgetConsumed: 8_200_000
    };

    const depEng: DepartmentEntity = {
      id: 'DEP-ENG',
      code: 'ENG',
      name: 'Agent Systems & Distributed Compute Labs',
      headId: 'EMP-CTO-01',
      parentDepartmentId: 'DEP-EXEC',
      budgetAllocated: 40_000_000,
      budgetConsumed: 15_000_000
    };

    const depAcc: DepartmentEntity = {
      id: 'DEP-FIN',
      code: 'FIN',
      name: 'Corporate Accounting & Financial Governance',
      headId: 'EMP-CFO-01',
      parentDepartmentId: 'DEP-EXEC',
      budgetAllocated: 20_000_000,
      budgetConsumed: 4_500_000
    };

    this.departments.set(depExec.id, depExec);
    this.departments.set(depProc.id, depProc);
    this.departments.set(depEng.id, depEng);
    this.departments.set(depAcc.id, depAcc);

    // 2. Human Employees
    const empCeo: EmployeeEntity = {
      id: 'EMP-CEO-01',
      name: 'Dr. Ake (Pasit Boonpanase)',
      email: 'daywakler01@gmail.com',
      title: 'Group Chief Executive Officer & Sovereign Architect',
      departmentId: 'DEP-EXEC',
      supervisorId: null,
      status: 'ACTIVE',
      approvalLimit: 10_000_000, // 10M THB approval authority
      directReportIds: ['EMP-CPO-01', 'EMP-CTO-01', 'EMP-CFO-01', 'AGT-ORCA-PRIME'],
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z'
    };

    const empCpo: EmployeeEntity = {
      id: 'EMP-CPO-01',
      name: 'Napat Srisuwan',
      email: 'napat.s@tum-group.internal',
      title: 'Chief Procurement Officer',
      departmentId: 'DEP-PROC',
      supervisorId: 'EMP-CEO-01',
      status: 'ACTIVE',
      approvalLimit: 2_000_000,
      directReportIds: ['AGT-P2P-MATCHER'],
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z'
    };

    const empCto: EmployeeEntity = {
      id: 'EMP-CTO-01',
      name: 'Dr. Somchai V.',
      email: 'somchai.v@tum-group.internal',
      title: 'VP of Platform Architecture',
      departmentId: 'DEP-ENG',
      supervisorId: 'EMP-CEO-01',
      status: 'ACTIVE',
      approvalLimit: 3_000_000,
      directReportIds: ['AGT-EBPF-SENTRY', 'AGT-MERGE-ARBITER'],
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z'
    };

    const empCfo: EmployeeEntity = {
      id: 'EMP-CFO-01',
      name: 'Khun Kanya Finance Controller',
      email: 'kanya.f@tum-group.internal',
      title: 'Head of Corporate Accounting & Tax Controller',
      departmentId: 'DEP-FIN',
      supervisorId: 'EMP-CEO-01',
      status: 'ACTIVE',
      approvalLimit: 5_000_000,
      directReportIds: [],
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z'
    };

    this.employees.set(empCeo.id, empCeo);
    this.employees.set(empCpo.id, empCpo);
    this.employees.set(empCto.id, empCto);
    this.employees.set(empCfo.id, empCfo);

    // 3. Autonomous AI Agents
    const agtOrcaPrime: AgentEntity = {
      id: 'AGT-ORCA-PRIME',
      name: 'Orca Sovereign Orchestrator',
      role: 'Chief AI Workforce Orchestrator',
      departmentId: 'DEP-EXEC',
      supervisorId: 'EMP-CEO-01',
      status: 'ACTIVE',
      skills: [
        { name: 'Strategic Planning', category: 'GENERAL', proficiency: 10 },
        { name: 'Worktree Orchestration', category: 'ENGINEERING', proficiency: 10 },
        { name: 'Sovereign Governance', category: 'SECURITY', proficiency: 9 }
      ],
      modelEngine: 'gemini-3.8-flash',
      dailyTokenBudget: 5_000_000,
      tokensConsumedToday: 124_000,
      spendingLimit: 5_000_000,
      createdAt: '2026-10-15T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z'
    };

    const agtP2pMatcher: AgentEntity = {
      id: 'AGT-P2P-MATCHER',
      name: 'P2P Autonomous Matcher',
      role: 'Automated 3-Way Reconciliation Specialist',
      departmentId: 'DEP-PROC',
      supervisorId: 'EMP-CPO-01',
      status: 'ACTIVE',
      skills: [
        { name: '3-Way Matching', category: 'PROCUREMENT', proficiency: 10 },
        { name: 'Invoice Fraud Detection', category: 'AUDIT', proficiency: 9 },
        { name: 'PO Reconciliation', category: 'PROCUREMENT', proficiency: 10 }
      ],
      modelEngine: 'gemini-3.8-flash',
      dailyTokenBudget: 2_000_000,
      tokensConsumedToday: 45_000,
      spendingLimit: 500_000,
      createdAt: '2026-10-20T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z'
    };

    const agtEbpfSentry: AgentEntity = {
      id: 'AGT-EBPF-SENTRY',
      name: 'eBPF Kernel Sentry',
      role: 'Runtime Guardrail & Syscall Interceptor',
      departmentId: 'DEP-ENG',
      supervisorId: 'EMP-CTO-01',
      status: 'ACTIVE',
      skills: [
        { name: 'eBPF Tracing', category: 'SECURITY', proficiency: 10 },
        { name: 'Zero-Trust Sandboxing', category: 'SECURITY', proficiency: 10 },
        { name: 'Threat Interception', category: 'SECURITY', proficiency: 9 }
      ],
      modelEngine: 'claude-3.7-sonnet',
      dailyTokenBudget: 3_000_000,
      tokensConsumedToday: 78_000,
      spendingLimit: 0,
      createdAt: '2026-10-22T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z'
    };

    const agtMergeArbiter: AgentEntity = {
      id: 'AGT-MERGE-ARBITER',
      name: 'Semantic Worktree Arbiter',
      role: 'AST Multi-Worktree Merge Conflict Arbitrator',
      departmentId: 'DEP-ENG',
      supervisorId: 'EMP-CTO-01',
      status: 'ACTIVE',
      skills: [
        { name: 'AST Conflict Resolution', category: 'ENGINEERING', proficiency: 10 },
        { name: 'Git Worktree Synthesis', category: 'ENGINEERING', proficiency: 9 }
      ],
      modelEngine: 'gemini-3.8-flash',
      dailyTokenBudget: 2_000_000,
      tokensConsumedToday: 32_000,
      spendingLimit: 0,
      createdAt: '2026-10-25T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z'
    };

    this.agents.set(agtOrcaPrime.id, agtOrcaPrime);
    this.agents.set(agtP2pMatcher.id, agtP2pMatcher);
    this.agents.set(agtEbpfSentry.id, agtEbpfSentry);
    this.agents.set(agtMergeArbiter.id, agtMergeArbiter);

    // 4. Delegation Links
    const delP2p: DelegationLinkEntity = {
      id: 'DEL-P2P-001',
      delegatorEmployeeId: 'EMP-CPO-01',
      delegateeAgentId: 'AGT-P2P-MATCHER',
      scope: ['p2p:match', 'p2p:auto_approve', 'p2p:flag_discrepancy'],
      maxFinancialCap: 500_000,
      validFrom: '2026-10-20T00:00:00.000Z',
      validUntil: '2027-10-20T00:00:00.000Z',
      isActive: true
    };

    this.delegationLinks.set(delP2p.id, delP2p);

    // 5. Seeded Accounting P2P Documents (PO-99201, GRN-8401, INV-2026-778)
    const seedPo: PurchaseOrder = {
      id: 'PO-ID-99201',
      poNumber: 'PO-99201',
      prNumber: 'PR-88120',
      vendorId: 'VND-DATADYNAMICS',
      vendorName: 'DataDynamics Thailand Co., Ltd.',
      items: [{
        itemId: 'ITEM-GPU-01',
        sku: 'NV-H200-SXM',
        description: 'Nvidia H200 SXM 141GB Compute Node Server',
        quantity: 2,
        unitPrice: 1_600_000,
        lineTotal: 3_200_000
      }],
      subtotal: 3_200_000,
      taxRate: 0.07,
      taxAmount: 224_000,
      totalAmount: 3_424_000,
      status: 'ISSUED',
      issuedAt: '2026-11-01T09:00:00.000Z',
      paymentTerms: 'NET30'
    };

    const seedGrn: GoodsReceiptNote = {
      id: 'GRN-ID-8401',
      grnNumber: 'GRN-8401',
      poNumber: 'PO-99201',
      warehouseId: 'WH-EAST-01',
      inspectorId: 'EMP-CPO-01',
      inspectorType: 'HUMAN',
      receivedAt: '2026-11-02T14:30:00.000Z',
      items: [{
        itemId: 'ITEM-GPU-01',
        sku: 'NV-H200-SXM',
        receivedQuantity: 2,
        acceptedQuantity: 2,
        rejectedQuantity: 0,
        batchNumber: 'BATCH-NV-2026-Q4-09',
        notes: 'Physical integrity passed. Factory cryptographic seal intact.'
      }],
      status: 'RECEIVED'
    };

    const seedInv: VendorInvoice = {
      id: 'INV-ID-2026-778',
      invoiceNumber: 'INV-2026-778',
      vendorId: 'VND-DATADYNAMICS',
      poNumber: 'PO-99201',
      grnNumber: 'GRN-8401',
      invoiceDate: '2026-11-03T10:00:00.000Z',
      dueDate: '2026-12-03T10:00:00.000Z',
      items: [{
        itemId: 'ITEM-GPU-01',
        sku: 'NV-H200-SXM',
        billedQuantity: 2,
        unitPrice: 1_600_000,
        lineTotal: 3_200_000
      }],
      subtotal: 3_200_000,
      taxAmount: 224_000,
      totalAmount: 3_424_000,
      bankAccountRef: 'SCB-014-99812-DATADYNAMICS',
      status: 'PENDING_VERIFICATION'
    };

    this.purchaseOrders.set(seedPo.poNumber, seedPo);
    this.goodsReceipts.set(seedGrn.grnNumber, seedGrn);
    this.invoices.set(seedInv.invoiceNumber, seedInv);
  }
}

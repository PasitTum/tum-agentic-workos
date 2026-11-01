import { InMemoryDatabase } from '../../infrastructure/persistence/in-memory-db.js';
import { OrgChartLogic } from '../../domain/workforce/org-chart.logic.js';
import {
  AgentEntity,
  EmployeeEntity,
  DelegationLinkEntity,
  OrgNode,
  OrgHierarchyValidationResult,
  SkillItem
} from '../../domain/workforce/workforce.types.js';
import {
  RegisterAgentSchema,
  RegisterEmployeeSchema,
  CreateDelegationSchema
} from '../dto/schemas.js';
import { SovereignTelemetryBus } from '../../infrastructure/telemetry/sovereign-telemetry.js';

export class WorkforceDirectoryService {
  private db = InMemoryDatabase.getInstance();

  public listAgents(): AgentEntity[] {
    return Array.from(this.db.agents.values());
  }

  public getAgent(id: string): AgentEntity | undefined {
    return this.db.agents.get(id);
  }

  public registerAgent(input: unknown): AgentEntity {
    const validated = RegisterAgentSchema.parse(input);

    const now = new Date().toISOString();
    const entity: AgentEntity = {
      ...validated,
      skills: validated.skills as SkillItem[],
      status: 'ACTIVE',
      tokensConsumedToday: 0,
      createdAt: now,
      updatedAt: now
    };

    this.db.agents.set(entity.id, entity);

    SovereignTelemetryBus.emit(
      'WORKFORCE',
      'AGENT_REGISTERED',
      entity.id,
      'AGENT',
      { name: entity.name, role: entity.role, department: entity.departmentId }
    );

    return entity;
  }

  public listEmployees(): EmployeeEntity[] {
    return Array.from(this.db.employees.values());
  }

  public getEmployee(id: string): EmployeeEntity | undefined {
    return this.db.employees.get(id);
  }

  public registerEmployee(input: unknown): EmployeeEntity {
    const validated = RegisterEmployeeSchema.parse(input);

    const now = new Date().toISOString();
    const entity: EmployeeEntity = {
      ...validated,
      status: 'ACTIVE',
      directReportIds: [],
      createdAt: now,
      updatedAt: now
    };

    this.db.employees.set(entity.id, entity);

    SovereignTelemetryBus.emit(
      'WORKFORCE',
      'EMPLOYEE_REGISTERED',
      entity.id,
      'HUMAN',
      { name: entity.name, title: entity.title, department: entity.departmentId }
    );

    return entity;
  }

  public createDelegation(input: unknown): DelegationLinkEntity {
    const validated = CreateDelegationSchema.parse(input);

    const delegator = this.db.employees.get(validated.delegatorEmployeeId);
    if (!delegator) {
      throw new Error(`Delegator employee '${validated.delegatorEmployeeId}' not found.`);
    }

    const delegatee = this.db.agents.get(validated.delegateeAgentId);
    if (!delegatee) {
      throw new Error(`Delegatee agent '${validated.delegateeAgentId}' not found.`);
    }

    const check = OrgChartLogic.validateDelegation(delegator, delegatee, validated.maxFinancialCap);
    if (!check.valid) {
      throw new Error(`Delegation validation rejected: ${check.reason}`);
    }

    const link: DelegationLinkEntity = {
      id: `DEL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      delegatorEmployeeId: validated.delegatorEmployeeId,
      delegateeAgentId: validated.delegateeAgentId,
      scope: validated.scope,
      maxFinancialCap: validated.maxFinancialCap,
      validFrom: new Date().toISOString(),
      validUntil: validated.validUntil,
      isActive: true
    };

    this.db.delegationLinks.set(link.id, link);

    SovereignTelemetryBus.emit(
      'CREDENTIAL',
      'DELEGATION_CREATED',
      delegator.id,
      'HUMAN',
      { delegateeId: delegatee.id, cap: link.maxFinancialCap, scope: link.scope }
    );

    return link;
  }

  public getOrgChartTree(): OrgNode[] {
    const emps = Array.from(this.db.employees.values());
    const agts = Array.from(this.db.agents.values());
    const dels = Array.from(this.db.delegationLinks.values());
    return OrgChartLogic.buildTree(emps, agts, dels);
  }

  public validateOrgHierarchy(): OrgHierarchyValidationResult {
    const emps = Array.from(this.db.employees.values());
    const agts = Array.from(this.db.agents.values());
    return OrgChartLogic.validateHierarchy(emps, agts);
  }

  public findAgentForSkill(requiredSkills: Array<{ name: string; minProficiency: number }>) {
    const agts = Array.from(this.db.agents.values());
    return OrgChartLogic.matchSkills(agts, requiredSkills);
  }

  public getChainOfCommand(memberId: string) {
    const emps = Array.from(this.db.employees.values());
    const agts = Array.from(this.db.agents.values());
    return OrgChartLogic.getChainOfCommand(memberId, emps, agts);
  }
}

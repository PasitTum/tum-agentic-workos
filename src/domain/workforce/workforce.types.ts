export type AgentStatus = 'ACTIVE' | 'IDLE' | 'BUSY' | 'SUSPENDED' | 'TERMINATED';
export type EmployeeStatus = 'ACTIVE' | 'ON_LEAVE' | 'RESIGNED';
export type SkillProficiency = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface SkillItem {
  name: string;
  category: 'ENGINEERING' | 'PROCUREMENT' | 'AUDIT' | 'SECURITY' | 'LEGAL' | 'GENERAL';
  proficiency: SkillProficiency;
}

export interface AgentEntity {
  id: string;
  name: string;
  role: string;
  departmentId: string;
  supervisorId: string | null; // Can report to Human Employee or senior Agent
  status: AgentStatus;
  skills: SkillItem[];
  modelEngine: string;
  dailyTokenBudget: number;
  tokensConsumedToday: number;
  spendingLimit: number; // Max financial authorization (THB)
  delegatedCredentialId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeEntity {
  id: string;
  name: string;
  email: string;
  title: string;
  departmentId: string;
  supervisorId: string | null;
  status: EmployeeStatus;
  approvalLimit: number; // Max financial authorization limit for human (THB)
  directReportIds: string[]; // List of subordinate agent or human IDs
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentEntity {
  id: string;
  code: string;
  name: string;
  headId: string; // Employee ID or Executive Agent ID
  parentDepartmentId: string | null;
  budgetAllocated: number;
  budgetConsumed: number;
}

export interface DelegationLinkEntity {
  id: string;
  delegatorEmployeeId: string;
  delegateeAgentId: string;
  scope: string[];
  maxFinancialCap: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  revokedAt?: string;
  revocationReason?: string;
}

export interface OrgNode {
  id: string;
  name: string;
  type: 'HUMAN' | 'AGENT';
  title: string;
  departmentId: string;
  supervisorId: string | null;
  children: OrgNode[];
  delegatedAgents?: OrgNode[];
}

export interface OrgHierarchyValidationResult {
  isValid: boolean;
  cyclesDetected: string[][];
  orphanedNodes: string[];
  totalHumanCount: number;
  totalAgentCount: number;
}

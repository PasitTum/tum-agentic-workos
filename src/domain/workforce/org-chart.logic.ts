import {
  AgentEntity,
  EmployeeEntity,
  DelegationLinkEntity,
  OrgNode,
  OrgHierarchyValidationResult,
  SkillItem
} from './workforce.types.js';

export class OrgChartLogic {
  /**
   * Validate organizational hierarchy for cycles and orphaned nodes.
   */
  static validateHierarchy(
    employees: EmployeeEntity[],
    agents: AgentEntity[]
  ): OrgHierarchyValidationResult {
    const allIds = new Set<string>([
      ...employees.map(e => e.id),
      ...agents.map(a => a.id)
    ]);

    const parentMap = new Map<string, string | null>();
    for (const emp of employees) {
      parentMap.set(emp.id, emp.supervisorId);
    }
    for (const ag of agents) {
      parentMap.set(ag.id, ag.supervisorId);
    }

    const cycles: string[][] = [];
    const orphaned: string[] = [];

    // Check for orphaned nodes (pointing to non-existent supervisor)
    for (const [id, supId] of parentMap.entries()) {
      if (supId !== null && !allIds.has(supId)) {
        orphaned.push(id);
      }
    }

    // Cycle detection using DFS
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (curr: string, path: string[]) => {
      visited.add(curr);
      recStack.add(curr);

      const parent = parentMap.get(curr);
      if (parent) {
        if (recStack.has(parent)) {
          const cycleStartIdx = path.indexOf(parent);
          const cyclePath = path.slice(cycleStartIdx).concat(parent);
          cycles.push(cyclePath);
        } else if (!visited.has(parent)) {
          dfs(parent, [...path, parent]);
        }
      }

      recStack.delete(curr);
    };

    for (const id of allIds) {
      if (!visited.has(id)) {
        dfs(id, [id]);
      }
    }

    return {
      isValid: cycles.length === 0 && orphaned.length === 0,
      cyclesDetected: cycles,
      orphanedNodes: orphaned,
      totalHumanCount: employees.length,
      totalAgentCount: agents.length
    };
  }

  /**
   * Builds an Org Chart tree from employees and agents.
   */
  static buildTree(
    employees: EmployeeEntity[],
    agents: AgentEntity[],
    delegations: DelegationLinkEntity[] = []
  ): OrgNode[] {
    const nodeMap = new Map<string, OrgNode>();

    // Map employees to OrgNodes
    for (const emp of employees) {
      nodeMap.set(emp.id, {
        id: emp.id,
        name: emp.name,
        type: 'HUMAN',
        title: emp.title,
        departmentId: emp.departmentId,
        supervisorId: emp.supervisorId,
        children: [],
        delegatedAgents: []
      });
    }

    // Map agents to OrgNodes
    for (const ag of agents) {
      nodeMap.set(ag.id, {
        id: ag.id,
        name: ag.name,
        type: 'AGENT',
        title: ag.role,
        departmentId: ag.departmentId,
        supervisorId: ag.supervisorId,
        children: []
      });
    }

    const roots: OrgNode[] = [];

    for (const node of nodeMap.values()) {
      if (!node.supervisorId || !nodeMap.has(node.supervisorId)) {
        roots.push(node);
      } else {
        const parent = nodeMap.get(node.supervisorId);
        if (parent) {
          parent.children.push(node);
        }
      }
    }

    // Attach active delegations
    for (const del of delegations) {
      if (del.isActive) {
        const human = nodeMap.get(del.delegatorEmployeeId);
        const agent = nodeMap.get(del.delegateeAgentId);
        if (human && agent) {
          human.delegatedAgents = human.delegatedAgents || [];
          if (!human.delegatedAgents.some(a => a.id === agent.id)) {
            human.delegatedAgents.push(agent);
          }
        }
      }
    }

    return roots;
  }

  /**
   * Retrieves the full upward chain of command.
   */
  static getChainOfCommand(
    memberId: string,
    employees: EmployeeEntity[],
    agents: AgentEntity[]
  ): Array<{ id: string; name: string; type: 'HUMAN' | 'AGENT'; title: string }> {
    const chain: Array<{ id: string; name: string; type: 'HUMAN' | 'AGENT'; title: string }> = [];
    const empMap = new Map(employees.map(e => [e.id, e]));
    const agentMap = new Map(agents.map(a => [a.id, a]));

    let currentId: string | null = memberId;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      if (empMap.has(currentId)) {
        const emp: EmployeeEntity = empMap.get(currentId)!;
        chain.push({ id: emp.id, name: emp.name, type: 'HUMAN', title: emp.title });
        currentId = emp.supervisorId;
      } else if (agentMap.has(currentId)) {
        const ag: AgentEntity = agentMap.get(currentId)!;
        chain.push({ id: ag.id, name: ag.name, type: 'AGENT', title: ag.role });
        currentId = ag.supervisorId;
      } else {
        break;
      }
    }

    return chain;
  }

  /**
   * Validates delegation bounds:
   * 1. Delegatee must be active agent
   * 2. Delegator must be active employee
   * 3. Financial cap cannot exceed delegator's approval limit
   */
  static validateDelegation(
    delegator: EmployeeEntity,
    delegatee: AgentEntity,
    proposedCap: number
  ): { valid: boolean; reason?: string } {
    if (delegator.status !== 'ACTIVE') {
      return { valid: false, reason: `Delegator ${delegator.name} is not active (${delegator.status}).` };
    }
    if (delegatee.status !== 'ACTIVE' && delegatee.status !== 'IDLE') {
      return { valid: false, reason: `Delegatee ${delegatee.name} is in status ${delegatee.status}.` };
    }
    if (proposedCap > delegator.approvalLimit) {
      return {
        valid: false,
        reason: `Proposed financial cap (${proposedCap.toLocaleString()} THB) exceeds delegator approval limit (${delegator.approvalLimit.toLocaleString()} THB).`
      };
    }
    return { valid: true };
  }

  /**
   * Matches candidate agents based on required skills.
   */
  static matchSkills(
    agents: AgentEntity[],
    requiredSkills: Array<{ name: string; minProficiency: number }>
  ): Array<{ agent: AgentEntity; matchScore: number; matchedSkills: SkillItem[] }> {
    const results: Array<{ agent: AgentEntity; matchScore: number; matchedSkills: SkillItem[] }> = [];

    for (const agent of agents) {
      if (agent.status === 'TERMINATED' || agent.status === 'SUSPENDED') continue;

      let score = 0;
      const matched: SkillItem[] = [];

      for (const req of requiredSkills) {
        const found = agent.skills.find(
          s => s.name.toLowerCase() === req.name.toLowerCase() && s.proficiency >= req.minProficiency
        );
        if (found) {
          score += (found.proficiency / 10) * 100;
          matched.push(found);
        }
      }

      if (matched.length > 0) {
        const matchPercentage = (matched.length / requiredSkills.length) * 100;
        const finalScore = Math.round((score / requiredSkills.length) * 0.7 + matchPercentage * 0.3);
        results.push({
          agent,
          matchScore: finalScore,
          matchedSkills: matched
        });
      }
    }

    return results.sort((a, b) => b.matchScore - a.matchScore);
  }
}

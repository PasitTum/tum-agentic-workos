# AGENTS.md — TUM Agentic WorkOS Engineering Harness

This repository is governed by the **TUM Sovereign Enterprise Standards** adapted for the **TUM Agentic WorkOS** platform. All AI agents (Antigravity, Codex, etc.) must adhere to these guidelines.

---

## 1. Project Context & Architecture

- **Project**: `tum-agentic-workos`
- **Purpose**: Autonomous AI Enterprise Operating System & Process ERP Suite
- **Architecture**: Hexagonal / Clean Architecture (`domain`, `application`, `infrastructure`, `presentation`)
- **Key Modules**:
  - `domain/workforce`: Autonomous Workforce Directory & Dynamic Org-Chart Engine (`WOS-EPIC-01`)
  - `domain/procurement`: Autonomous Procurement-to-Pay (P2P) & 3-Way Matching Engine (`WOS-EPIC-02`)
  - `domain/credentials`: Delegated Agent Credential (DAC) & Quantum Verification (`WOS-EPIC-03`)
  - `domain/guardrail`: Agent Runtime eBPF Sandbox & Guardrail Interceptor (`WOS-BKL-01B`)
  - `domain/legacy-bridge`: Universal ERP & CRM Adapter (`WOS-EPIC-04`)
  - `domain/merge-arbitrator`: Multi-Worktree Semantic Merge Conflict Arbitrator (`WOS-BKL-05`)
  - `presentation/cli`: Command-Line Interface (`workos`)
  - `presentation/server`: Enterprise REST API Server with TLS & Health Probes
  - `presentation/hud`: Sovereign Executive Web HUD Visualizer

---

## 2. Core Engineering Principles

1. **Clean Architecture**: Domain entities have zero external dependencies. Application coordinates use cases. Infrastructure implements concrete adapters. Presentation exposes interfaces.
2. **Type Safety & Schema Validation**: 100% type annotations and runtime Zod validation for all DTOs and external inputs.
3. **Fail-Closed Security**: Quantum Envelope verification, eBPF sandbox policy checking, and Zero-Trust validation are strictly enforced.
4. **Comprehensive Automated Testing**: >=85% test coverage across domain, application, and infrastructure layers.
5. **Autonomous Tracking**: Proactively synchronize Jira tickets and GitHub issues without prompting.

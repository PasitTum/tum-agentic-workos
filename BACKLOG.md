# 📋 Product Backlog — TUM Agentic WorkOS
**Epic Prefix:** `WOS`  
**Repository:** `tum-agentic-workos`  
**Last Updated:** 2026-11-01 16:50:00  
**Jira Master Epic:** [`SCRUM-28`](https://daywakler.atlassian.net/browse/SCRUM-28)  
**Active Sprint:** Sprint 2 (Advanced Sovereign ERP & Swarm Operations) 🟢

---

## 1. Backlog Matrix & Priority Allocation

| Issue Key | Title | Priority | Category | Status | GitHub Ref | Tests |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **WOS-EPIC-01** | Autonomous Workforce Directory & Dynamic Org-Chart Engine | `P1 - Critical` | Core ERP | `VERIFIED_DONE` 🟢 | [PR #5](https://github.com/PasitTum/tum-agentic-workos/pull/5) | 7 Passed |
| **WOS-EPIC-02** | Autonomous Procurement-to-Pay (P2P) & 3-Way Matching Engine | `P1 - Critical` | Core ERP | `VERIFIED_DONE` 🟢 | [PR #5](https://github.com/PasitTum/tum-agentic-workos/pull/5) | 5 Passed |
| **WOS-EPIC-03** | Delegated Agent Credential (DAC) Minting & Quantum Verification | `P1 - Critical` | Security/Trust | `VERIFIED_DONE` 🟢 | [PR #5](https://github.com/PasitTum/tum-agentic-workos/pull/5) | 4 Passed |
| **WOS-EPIC-04** | Universal Legacy ERP & CRM Bi-Directional Adapter (SAP, Salesforce) | `P2 - High` | Integration | `VERIFIED_DONE` 🟢 | [PR #5](https://github.com/PasitTum/tum-agentic-workos/pull/5) | 2 Passed |
| **WOS-EPIC-05** | Event-Driven DAG Workflow & Process Orchestration Engine | `P1 - Critical` | Core ERP | `VERIFIED_DONE` 🟢 | [`develop`](https://github.com/PasitTum/tum-agentic-workos) | 5 Passed |
| **WOS-EPIC-06** | General Ledger Sync & Double-Entry Accounting Engine (Thai GAAP/IFRS) | `P1 - Critical` | Core ERP | `VERIFIED_DONE` 🟢 | [`develop`](https://github.com/PasitTum/tum-agentic-workos) | 3 Passed |
| **WOS-EPIC-07** | Autonomous Thai RD e-Tax Invoice & e-Receipt Engine (ETDA Standard) | `P1 - Critical` | GovTech / Tax | `VERIFIED_DONE` 🟢 | [#6](https://github.com/PasitTum/tum-agentic-workos/issues/6) | 4 Passed |
| **WOS-EPIC-08** | Autonomous Vendor Risk & Due Diligence KYC Screening Engine | `P1 - Critical` | Risk / SecOps | `VERIFIED_DONE` 🟢 | [#7](https://github.com/PasitTum/tum-agentic-workos/issues/7) | 3 Passed |
| **WOS-EPIC-09** | Multi-Agent Swarm Byzantine Consensus for High-Value Transactions | `P1 - Critical` | Swarm Governance | `VERIFIED_DONE` 🟢 | [#8](https://github.com/PasitTum/tum-agentic-workos/issues/8) | 3 Passed |
| **WOS-TREASURY-01** | Autonomous Cash Flow Forecasting & Liquidity Stress Engine | `P2 - High` | Treasury ERP | `VERIFIED_DONE` 🟢 | [`develop`](https://github.com/PasitTum/tum-agentic-workos) | 4 Passed |
| **WOS-CONTAIN-01** | Agent Containment Listener for Cross-Fleet Security Freeze | `P1 - Critical` | SecOps / SOAR | `VERIFIED_DONE` 🟢 | [`develop`](https://github.com/PasitTum/tum-agentic-workos) | 2 Passed |
| **WOS-BKL-01B** | Agent Runtime eBPF Sandbox & Guardrail Interceptor | `P1 - Critical` | Innovation Backlog | `VERIFIED_DONE` 🟢 | [PR #5](https://github.com/PasitTum/tum-agentic-workos/pull/5) | 4 Passed |
| **WOS-BKL-05** | Multi-Worktree Semantic Merge Conflict Arbitrator | `P2 - High` | Innovation Backlog | `VERIFIED_DONE` 🟢 | [PR #5](https://github.com/PasitTum/tum-agentic-workos/pull/5) | 3 Passed |

---

## 2. Epic & Story Specifications

### 🎯 [WOS-EPIC-07] Autonomous Thai RD e-Tax Invoice & e-Receipt Engine
- **Category:** GovTech / Tax
- **Priority:** P1 - Critical
- **Delivered Capabilities:**
  - `BahtText`: Official Thai Baht Text conversion algorithm conforming to ETDA/Revenue Department standards.
  - `ETaxValidatorLogic`: Thai 13-digit Tax ID checksum (Modulo 11) + 5-digit branch code verification + 7% VAT & WHT math validation.
  - `ETaxXmlBuilderLogic`: Generates canonical ETDA `TaxInvoice_CrossIndustryInvoice` XML schema (`urn:etda:invoice:2017:Invoice`).
  - `QuantumSeal`: NIST FIPS 204 ML-DSA-65 post-quantum digital signature envelope embedded in the invoice.

### 🎯 [WOS-EPIC-08] Autonomous Vendor Risk & Due Diligence KYC Screening Engine
- **Category:** Risk / SecOps
- **Priority:** P1 - Critical
- **Delivered Capabilities:**
  - Real-time screening against global sanction watchlists (Fail-closed block).
  - Politically Exposed Person (PEP) board/UBO risk detection.
  - Financial rating scoring (Grades A-D) and adverse media investigation weighting.
  - Dynamic 0-100 score with automatic procurement restriction & spending caps.

### 🎯 [WOS-EPIC-09] Multi-Agent Swarm Byzantine Consensus for High-Value Transactions
- **Category:** Swarm Governance
- **Priority:** P1 - Critical
- **Delivered Capabilities:**
  - M-of-N Byzantine fault-tolerant quorum threshold voting.
  - Cryptographically signed agent ballots (DAC integration).
  - Absolute security veto power for Security Sentry agents on detected anomalies.
  - Timeout protection and automatic rollback for stalled rounds.

---

## 3. Sprint Roadmap Ahead (Upcoming Backlog)

| Issue Key | Title | Priority | Target Sprint | Category |
| :--- | :--- | :--- | :--- | :--- |
| **WOS-EPIC-10** | Autonomous Payroll & Thai Social Security Fund (SSO) e-Filing Engine | `P2 - High` | Sprint 3 | HR / Payroll |
| **WOS-EPIC-11** | Cross-Border Multi-Currency FX Hedging & Real-Time Treasury Swap | `P2 - High` | Sprint 3 | Treasury |
| **WOS-EPIC-12** | AI Agent Performance KPI & Dynamic Token Burn Attribution Ledger | `P2 - High` | Sprint 4 | Governance |
| **WOS-BKL-09** | Zero-Knowledge Balance Sheet Attestation for Regulators | `P1 - Critical` | Sprint 4 | Privacy / Audit |

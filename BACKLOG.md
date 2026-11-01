# 📋 Product Backlog — TUM Agentic WorkOS
**Epic Prefix:** `WOS`  
**Repository:** `tum-agentic-workos`  
**Last Updated:** 2026-11-01 17:10:00  
**Jira Master Epic:** [`SCRUM-28`](https://daywakler.atlassian.net/browse/SCRUM-28)  
**Active Sprint:** Sprint 3 (Autonomous Payroll, FX Hedging & Agent Token ROI Ledger) 🟢

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
| **WOS-EPIC-07** | Autonomous Thai RD e-Tax Invoice & e-Receipt Engine (ETDA Standard) | `P1 - Critical` | GovTech / Tax | `VERIFIED_DONE` 🟢 | [PR #10](https://github.com/PasitTum/tum-agentic-workos/pull/10) | 4 Passed |
| **WOS-EPIC-08** | Autonomous Vendor Risk & Due Diligence KYC Screening Engine | `P1 - Critical` | Risk / SecOps | `VERIFIED_DONE` 🟢 | [PR #10](https://github.com/PasitTum/tum-agentic-workos/pull/10) | 3 Passed |
| **WOS-EPIC-09** | Multi-Agent Swarm Byzantine Consensus for High-Value Transactions | `P1 - Critical` | Swarm Governance | `VERIFIED_DONE` 🟢 | [PR #10](https://github.com/PasitTum/tum-agentic-workos/pull/10) | 3 Passed |
| **WOS-EPIC-10** | Autonomous Payroll & Thai Revenue Dept P.N.D.1 / SSO Engine | `P1 - Critical` | HR / Tax ERP | `VERIFIED_DONE` 🟢 | [#11](https://github.com/PasitTum/tum-agentic-workos/issues/11) | 4 Passed |
| **WOS-EPIC-11** | Cross-Border Multi-Currency FX Hedging & Forward Treasury Engine | `P1 - Critical` | Treasury ERP | `VERIFIED_DONE` 🟢 | [#12](https://github.com/PasitTum/tum-agentic-workos/issues/12) | 3 Passed |
| **WOS-EPIC-12** | AI Agent Token ROI & Business Value Attribution Ledger | `P1 - Critical` | Governance | `VERIFIED_DONE` 🟢 | [#13](https://github.com/PasitTum/tum-agentic-workos/issues/13) | 3 Passed |
| **WOS-TREASURY-01** | Autonomous Cash Flow Forecasting & Liquidity Stress Engine | `P2 - High` | Treasury ERP | `VERIFIED_DONE` 🟢 | [`develop`](https://github.com/PasitTum/tum-agentic-workos) | 4 Passed |
| **WOS-CONTAIN-01** | Agent Containment Listener for Cross-Fleet Security Freeze | `P1 - Critical` | SecOps / SOAR | `VERIFIED_DONE` 🟢 | [`develop`](https://github.com/PasitTum/tum-agentic-workos) | 2 Passed |
| **WOS-BKL-01B** | Agent Runtime eBPF Sandbox & Guardrail Interceptor | `P1 - Critical` | Innovation Backlog | `VERIFIED_DONE` 🟢 | [PR #5](https://github.com/PasitTum/tum-agentic-workos/pull/5) | 4 Passed |
| **WOS-BKL-05** | Multi-Worktree Semantic Merge Conflict Arbitrator | `P2 - High` | Innovation Backlog | `VERIFIED_DONE` 🟢 | [PR #5](https://github.com/PasitTum/tum-agentic-workos/pull/5) | 3 Passed |

---

## 2. Sprint 3 Epic & Story Specifications

### 🎯 [WOS-EPIC-10] Autonomous Payroll & Thai Revenue Dept P.N.D.1 / SSO Engine
- **Category:** HR / Tax ERP
- **Priority:** P1 - Critical
- **Delivered Capabilities:**
  - `ThaiTaxLogic`: Personal Income Tax progressive brackets (0% to 35%), standard 50% max 100,000 THB expense deduction, and 60,000 THB personal allowance.
  - `SSO Contribution`: Statutory Social Security Fund (ม.33) 5% deduction capped at 750 THB/month (15,000 THB base).
  - `Pnd1BuilderLogic`: Official Revenue Department ภ.ง.ด.1 pipe-delimited text upload format (`H|...` and `D|...`).
  - `QuantumSeal`: NIST FIPS 204 ML-DSA-65 post-quantum signed monthly payslips with BahtText.

### 🎯 [WOS-EPIC-11] Cross-Border Multi-Currency FX Hedging & Forward Treasury Engine
- **Category:** Treasury ERP
- **Priority:** P1 - Critical
- **Delivered Capabilities:**
  - `Covered Interest Rate Parity`: Theoretical forward exchange rate pricing based on BOT policy rate and base foreign rates.
  - `FX Risk Evaluator`: Automatic exposure monitoring, threshold alerts (>= 1,000,000 THB or >= 3% volatility), and CRITICAL rating recommendations.
  - `Forward Contract Execution`: Sovereign forward hedging with counterparty commercial banks and Mark-to-Market (MTM) unrealized gain/loss valuation.

### 🎯 [WOS-EPIC-12] AI Agent Token ROI & Business Value Attribution Ledger
- **Category:** Swarm Governance
- **Priority:** P1 - Critical
- **Delivered Capabilities:**
  - `Token Usage Ledger`: Granular token pricing in THB across multiple foundation model tiers (Gemini 3.8 Flash, Claude 3.7 Sonnet, etc.).
  - `Business Value Attribution`: Direct quantifiable ROI attribution across Cost Saving, Revenue Generation, Risk Avoidance, and Time Saved.
  - `ROI Multiplier & Tiers`: Holistic agent scorecards categorizing efficiency (UNPROFITABLE, VIABLE, HIGH_PERFORMING, EXCEPTIONAL).

---

## 3. Sprint Roadmap Ahead (Upcoming Backlog)

| Issue Key | Title | Priority | Target Sprint | Category |
| :--- | :--- | :--- | :--- | :--- |
| **WOS-BKL-09** | Zero-Knowledge Balance Sheet Attestation for Regulators | `P1 - Critical` | Sprint 4 | Privacy / Audit |
| **WOS-EPIC-13** | Autonomous ESG Carbon Accounting & Green Supply Chain Auditing | `P2 - High` | Sprint 4 | ESG / Compliance |
| **WOS-EPIC-14** | Autonomous Corporate Tax Annual Filing (P.N.D.50) Engine | `P1 - Critical` | Sprint 4 | Tax ERP |

# 🏛️ TUM Agentic WorkOS
> **The Autonomous AI Enterprise Operating System & Process ERP**  
> **Classification:** TUM Group Holdings — Sovereign Flagship Commercial Product  
> **Engineering Lead:** Dr. Ake (Agent Systems & Distributed Compute)  
> **Status:** Production-Ready Turnkey Package Verified 🟢

---

## 1. Executive Summary & Capabilities
TUM Agentic WorkOS is an autonomous enterprise process operating system designed for corporate accounting, automated procurement, treasury operations, and Thai statutory tax compliance.

### Core Production Capabilities
1. **Thai Revenue Department e-Tax Invoice Engine (ETDA ER3-2560 v2.1):**
   - Full XML generation for Tax Invoices (T03) and e-Receipts (T01).
   - Thai 13-digit Tax ID validation via Modulo 11 checksum.
   - Thai Baht Text conversion algorithm.
   - XMLDSIG digital signature support (Enveloped SHA-256 with RSA-2048).
   - Pre-flight compliance validator against RD OpenAPI sandbox specifications.

2. **Human-in-the-Loop (HITL) Financial Approval Matrix:**
   - Autonomous agent threshold enforcement: Transactions `<= 50,000 THB` execute automatically via DAC token credentials.
   - High-value disbursements `> 50,000 THB` are placed in a mandatory `PENDING_HUMAN_APPROVAL` queue requiring CFO / Authorized Director dual cryptographic authorization.

3. **Autonomous P2P 3-Way Match Procurement:**
   - Automated PO, Goods Receipt, and Tax Invoice matching with quantity and line-item price variance tolerance checks (0.5%).

4. **Multi-Agent Byzantine Consensus Ledger:**
   - Quorum-based voting across Security Sentry, Financial Controller, and Compliance Auditor agents before ledger commitment.

---

## 2. Turnkey Commercial Packaging (`D:\TUM\setup-product\tum-agentic-workos`)
The production deliverable is packaged for instant enterprise air-gapped deployment:
- **`web-erp-console/`**: Pure Vanilla/HTML5 ERP Console with zero telemetry leakage, real-time HITL queue, and Thai e-Tax viewer.
- **`etax-engine/`**: Standalone TypeScript/Node.js validation CLI and schema verification suite.
- **`etax-v2.1-sandbox/`**: ETDA v2.1 schema bundle with canonical XML samples (`canonical-tax-invoice-T03.xml`).
- **`docker-compose.yml` & `Dockerfile`**: Production containerization stack with health checks.
- **`smoke-test.ps1`**: Standalone PowerShell smoke test script verifying CLI, schemas, and API health.

---

## 3. Quick Start & Verification

### Running the Standalone Smoke Test
```powershell
powershell -ExecutionPolicy Bypass -File D:\TUM\setup-product\tum-agentic-workos\smoke-test.ps1
```

### Starting the WorkOS API & ERP Console
```powershell
# Run API server
npm run start

# Access the ERP Operator Console
# Navigate to: http://127.0.0.1:4000/hud
```

### Validating an e-Tax Invoice XML
```powershell
npx tsx scripts/validate-etax-schema.ts samples/canonical-tax-invoice-T03.xml
```

---

## 4. Test & Verification Matrix
- **Unit & Integration Tests**: 77 / 77 passing (100% pass rate).
- **Schema Conformance**: 100% valid ETDA ER3-2560 v2.1 schema validation.
- **Audit Verification**: Passed in master commercial fleet suite (`test-master-audit.ps1`).

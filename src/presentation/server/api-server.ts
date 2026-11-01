import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { WorkforceDirectoryService } from '../../application/services/workforce-directory.service.js';
import { ProcurementEngineService } from '../../application/services/procurement-engine.service.js';
import { DacMintingService } from '../../application/services/dac-minting.service.js';
import { EbpfGuardrailService } from '../../application/services/ebpf-guardrail.service.js';
import { SapSalesforceAdapterService } from '../../application/services/sap-salesforce-adapter.service.js';
import { MergeArbitratorService } from '../../application/services/merge-arbitrator.service.js';
import { WorkflowOrchestratorService } from '../../application/services/workflow-orchestrator.service.js';
import { GeneralLedgerSyncService } from '../../application/services/general-ledger-sync.service.js';
import { ETaxService } from '../../application/services/etax.service.js';
import { VendorRiskService } from '../../application/services/vendor-risk.service.js';
import { ByzantineConsensusService } from '../../application/services/byzantine-consensus.service.js';
import { PayrollService } from '../../application/services/payroll.service.js';
import { FxHedgingService } from '../../application/services/fx-hedging.service.js';
import { AgentRoiService } from '../../application/services/agent-roi.service.js';
import { SovereignTelemetryBus } from '../../infrastructure/telemetry/sovereign-telemetry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class ApiServer {
  private workforceService = new WorkforceDirectoryService();
  private procurementService = new ProcurementEngineService();
  private dacService = new DacMintingService();
  private guardrailService = new EbpfGuardrailService();
  private legacyService = new SapSalesforceAdapterService();
  private mergeService = new MergeArbitratorService();
  private workflowService = new WorkflowOrchestratorService();
  private accountingService = new GeneralLedgerSyncService();
  private eTaxService = new ETaxService();
  private vendorRiskService = new VendorRiskService();
  private consensusService = new ByzantineConsensusService();
  private payrollService = new PayrollService();
  private fxService = new FxHedgingService();
  private roiService = new AgentRoiService();

  private server = createServer(async (req, res) => {
    try {
      await this.handleRequest(req, res);
    } catch (err: unknown) {
      this.sendJson(res, 500, {
        error: 'INTERNAL_SERVER_ERROR',
        message: err instanceof Error ? err.message : String(err)
      });
    }
  });

  private async parseJsonBody(req: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        if (!body) return resolve({});
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error('Invalid JSON payload'));
        }
      });
      req.on('error', reject);
    });
  }

  private sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(JSON.stringify(data, null, 2));
  }

  private sendHtml(res: ServerResponse, html: string): void {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(html);
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const method = req.method?.toUpperCase() || 'GET';
    const path = url.pathname;

    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
      res.end();
      return;
    }

    // Health Probe
    if (path === '/health' || path === '/api/v1/health') {
      return this.sendJson(res, 200, {
        status: 'UP',
        service: 'tum-agentic-workos',
        version: '1.0.0',
        classification: 'Sovereign Flagship Platform',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        memoryUsage: process.memoryUsage()
      });
    }

    // Serve Executive Web HUD
    if (path === '/' || path === '/hud') {
      const hudPath = join(__dirname, '../hud/index.html');
      if (existsSync(hudPath)) {
        return this.sendHtml(res, readFileSync(hudPath, 'utf-8'));
      }
      return this.sendJson(res, 200, { message: 'TUM Agentic WorkOS API Online' });
    }

    // Workforce APIs
    if (path === '/api/v1/workforce/agents' && method === 'GET') {
      return this.sendJson(res, 200, { agents: this.workforceService.listAgents() });
    }

    if (path === '/api/v1/workforce/agents' && method === 'POST') {
      const body = await this.parseJsonBody(req);
      const agent = this.workforceService.registerAgent(body);
      return this.sendJson(res, 201, { agent });
    }

    if (path === '/api/v1/workforce/employees' && method === 'GET') {
      return this.sendJson(res, 200, { employees: this.workforceService.listEmployees() });
    }

    if (path === '/api/v1/workforce/org-chart' && method === 'GET') {
      return this.sendJson(res, 200, {
        tree: this.workforceService.getOrgChartTree(),
        validation: this.workforceService.validateOrgHierarchy()
      });
    }

    if (path === '/api/v1/workforce/delegation' && method === 'POST') {
      const body = await this.parseJsonBody(req);
      const delegation = this.workforceService.createDelegation(body);
      return this.sendJson(res, 201, { delegation });
    }

    // Procurement APIs
    if (path === '/api/v1/procurement/orders' && method === 'GET') {
      return this.sendJson(res, 200, { orders: this.procurementService.listPurchaseOrders() });
    }

    if (path === '/api/v1/procurement/requisitions' && method === 'POST') {
      const body = await this.parseJsonBody(req);
      const pr = this.procurementService.createPurchaseRequisition(body);
      return this.sendJson(res, 201, { requisition: pr });
    }

    if (path === '/api/v1/procurement/orders' && method === 'POST') {
      const body = await this.parseJsonBody(req);
      const po = this.procurementService.generatePurchaseOrder(body);
      return this.sendJson(res, 201, { order: po });
    }

    if (path === '/api/v1/procurement/goods-receipts' && method === 'POST') {
      const body = await this.parseJsonBody(req);
      const grn = this.procurementService.submitGoodsReceipt(body);
      return this.sendJson(res, 201, { goodsReceipt: grn });
    }

    if (path === '/api/v1/procurement/invoices' && method === 'POST') {
      const body = await this.parseJsonBody(req);
      const inv = this.procurementService.submitVendorInvoice(body);
      return this.sendJson(res, 201, { invoice: inv });
    }

    if (path === '/api/v1/procurement/three-way-match' && method === 'POST') {
      const body = (await this.parseJsonBody(req)) as { invoiceNumber: string };
      const result = this.procurementService.executeThreeWayMatch(body.invoiceNumber);
      return this.sendJson(res, 200, { result });
    }

    // Payroll & PND1 API (WOS-EPIC-10)
    if (path === '/api/v1/payroll/profile' && method === 'POST') {
      const body = await this.parseJsonBody(req) as any;
      this.payrollService.registerPayrollProfile(body);
      return this.sendJson(res, 201, { message: 'Profile registered' });
    }

    if (path === '/api/v1/payroll/payslip' && method === 'POST') {
      const body = await this.parseJsonBody(req) as any;
      const payslip = this.payrollService.generateMonthlyPayslip(body.employeeId, body.year, body.month);
      return this.sendJson(res, 201, { payslip });
    }

    if (path === '/api/v1/payroll/pnd1' && method === 'POST') {
      const body = await this.parseJsonBody(req) as any;
      const filing = this.payrollService.generatePnd1MonthlyFiling(body.year, body.month, body.employerTaxId, body.branch);
      return this.sendJson(res, 201, { filing });
    }

    // FX Hedging API (WOS-EPIC-11)
    if (path === '/api/v1/fx/exposure' && method === 'POST') {
      const body = await this.parseJsonBody(req) as any;
      const exposure = this.fxService.recordForeignExposure(body.poNumber, body.vendorId, body.currency, body.amount, body.dueDate);
      return this.sendJson(res, 201, { exposure });
    }

    if (path === '/api/v1/fx/hedge' && method === 'POST') {
      const body = await this.parseJsonBody(req) as any;
      const contract = this.fxService.executeForwardHedge(body.exposureId, body.counterpartyBank, body.daysToMaturity);
      return this.sendJson(res, 201, { contract });
    }

    // Agent ROI & Token Ledger API (WOS-EPIC-12)
    if (path === '/api/v1/agent-roi/token' && method === 'POST') {
      const body = await this.parseJsonBody(req) as any;
      const event = this.roiService.logTokenUsage(body.agentId, body.taskId, body.modelEngine, body.inputTokens, body.outputTokens);
      return this.sendJson(res, 201, { event });
    }

    if (path === '/api/v1/agent-roi/value' && method === 'POST') {
      const body = await this.parseJsonBody(req) as any;
      const event = this.roiService.logBusinessValue(body.agentId, body.taskId, body.category, body.valueTHB, body.evidenceRef);
      return this.sendJson(res, 201, { event });
    }

    if (path.startsWith('/api/v1/agent-roi/scorecard/') && method === 'GET') {
      const agentId = decodeURIComponent(path.replace('/api/v1/agent-roi/scorecard/', ''));
      const scorecard = this.roiService.getAgentRoiScorecard(agentId);
      return this.sendJson(res, 200, { scorecard });
    }

    // Quantum Credential (DAC) APIs
    if (path === '/api/v1/credentials/mint' && method === 'POST') {
      const body = await this.parseJsonBody(req);
      const dac = this.dacService.mintCredential(body);
      return this.sendJson(res, 201, { credential: dac });
    }

    if (path.startsWith('/api/v1/credentials/verify/') && method === 'GET') {
      const credId = decodeURIComponent(path.replace('/api/v1/credentials/verify/', ''));
      const verification = this.dacService.verifyCredential(credId);
      return this.sendJson(res, 200, { verification });
    }

    // eBPF Guardrail Interceptor API
    if (path === '/api/v1/guardrail/intercept' && method === 'POST') {
      const body = await this.parseJsonBody(req);
      const decision = this.guardrailService.interceptSyscall(body);
      return this.sendJson(res, 200, { decision });
    }

    if (path === '/api/v1/guardrail/logs' && method === 'GET') {
      return this.sendJson(res, 200, { logs: this.guardrailService.getAuditLogs() });
    }

    // Legacy Bridge API
    if (path === '/api/v1/legacy/sync' && method === 'POST') {
      const body = await this.parseJsonBody(req);
      const record = this.legacyService.syncInboundPayload(body);
      return this.sendJson(res, 201, { record });
    }

    // Merge Arbitrator API
    if (path === '/api/v1/arbitrator/resolve' && method === 'POST') {
      const body = await this.parseJsonBody(req);
      const decision = this.mergeService.arbitrateConflict(body);
      return this.sendJson(res, 200, { decision });
    }

    // Telemetry Events
    if (path === '/api/v1/telemetry/events' && method === 'GET') {
      return this.sendJson(res, 200, { events: SovereignTelemetryBus.getRecentEvents() });
    }

    // Workflow Orchestrator API
    if (path === '/api/v1/workflow/execute' && method === 'POST') {
      const body = await this.parseJsonBody(req);
      const receipt = await this.workflowService.executeWorkflow(body as any);
      return this.sendJson(res, 200, { receipt });
    }

    // General Ledger & Accounting API
    if (path === '/api/v1/accounting/post' && method === 'POST') {
      const body = await this.parseJsonBody(req);
      const voucher = this.accountingService.postProcurementVoucher(body as any);
      return this.sendJson(res, 201, { voucher });
    }

    if (path === '/api/v1/accounting/vouchers' && method === 'GET') {
      return this.sendJson(res, 200, { vouchers: this.accountingService.getAllVouchers() });
    }

    // e-Tax Invoice & e-Receipt API (WOS-EPIC-07)
    if (path === '/api/v1/etax/invoices' && method === 'POST') {
      const body = await this.parseJsonBody(req);
      const invoice = this.eTaxService.generateAndSealInvoice(body as any);
      return this.sendJson(res, 201, { invoice });
    }

    if (path.startsWith('/api/v1/etax/invoices/') && method === 'GET') {
      const invNum = decodeURIComponent(path.replace('/api/v1/etax/invoices/', ''));
      const invoice = this.eTaxService.getInvoice(invNum);
      if (!invoice) {
        return this.sendJson(res, 404, { error: 'NOT_FOUND', message: `e-Tax Invoice '${invNum}' not found.` });
      }
      return this.sendJson(res, 200, { invoice });
    }

    // Vendor Risk & KYC API (WOS-EPIC-08)
    if (path === '/api/v1/vendor-risk/evaluate' && method === 'POST') {
      const body = await this.parseJsonBody(req);
      const evaluation = this.vendorRiskService.registerAndEvaluateVendor(body as any);
      return this.sendJson(res, 200, { evaluation });
    }

    // Byzantine Swarm Consensus API (WOS-EPIC-09)
    if (path === '/api/v1/consensus/proposals' && method === 'POST') {
      const body = await this.parseJsonBody(req);
      const proposal = this.consensusService.createProposal(body as any);
      return this.sendJson(res, 201, { proposal });
    }

    if (path === '/api/v1/consensus/ballots' && method === 'POST') {
      const body = await this.parseJsonBody(req) as any;
      const result = this.consensusService.castBallot(
        body.proposalId,
        body.agentId,
        body.agentRole,
        body.decision,
        body.justification,
        body.signature
      );
      return this.sendJson(res, 200, { result });
    }

    // Payroll & PND1 API (WOS-EPIC-10)
    if (path === '/api/v1/payroll/profile' && method === 'POST') {
      const body = await this.parseJsonBody(req) as any;
      this.payrollService.registerPayrollProfile(body);
      return this.sendJson(res, 201, { message: 'Profile registered' });
    }

    if (path === '/api/v1/payroll/payslip' && method === 'POST') {
      const body = await this.parseJsonBody(req) as any;
      const payslip = this.payrollService.generateMonthlyPayslip(body.employeeId, body.year, body.month);
      return this.sendJson(res, 201, { payslip });
    }

    if (path === '/api/v1/payroll/pnd1' && method === 'POST') {
      const body = await this.parseJsonBody(req) as any;
      const filing = this.payrollService.generatePnd1MonthlyFiling(body.year, body.month, body.employerTaxId, body.branch);
      return this.sendJson(res, 201, { filing });
    }

    // FX Hedging API (WOS-EPIC-11)
    if (path === '/api/v1/fx/exposure' && method === 'POST') {
      const body = await this.parseJsonBody(req) as any;
      const exposure = this.fxService.recordForeignExposure(body.poNumber, body.vendorId, body.currency, body.amount, body.dueDate);
      return this.sendJson(res, 201, { exposure });
    }

    if (path === '/api/v1/fx/hedge' && method === 'POST') {
      const body = await this.parseJsonBody(req) as any;
      const contract = this.fxService.executeForwardHedge(body.exposureId, body.counterpartyBank, body.daysToMaturity);
      return this.sendJson(res, 201, { contract });
    }

    // Agent ROI & Token Ledger API (WOS-EPIC-12)
    if (path === '/api/v1/agent-roi/token' && method === 'POST') {
      const body = await this.parseJsonBody(req) as any;
      const event = this.roiService.logTokenUsage(body.agentId, body.taskId, body.modelEngine, body.inputTokens, body.outputTokens);
      return this.sendJson(res, 201, { event });
    }

    if (path === '/api/v1/agent-roi/value' && method === 'POST') {
      const body = await this.parseJsonBody(req) as any;
      const event = this.roiService.logBusinessValue(body.agentId, body.taskId, body.category, body.valueTHB, body.evidenceRef);
      return this.sendJson(res, 201, { event });
    }

    if (path.startsWith('/api/v1/agent-roi/scorecard/') && method === 'GET') {
      const agentId = decodeURIComponent(path.replace('/api/v1/agent-roi/scorecard/', ''));
      const scorecard = this.roiService.getAgentRoiScorecard(agentId);
      return this.sendJson(res, 200, { scorecard });
    }

    // 404 Route Not Found
    return this.sendJson(res, 404, {
      error: 'NOT_FOUND',
      path,
      message: `Endpoint ${method} ${path} does not exist on TUM Agentic WorkOS API.`
    });
  }

  public listen(port = 8080): Promise<number> {
    return new Promise(resolve => {
      this.server.listen(port, () => {
        resolve(port);
      });
    });
  }

  public close(): Promise<void> {
    return new Promise(resolve => {
      this.server.close(() => resolve());
    });
  }
}

// Direct execution mode
if (process.argv[1] && (process.argv[1].endsWith('api-server.ts') || process.argv[1].endsWith('api-server.js'))) {
  const port = Number(process.env.PORT) || 8080;
  const server = new ApiServer();
  server.listen(port).then(p => {
    console.log(`[TUM-Agentic-WorkOS] Sovereign API Server listening on port ${p}`);
    console.log(`[TUM-Agentic-WorkOS] Executive Web HUD: http://localhost:${p}/hud`);
  });
}

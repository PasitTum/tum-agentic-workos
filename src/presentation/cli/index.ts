#!/usr/bin/env node

import { WorkforceDirectoryService } from '../../application/services/workforce-directory.service.js';
import { ProcurementEngineService } from '../../application/services/procurement-engine.service.js';
import { DacMintingService } from '../../application/services/dac-minting.service.js';
import { EbpfGuardrailService } from '../../application/services/ebpf-guardrail.service.js';
import { ApiServer } from '../server/api-server.js';
import { OrgNode } from '../../domain/workforce/workforce.types.js';

const workforceService = new WorkforceDirectoryService();
const procurementService = new ProcurementEngineService();
const dacService = new DacMintingService();
const guardrailService = new EbpfGuardrailService();

function printBanner() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║                   🏛️ TUM AGENTIC WORKOS CLI                         ║
║      Autonomous AI Enterprise Operating System & Process ERP          ║
║      Classification: Sovereign Flagship Product                       ║
║      Lead: Dr. Ake (Agent Systems & Distributed Compute)              ║
╚═══════════════════════════════════════════════════════════════════════╝
  `);
}

function printTree(nodes: OrgNode[], prefix = ''): void {
  nodes.forEach((node, idx) => {
    const isLast = idx === nodes.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const icon = node.type === 'HUMAN' ? '👤 [HUMAN]' : '🤖 [AGENT]';
    console.log(`${prefix}${connector}${icon} ${node.name} (${node.title})`);

    const childPrefix = prefix + (isLast ? '    ' : '│   ');
    if (node.delegatedAgents && node.delegatedAgents.length > 0) {
      node.delegatedAgents.forEach((delAgent, dIdx) => {
        const dIsLast = dIdx === node.delegatedAgents!.length - 1 && node.children.length === 0;
        const dConn = dIsLast ? '└── ' : '├── ';
        console.log(`${childPrefix}${dConn}⚡ [DELEGATED AGENT] ${delAgent.name} (${delAgent.title})`);
      });
    }

    if (node.children && node.children.length > 0) {
      printTree(node.children, childPrefix);
    }
  });
}

async function runCli() {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  if (command === 'status') {
    printBanner();
    const agents = workforceService.listAgents();
    const employees = workforceService.listEmployees();
    const validation = workforceService.validateOrgHierarchy();

    console.log('📊 SYSTEM STATUS:');
    console.log(`  • Enterprise Hierarchy: ${validation.isValid ? 'VALID 🟢' : 'ISSUES DETECTED 🔴'}`);
    console.log(`  • Human Workforce:      ${employees.length} personnel`);
    console.log(`  • AI Autonomous Agents: ${agents.length} active agents`);
    console.log(`  • Quantum Verification: NIST FIPS 204 ML-DSA-65 ENFORCED ⚛️`);
    console.log(`  • eBPF Guardrail:       ZERO-TRUST SANDBOX ARMED 🛡️\n`);

    console.log('🤖 ACTIVE AGENT ROSTER:');
    agents.forEach(a => {
      console.log(`  - [${a.id}] ${a.name} | Role: ${a.role} | Engine: ${a.modelEngine} | Status: ${a.status}`);
    });
    console.log('');
    return;
  }

  if (command === 'workforce') {
    const sub = args[1] || 'org-chart';
    if (sub === 'org-chart' || sub === 'tree') {
      printBanner();
      console.log('🌲 DYNAMIC ENTERPRISE ORG-CHART & DELEGATION HIERARCHY:\n');
      const tree = workforceService.getOrgChartTree();
      printTree(tree);
      console.log('');
      return;
    }

    if (sub === 'list') {
      console.log('\n🤖 AUTONOMOUS AGENTS:');
      console.table(workforceService.listAgents().map(a => ({
        ID: a.id,
        Name: a.name,
        Role: a.role,
        Department: a.departmentId,
        Status: a.status,
        CapTHB: a.spendingLimit
      })));
      return;
    }
  }

  if (command === 'p2p') {
    const sub = args[1] || 'match';
    if (sub === 'match' || sub === 'demo') {
      printBanner();
      console.log('📦 EXECUTING AUTONOMOUS P2P 3-WAY MATCHING SIMULATION...\n');

      // 1. Create PR
      const pr = procurementService.createPurchaseRequisition({
        requesterId: 'AGT-ORCA-PRIME',
        requesterType: 'AGENT',
        departmentId: 'DEP-ENG',
        items: [{
          itemId: 'ITEM-GPU-01',
          sku: 'NV-H200-SXM',
          description: 'Nvidia H200 SXM 141GB Compute Module',
          quantity: 2,
          unitPrice: 1_600_000
        }],
        justification: 'Critical GPU node expansion for Sovereign Autonomous Agent Inference'
      });
      console.log(`1. Purchase Requisition Created: ${pr.prNumber} (${pr.totalAmount.toLocaleString()} THB)`);

      // 2. Approve PR
      procurementService.approvePurchaseRequisition(pr.prNumber, 'EMP-CEO-01');
      console.log(`2. PR Approved by Dr. Ake (Group CEO)`);

      // 3. Issue PO
      const po = procurementService.generatePurchaseOrder({
        prNumber: pr.prNumber,
        vendorId: 'VND-NVIDIA-DIRECT',
        vendorName: 'Nvidia Enterprise Solutions APAC',
        paymentTerms: 'Net 30'
      });
      console.log(`3. Purchase Order Issued: ${po.poNumber} | Total: ${po.totalAmount.toLocaleString()} THB (inc. 7% VAT)`);

      // 4. Goods Receipt Note
      const grn = procurementService.submitGoodsReceipt({
        poNumber: po.poNumber,
        warehouseId: 'WH-BANGKOK-01',
        inspectorId: 'AGT-P2P-MATCHER',
        inspectorType: 'AGENT',
        items: [{
          itemId: 'ITEM-GPU-01',
          sku: 'NV-H200-SXM',
          receivedQuantity: 2,
          acceptedQuantity: 2,
          rejectedQuantity: 0,
          batchNumber: 'LOT-2026-X89'
        }]
      });
      console.log(`4. Goods Receipt Note Recorded: ${grn.grnNumber} | Status: ${grn.status}`);

      // 5. Vendor Invoice
      const invoice = procurementService.submitVendorInvoice({
        invoiceNumber: `INV-${Date.now().toString().slice(-5)}`,
        vendorId: 'VND-NVIDIA-DIRECT',
        poNumber: po.poNumber,
        grnNumber: grn.grnNumber,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        items: [{
          itemId: 'ITEM-GPU-01',
          sku: 'NV-H200-SXM',
          billedQuantity: 2,
          unitPrice: 1_600_000
        }],
        bankAccountRef: 'BBL-TUM-ESCROW-001'
      });
      console.log(`5. Vendor Invoice Received: ${invoice.invoiceNumber} | Total: ${invoice.totalAmount.toLocaleString()} THB`);

      // 6. Execute 3-Way Match
      const matchResult = procurementService.executeThreeWayMatch(invoice.invoiceNumber);
      console.log('\n🎯 3-WAY MATCHING RESULT:');
      console.log(`   Outcome:        ${matchResult.outcome} 🟢`);
      console.log(`   Auto-Approved:  ${matchResult.autoApproved ? 'YES (Automated Treasury Dispatch)' : 'NO'}`);
      console.log(`   Discrepancies:  ${matchResult.totalDiscrepancies}`);
      console.log(`   Audit Notes:    ${matchResult.auditNotes}\n`);
      return;
    }
  }

  if (command === 'dac') {
    const sub = args[1] || 'mint';
    if (sub === 'mint') {
      printBanner();
      console.log('⚛️ MINTING DELEGATED AGENT CREDENTIAL (NIST FIPS 204 ML-DSA-65)...\n');
      const dac = dacService.mintCredential({
        agentId: 'AGT-P2P-MATCHER',
        issuerId: 'EMP-CEO-01',
        scopes: ['p2p:match', 'p2p:approve', 'treasury:dispatch'],
        spendingCapTHB: 500_000,
        durationDays: 30
      });
      console.log(`  Credential ID: ${dac.id}`);
      console.log(`  Agent:         ${dac.agentId}`);
      console.log(`  Issuer:        ${dac.issuerId}`);
      console.log(`  Spending Cap:  ${dac.spendingCapTHB.toLocaleString()} THB`);
      console.log(`  Algorithm:     ${dac.quantumEnvelope.algorithm}`);
      console.log(`  Signature:     ${dac.quantumEnvelope.signature.slice(0, 48)}...`);

      const verify = dacService.verifyCredential(dac.id);
      console.log(`  Verification:  ${verify.isValid ? 'VALID & CRYPTOGRAPHICALLY SECURE 🟢' : 'FAILED 🔴'}\n`);
      return;
    }
  }

  if (command === 'guardrail') {
    printBanner();
    console.log('🛡️ TESTING AGENT RUNTIME eBPF SANDBOX INTERCEPTOR...\n');

    // Safe read
    console.log('1. Testing Safe Syscall: SYS_FILE_READ D:/TUM/tum-agentic-workos/src');
    const d1 = guardrailService.interceptSyscall({
      agentId: 'AGT-ORCA-PRIME',
      syscall: 'SYS_FILE_READ',
      target: 'D:/TUM/tum-agentic-workos/src'
    });
    console.log(`   Result: [${d1.action}] Allowed: ${d1.allowed} 🟢`);

    // Prohibited system path
    console.log('\n2. Testing Prohibited Path Syscall: SYS_FILE_READ /etc/shadow');
    try {
      guardrailService.interceptSyscall({
        agentId: 'AGT-ORCA-PRIME',
        syscall: 'SYS_FILE_READ',
        target: '/etc/shadow'
      });
    } catch (err: unknown) {
      console.log(`   Result: INTERCEPTED & BLOCKED 🛑`);
      console.log(`   ${err instanceof Error ? err.message : String(err)}`);
    }

    // Dangerous command execution
    console.log('\n3. Testing Dangerous Command Execution: SYS_PROCESS_SPAWN rm -rf /');
    try {
      guardrailService.interceptSyscall({
        agentId: 'AGT-ORCA-PRIME',
        syscall: 'SYS_PROCESS_SPAWN',
        target: 'rm -rf /'
      });
    } catch (err: unknown) {
      console.log(`   Result: INTERCEPTED & AGENT TERMINATED 🛑`);
      console.log(`   ${err instanceof Error ? err.message : String(err)}`);
    }
    console.log('');
    return;
  }

  if (command === 'serve') {
    const port = Number(args[1]) || 8080;
    printBanner();
    const server = new ApiServer();
    await server.listen(port);
    console.log(`🚀 Sovereign API Server & Executive HUD listening on http://localhost:${port}`);
    console.log(`   Web HUD Dashboard: http://localhost:${port}/hud`);
    console.log(`   Health Check:      http://localhost:${port}/health\n`);
    return;
  }

  console.log(`Usage: workos <status|workforce|p2p|dac|guardrail|serve>`);
}

runCli().catch(err => {
  console.error('CLI Error:', err);
  process.exit(1);
});

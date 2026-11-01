import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { ApiServer } from '../../src/presentation/server/api-server.js';

describe('ApiServer & E2E WorkOS Workflows', () => {
  const server = new ApiServer();
  let baseUrl: string;
  const testPort = 18888;

  before(async () => {
    await server.listen(testPort);
    baseUrl = `http://localhost:${testPort}`;
  });

  after(async () => {
    await server.close();
  });

  test('GET /health returns 200 with sovereign system telemetry', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json() as Record<string, unknown>;
    assert.strictEqual(data.status, 'UP');
    assert.strictEqual(data.service, 'tum-agentic-workos');
    assert.strictEqual(data.classification, 'Sovereign Flagship Platform');
  });

  test('GET /api/v1/workforce/agents returns initial seeded agents', async () => {
    const res = await fetch(`${baseUrl}/api/v1/workforce/agents`);
    assert.strictEqual(res.status, 200);
    const data = await res.json() as { agents: Array<{ id: string }> };
    assert.strictEqual(data.agents.length >= 4, true);
    assert.strictEqual(data.agents.some(a => a.id === 'AGT-ORCA-PRIME'), true);
  });

  test('Executes full E2E P2P 3-Way Match via API endpoints', async () => {
    // 1. Submit PR
    const prRes = await fetch(`${baseUrl}/api/v1/procurement/requisitions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requesterId: 'AGT-ORCA-PRIME',
        requesterType: 'AGENT',
        departmentId: 'DEP-ENG',
        items: [{
          itemId: 'GPU-01',
          sku: 'NV-H200',
          description: 'Nvidia H200',
          quantity: 1,
          unitPrice: 1_500_000
        }],
        justification: 'High-density inference node'
      })
    });
    assert.strictEqual(prRes.status, 201);
    const prData = await prRes.json() as { requisition: { prNumber: string; totalAmount: number } };
    assert.strictEqual(prData.requisition.totalAmount, 1_500_000);

    // Approve PR in server database
    const prNumber = prData.requisition.prNumber;
    // Auto-approve by CEO Dr. Ake
    const { InMemoryDatabase } = await import('../../src/infrastructure/persistence/in-memory-db.js');
    const dbPr = InMemoryDatabase.getInstance().purchaseRequisitions.get(prNumber);
    if (dbPr) {
      dbPr.status = 'APPROVED';
      dbPr.approverId = 'EMP-CEO-01';
    }

    // 2. Issue PO
    const poRes = await fetch(`${baseUrl}/api/v1/procurement/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prNumber,
        vendorId: 'VND-NV',
        vendorName: 'Nvidia Direct APAC',
        taxRate: 0.07
      })
    });
    assert.strictEqual(poRes.status, 201);
    const poData = await poRes.json() as { order: { poNumber: string; totalAmount: number } };
    assert.strictEqual(poData.order.totalAmount, 1_605_000); // 1.5M + 7% VAT

    // 3. Submit Goods Receipt
    const grnRes = await fetch(`${baseUrl}/api/v1/procurement/goods-receipts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        poNumber: poData.order.poNumber,
        warehouseId: 'WH-01',
        inspectorId: 'AGT-P2P-MATCHER',
        inspectorType: 'AGENT',
        items: [{
          itemId: 'GPU-01',
          sku: 'NV-H200',
          receivedQuantity: 1,
          acceptedQuantity: 1,
          rejectedQuantity: 0
        }]
      })
    });
    assert.strictEqual(grnRes.status, 201);
    const grnData = await grnRes.json() as { goodsReceipt: { grnNumber: string } };

    // 4. Submit Vendor Invoice
    const invoiceNumber = `INV-${Date.now()}`;
    const invRes = await fetch(`${baseUrl}/api/v1/procurement/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceNumber,
        vendorId: 'VND-NV',
        poNumber: poData.order.poNumber,
        grnNumber: grnData.goodsReceipt.grnNumber,
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        items: [{
          itemId: 'GPU-01',
          sku: 'NV-H200',
          billedQuantity: 1,
          unitPrice: 1_500_000
        }],
        taxRate: 0.07,
        bankAccountRef: 'BBL-TUM-001'
      })
    });
    assert.strictEqual(invRes.status, 201);

    // 5. Execute 3-Way Match
    const matchRes = await fetch(`${baseUrl}/api/v1/procurement/three-way-match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceNumber })
    });
    assert.strictEqual(matchRes.status, 200);
    const matchData = await matchRes.json() as { result: { outcome: string; isValid: boolean } };
    assert.strictEqual(matchData.result.outcome, 'MATCH_PERFECT');
    assert.strictEqual(matchData.result.isValid, true);
  });

  test('Mints and verifies Quantum DAC via API', async () => {
    const mintRes = await fetch(`${baseUrl}/api/v1/credentials/mint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: 'AGT-ORCA-PRIME',
        issuerId: 'EMP-CEO-01',
        scopes: ['all:orchestrate'],
        spendingCapTHB: 5_000_000,
        durationDays: 14
      })
    });
    assert.strictEqual(mintRes.status, 201);
    const mintData = await mintRes.json() as { credential: { id: string } };
    assert.strictEqual(mintData.credential.id.startsWith('urn:tum:dac:'), true);

    // Verify credential
    const verifyRes = await fetch(`${baseUrl}/api/v1/credentials/verify/${encodeURIComponent(mintData.credential.id)}`);
    assert.strictEqual(verifyRes.status, 200);
    const verifyData = await verifyRes.json() as { verification: { isValid: boolean } };
    assert.strictEqual(verifyData.verification.isValid, true);
  });
});

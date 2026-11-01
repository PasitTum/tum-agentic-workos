import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { ApiServer } from '../../src/presentation/server/api-server.js';

describe('ApiServer Sprint 2 Endpoints (e-Tax, Vendor Risk, Byzantine Swarm)', () => {
  const server = new ApiServer();
  let baseUrl: string;
  const testPort = 19999;

  before(async () => {
    await server.listen(testPort);
    baseUrl = `http://localhost:${testPort}`;
  });

  after(async () => {
    await server.close();
  });

  test('POST /api/v1/etax/invoices seals e-Tax Invoice and returns canonical ETDA XML', async () => {
    // Generate valid 13-digit tax IDs
    const calculateValidId = (base12: string) => {
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        sum += parseInt(base12[i]!, 10) * (13 - i);
      }
      return base12 + ((11 - (sum % 11)) % 10).toString();
    };

    const sellerTaxId = calculateValidId('010555800001');
    const buyerTaxId = calculateValidId('010753600002');

    const res = await fetch(`${baseUrl}/api/v1/etax/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceNumber: 'INV-API-TEST-001',
        seller: {
          name: 'TUM Enterprise Solutions Co., Ltd.',
          taxId: sellerTaxId,
          branchCode: '00000',
          address: '1 Sovereign Tower',
          province: 'Bangkok',
          postalCode: '10120',
          countryCode: 'TH'
        },
        buyer: {
          name: 'Bangkok Cloud Infras PLC',
          taxId: buyerTaxId,
          branchCode: '00000',
          address: '99 Silom Road',
          province: 'Bangkok',
          postalCode: '10500',
          countryCode: 'TH'
        },
        items: [
          {
            itemNumber: 1,
            sku: 'QUANTUM-NODE',
            description: 'PQC Quantum Accelerator Module',
            quantity: 1,
            unitPrice: 500_000
          }
        ]
      })
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json() as any;
    assert.strictEqual(data.invoice.invoiceNumber, 'INV-API-TEST-001');
    assert.strictEqual(data.invoice.status, 'SEALED');
    assert.strictEqual(data.invoice.grandTotal, 535_000); // 500k + 7% VAT
    assert.strictEqual(data.invoice.amountInWords, 'ห้าแสนสามหมื่นห้าพันบาทถ้วน');
    assert.strictEqual(data.invoice.xmlPayload?.includes('rsm:TaxInvoice_CrossIndustryInvoice'), true);
  });

  test('POST /api/v1/vendor-risk/evaluate performs KYC screening and calculates risk score', async () => {
    const res = await fetch(`${baseUrl}/api/v1/vendor-risk/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendorId: 'VND-API-01',
        legalName: 'Siam Microelectronics Foundry Ltd.',
        taxId: '0105558000034',
        country: 'TH',
        yearEstablished: 2018,
        sanctionsHit: false,
        pepInvolved: false,
        financialRating: 'A',
        adverseMediaCount: 0,
        bankAccountVerified: true
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json() as any;
    assert.strictEqual(data.evaluation.vendorId, 'VND-API-01');
    assert.strictEqual(data.evaluation.riskBand, 'LOW');
    assert.strictEqual(data.evaluation.procurementStatus, 'APPROVED');
  });

  test('POST /api/v1/consensus/proposals & ballots conducts swarm Byzantine voting', async () => {
    // 1. Create proposal
    const propRes = await fetch(`${baseUrl}/api/v1/consensus/proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactionRef: 'TX-HIGH-VALUE-15M',
        requestedAmountTHB: 15_000_000,
        description: 'Autonomous hardware procurement cluster',
        quorumThreshold: 2,
        totalVotersRequired: 3
      })
    });

    assert.strictEqual(propRes.status, 201);
    const propData = await propRes.json() as any;
    const proposalId = propData.proposal.proposalId;

    // 2. Cast Ballot 1
    await fetch(`${baseUrl}/api/v1/consensus/ballots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proposalId,
        agentId: 'AGT-ORCA-PRIME',
        agentRole: 'CHIEF_ORCHESTRATOR',
        decision: 'APPROVE',
        justification: 'Strategic roadmap priority aligned.',
        signature: 'sig_orca'
      })
    });

    // 3. Cast Ballot 2 (Reaches quorum!)
    const ballot2Res = await fetch(`${baseUrl}/api/v1/consensus/ballots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proposalId,
        agentId: 'AGT-P2P-MATCHER',
        agentRole: 'PROCUREMENT_SPECIALIST',
        decision: 'APPROVE',
        justification: 'Vendor pricing verified.',
        signature: 'sig_p2p'
      })
    });

    assert.strictEqual(ballot2Res.status, 200);
    const ballot2Data = await ballot2Res.json() as any;
    assert.strictEqual(ballot2Data.result.status, 'CONSENSUS_REACHED');
    assert.strictEqual(ballot2Data.result.isApproved, true);
  });
});

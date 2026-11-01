import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ApiServer } from '../../src/presentation/server/api-server.js';

describe('ApiServer Sprint 3 Endpoints (Payroll, FX Hedging, Agent ROI)', () => {
  const server = new ApiServer();
  let baseUrl: string;
  const testPort = 19998;

  before(async () => {
    await server.listen(testPort);
    baseUrl = `http://localhost:${testPort}`;
  });

  after(async () => {
    await server.close();
  });

  test('POST /api/v1/payroll/profile, /payslip, and /pnd1 flow', async () => {
    // 1. Register employee profile
    const profileRes = await fetch(`${baseUrl}/api/v1/payroll/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: 'EMP-TUM-001',
        name: 'Kittisak Thanaboon',
        taxId: '1100500123456',
        baseSalaryTHB: 75000,
        fixedAllowancesTHB: 5000,
        pvdContributionRate: 0.03,
        ssoEnrolled: true,
        bankAccountRef: '0811234567'
      })
    });
    assert.equal(profileRes.status, 201);
    const profileData = await profileRes.json() as any;
    assert.equal(profileData.message, 'Profile registered');

    // 2. Generate monthly payslip
    const payslipRes = await fetch(`${baseUrl}/api/v1/payroll/payslip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: 'EMP-TUM-001',
        year: 2026,
        month: 11
      })
    });
    assert.equal(payslipRes.status, 201);
    const payslipData = await payslipRes.json() as any;
    assert.ok(payslipData.payslip);
    assert.equal(payslipData.payslip.grossIncomeTHB, 80000);
    assert.equal(payslipData.payslip.deductions.ssoEmployeeTHB, 750);
    assert.ok(payslipData.payslip.netPayableTHB > 0);
    assert.ok(payslipData.payslip.quantumSeal.signature);

    // 3. Generate PND1 Monthly Filing
    const pnd1Res = await fetch(`${baseUrl}/api/v1/payroll/pnd1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: 2026,
        month: 11,
        employerTaxId: '0105559999991',
        branch: '00000'
      })
    });
    assert.equal(pnd1Res.status, 201);
    const pnd1Data = await pnd1Res.json() as any;
    assert.ok(pnd1Data.filing);
    assert.equal(pnd1Data.filing.taxYear, 2026);
    assert.ok(pnd1Data.filing.rdTextPayload.includes('H|0105559999991|00000|11|2569|1|'));
  });

  test('POST /api/v1/fx/exposure and /hedge flow', async () => {
    // 1. Record foreign exposure
    const exposureRes = await fetch(`${baseUrl}/api/v1/fx/exposure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        poNumber: 'PO-TREASURY-001',
        vendorId: 'VND-OPENAI-LLC',
        currency: 'USD',
        amount: 25000,
        dueDate: '2026-12-31'
      })
    });
    assert.equal(exposureRes.status, 201);
    const exposureData = await exposureRes.json() as any;
    assert.ok(exposureData.exposure);
    const exposureId = exposureData.exposure.exposureId;

    // 2. Execute forward hedge
    const hedgeRes = await fetch(`${baseUrl}/api/v1/fx/hedge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exposureId,
        counterpartyBank: 'Kasikornbank (KBANK)',
        daysToMaturity: 60
      })
    });
    assert.equal(hedgeRes.status, 201);
    const hedgeData = await hedgeRes.json() as any;
    assert.ok(hedgeData.contract);
    assert.equal(hedgeData.contract.exposureId, exposureId);
    assert.equal(hedgeData.contract.status, 'ACTIVE');
    assert.ok(hedgeData.contract.contractForwardRate > 0);
  });

  test('POST /api/v1/agent-roi/token, /value, and GET /scorecard/:id flow', async () => {
    const testAgentId = 'AGENT-ORCHESTRATOR-X';

    // 1. Log token usage
    const tokenRes = await fetch(`${baseUrl}/api/v1/agent-roi/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: testAgentId,
        taskId: 'TASK-DAG-RUN-01',
        modelEngine: 'gemini-3.8-flash',
        inputTokens: 500000,
        outputTokens: 100000
      })
    });
    assert.equal(tokenRes.status, 201);

    // 2. Log business value
    const valRes = await fetch(`${baseUrl}/api/v1/agent-roi/value`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: testAgentId,
        taskId: 'TASK-DAG-RUN-01',
        category: 'COST_SAVING',
        valueTHB: 15000,
        evidenceRef: 'AUDIT-LOG-123'
      })
    });
    assert.equal(valRes.status, 201);

    // 3. Fetch scorecard
    const scRes = await fetch(`${baseUrl}/api/v1/agent-roi/scorecard/${testAgentId}`);
    assert.equal(scRes.status, 200);
    const scData = await scRes.json() as any;
    assert.ok(scData.scorecard);
    assert.equal(scData.scorecard.agentId, testAgentId);
    assert.equal(scData.scorecard.totalBusinessValueTHB, 15000);
    assert.ok(scData.scorecard.roiMultiplier > 10.0);
    assert.equal(scData.scorecard.efficiencyTier, 'EXCEPTIONAL');
  });
});

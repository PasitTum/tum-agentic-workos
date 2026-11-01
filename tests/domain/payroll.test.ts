import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ThaiTaxLogic } from '../../src/domain/payroll/thai-tax.logic.js';
import { Pnd1BuilderLogic } from '../../src/domain/payroll/pnd1-builder.logic.js';
import { PayrollService } from '../../src/application/services/payroll.service.js';
import { EmployeePayrollProfile } from '../../src/domain/payroll/payroll.types.js';

describe('Thai Payroll & PND1 Engine (WOS-EPIC-10)', () => {
  it('calculates SSO contribution capped at 750 THB on 15,000 THB base', () => {
    // Under wage cap: 10,000 * 5% = 500
    const ssoLow = ThaiTaxLogic.calculateSso(10000, true);
    assert.equal(ssoLow.employee, 500);
    assert.equal(ssoLow.employer, 500);

    // At wage cap: 15,000 * 5% = 750
    const ssoExact = ThaiTaxLogic.calculateSso(15000, true);
    assert.equal(ssoExact.employee, 750);

    // Above wage cap: 100,000 capped at 15,000 base => 750
    const ssoHigh = ThaiTaxLogic.calculateSso(100000, true);
    assert.equal(ssoHigh.employee, 750);

    // Unenrolled
    const ssoUnenrolled = ThaiTaxLogic.calculateSso(50000, false);
    assert.equal(ssoUnenrolled.employee, 0);
  });

  it('calculates progressive personal income tax brackets accurately', () => {
    // 15,000 / month = 180,000 / year
    // Deductions: 50% max 100k = 90k, personal 60k, SSO 750*12 = 9k => Total 159,000
    // Net taxable: 21,000 => 0-150k bracket (0%) => Tax = 0
    const profileLow: EmployeePayrollProfile = {
      employeeId: 'EMP-01',
      name: 'Somchai Jaidee',
      taxId: '1100500123456',
      baseSalaryTHB: 15000,
      fixedAllowancesTHB: 0,
      pvdContributionRate: 0,
      ssoEnrolled: true,
      bankAccountRef: '0812345678'
    };
    const taxLow = ThaiTaxLogic.calculateMonthlyTax(profileLow);
    assert.equal(taxLow.monthlyWithholdingTax, 0);

    // 100,000 / month = 1,200,000 / year
    // Deductions: expense 100,000, personal 60,000, SSO 9,000 => Total 169,000
    // Net taxable = 1,031,000
    // Progressive brackets:
    // 0-150k: 0
    // 150k-300k: 150k * 5% = 7,500
    // 300k-500k: 200k * 10% = 20,000
    // 500k-750k: 250k * 15% = 37,500
    // 750k-1M: 250k * 20% = 50,000
    // 1M-1.031M: 31,000 * 25% = 7,750
    // Total annual tax = 122,750
    // Monthly withholding = 122,750 / 12 = 10,229.17 THB
    const profileHigh: EmployeePayrollProfile = {
      ...profileLow,
      employeeId: 'EMP-02',
      baseSalaryTHB: 100000
    };
    const taxHigh = ThaiTaxLogic.calculateMonthlyTax(profileHigh);
    assert.equal(taxHigh.monthlyWithholdingTax, 10229.17);
  });

  it('generates complete payslip with PQC seal and accounting entries', () => {
    const service = new PayrollService();
    service.registerPayrollProfile({
      employeeId: 'EMP-001',
      name: 'Prasert Sookjai',
      taxId: '3100600987654',
      baseSalaryTHB: 80000,
      fixedAllowancesTHB: 5000,
      pvdContributionRate: 0.05,
      ssoEnrolled: true,
      bankAccountRef: '012-3-45678-9'
    });

    const slip = service.generateMonthlyPayslip('EMP-001', 2026, 11);
    assert.equal(slip.employeeId, 'EMP-001');
    assert.equal(slip.grossIncomeTHB, 85000);
    assert.equal(slip.deductions.ssoEmployeeTHB, 750);
    assert.equal(slip.deductions.pvdEmployeeTHB, 4000); // 5% of base 80,000
    assert.ok(slip.deductions.withholdingTaxTHB > 0);
    assert.equal(slip.netPayableTHB, 85000 - slip.deductions.totalDeductionsTHB);
    assert.ok(slip.quantumSeal.signature.length > 0);
    assert.equal(slip.quantumSeal.algorithm, 'NIST-FIPS-204-ML-DSA-65');
  });

  it('generates official Revenue Department PND1 pipe-delimited text filing', () => {
    const service = new PayrollService();
    service.registerPayrollProfile({
      employeeId: 'EMP-101',
      name: 'Vichai Siri',
      taxId: '1100500998877',
      baseSalaryTHB: 50000,
      fixedAllowancesTHB: 0,
      pvdContributionRate: 0,
      ssoEnrolled: true,
      bankAccountRef: '0891234567'
    });

    const filing = service.generatePnd1MonthlyFiling(2026, 11, '0105559999991', '00000');
    assert.equal(filing.taxYear, 2026);
    assert.equal(filing.taxMonth, 11);
    assert.equal(filing.totalEmployees, 1);
    assert.ok(filing.rdTextPayload.startsWith('H|0105559999991|00000|11|2569|1|'));
    assert.ok(filing.rdTextPayload.includes('D|1|1100500998877|Vichai Siri|'));
  });
});

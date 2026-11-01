import { QuantumCryptoService } from '../../infrastructure/crypto/quantum-crypto.js';
import { ThaiTaxLogic } from '../../domain/payroll/thai-tax.logic.js';
import { Pnd1BuilderLogic } from '../../domain/payroll/pnd1-builder.logic.js';
import { bahtText } from '../../domain/etax/baht-text.js';
import {
  EmployeePayrollProfile,
  MonthlyPayslip,
  Pnd1MonthlyFiling,
  Pnd1FilingRecord
} from '../../domain/payroll/payroll.types.js';
import { SovereignTelemetryBus } from '../../infrastructure/telemetry/sovereign-telemetry.js';

export class PayrollService {
  private profiles = new Map<string, EmployeePayrollProfile>();
  private payslips = new Map<string, MonthlyPayslip>();
  private pnd1Filings = new Map<string, Pnd1MonthlyFiling>();
  private sovereignKeyPair = QuantumCryptoService.generateKeyPair('NIST-FIPS-204-ML-DSA-65');

  public registerPayrollProfile(profile: any): void {
    const normalized: EmployeePayrollProfile = {
      employeeId: profile.employeeId,
      name: profile.name || profile.fullName || 'Employee',
      taxId: profile.taxId,
      baseSalaryTHB: profile.baseSalaryTHB ?? 0,
      fixedAllowancesTHB: profile.fixedAllowancesTHB ?? profile.fixedAllowanceTHB ?? 0,
      pvdContributionRate: profile.pvdContributionRate ?? (profile.providentFundPercent != null ? profile.providentFundPercent / 100 : 0),
      ssoEnrolled: profile.ssoEnrolled ?? profile.hasSocialSecurity ?? true,
      bankAccountRef: profile.bankAccountRef || profile.bankAccountNumber || '',
      fullName: profile.fullName || profile.name,
      fixedAllowanceTHB: profile.fixedAllowanceTHB ?? profile.fixedAllowancesTHB ?? 0,
      hasSocialSecurity: profile.hasSocialSecurity ?? profile.ssoEnrolled ?? true,
      providentFundPercent: profile.providentFundPercent ?? (profile.pvdContributionRate != null ? profile.pvdContributionRate * 100 : 0),
      personalDeductionsTHB: profile.personalDeductionsTHB ?? 60000,
      spouseDeductionTHB: profile.spouseDeductionTHB ?? 0,
      childCount: profile.childCount ?? 0,
      paymentMethod: profile.paymentMethod || 'PROMPTPAY',
      bankAccountNumber: profile.bankAccountNumber || profile.bankAccountRef || ''
    };
    this.profiles.set(normalized.employeeId, normalized);
  }

  public getPayrollProfile(employeeId: string): EmployeePayrollProfile | undefined {
    return this.profiles.get(employeeId);
  }

  public generateMonthlyPayslip(
    employeeId: string,
    periodYear: number,
    periodMonth: number
  ): MonthlyPayslip {
    const profile = this.profiles.get(employeeId);
    if (!profile) {
      throw new Error(`Employee payroll profile '${employeeId}' not found.`);
    }

    const grossIncomeTHB = profile.baseSalaryTHB + profile.fixedAllowancesTHB;
    const deductions = ThaiTaxLogic.evaluateDeductions(profile);
    const netPayableTHB = Math.round((grossIncomeTHB - deductions.totalDeductionsTHB) * 100) / 100;
    const netPayableText = bahtText(netPayableTHB);
    const payslipId = `PAY-${periodYear}${periodMonth.toString().padStart(2, '0')}-${employeeId}`;

    const envelope = QuantumCryptoService.signEnvelope({
      payslipId,
      employeeId,
      periodYear,
      periodMonth,
      grossIncomeTHB,
      netPayableTHB,
      issuedAt: new Date().toISOString()
    }, this.sovereignKeyPair);

    const payslip: MonthlyPayslip = {
      payslipId,
      employeeId,
      employeeName: profile.name,
      taxId: profile.taxId,
      periodYear,
      periodMonth,
      grossIncomeTHB,
      deductions,
      netPayableTHB,
      netPayableText,
      issuedAt: new Date().toISOString(),
      quantumSeal: {
        algorithm: envelope.algorithm,
        signature: envelope.signature,
        digest: envelope.digest
      },
      grossEarningsTHB: grossIncomeTHB,
      ssoEmployeeTHB: deductions.ssoEmployeeTHB,
      providentFundTHB: deductions.pvdEmployeeTHB,
      withholdingTaxTHB: deductions.withholdingTaxTHB,
      totalDeductionsTHB: deductions.totalDeductionsTHB,
      netPayTHB: netPayableTHB,
      pqcSealSignature: envelope.signature,
      pqcAlgorithm: 'ML-DSA-65'
    };

    this.payslips.set(payslipId, payslip);

    SovereignTelemetryBus.emit(
      'WORKFORCE',
      'PAYSLIP_ISSUED',
      employeeId,
      'HUMAN',
      { payslipId, gross: grossIncomeTHB, net: netPayableTHB }
    );

    return payslip;
  }

  public generatePnd1MonthlyFiling(
    periodYear: number,
    periodMonth: number,
    employerTaxId = '0105558000018',
    employerBranch = '00000'
  ): Pnd1MonthlyFiling {
    const records: Pnd1FilingRecord[] = [];
    let seq = 1;

    for (const profile of this.profiles.values()) {
      const grossIncome = profile.baseSalaryTHB + profile.fixedAllowancesTHB;
      const { monthlyWithholdingTax } = ThaiTaxLogic.calculateMonthlyTax(profile);

      records.push({
        recordSequence: seq++,
        taxId: profile.taxId,
        employeeName: profile.name,
        incomeType: '40(1)',
        paymentDate: `28/${periodMonth.toString().padStart(2, '0')}/${periodYear + 543}`,
        grossIncomeTHB: grossIncome,
        withholdingTaxTHB: monthlyWithholdingTax,
        taxCondition: '1'
      });
    }

    const totalGross = Math.round(records.reduce((sum, r) => sum + r.grossIncomeTHB, 0) * 100) / 100;
    const totalTax = Math.round(records.reduce((sum, r) => sum + r.withholdingTaxTHB, 0) * 100) / 100;
    const filingId = `PND1-${periodYear}-${periodMonth.toString().padStart(2, '0')}`;

    const filing: Pnd1MonthlyFiling = {
      filingId,
      taxYear: periodYear,
      taxMonth: periodMonth,
      employerTaxId,
      employerBranch,
      totalEmployees: records.length,
      totalGrossIncomeTHB: totalGross,
      totalTaxWithheldTHB: totalTax,
      records,
      rdTextPayload: '',
      sealedAt: new Date().toISOString()
    };

    filing.rdTextPayload = Pnd1BuilderLogic.buildRdText(filing);
    filing.rdUploadText = filing.rdTextPayload;
    this.pnd1Filings.set(filingId, filing);

    SovereignTelemetryBus.emit(
      'AUDIT',
      'PND1_FILING_GENERATED',
      employerTaxId,
      'SYSTEM',
      { filingId, totalEmployees: records.length, totalTax }
    );

    return filing;
  }

  public getPayslip(payslipId: string): MonthlyPayslip | undefined {
    return this.payslips.get(payslipId);
  }

  public getPnd1Filing(filingId: string): Pnd1MonthlyFiling | undefined {
    return this.pnd1Filings.get(filingId);
  }
}

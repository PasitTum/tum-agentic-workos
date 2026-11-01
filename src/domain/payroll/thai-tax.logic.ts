import {
  EmployeePayrollProfile,
  PayrollDeductions
} from './payroll.types.js';

export class ThaiTaxLogic {
  /**
   * Calculates monthly Social Security Fund (SSO ม.33) contributions.
   * Statutory 5% of monthly salary capped at 15,000 THB basis (Max 750 THB/month).
   */
  static calculateSso(baseSalaryTHB: number, enrolled = true): { employee: number; employer: number } {
    if (!enrolled) return { employee: 0, employer: 0 };
    const wageBase = Math.max(1_650, Math.min(baseSalaryTHB, 15_000));
    const contribution = Math.min(Math.round(wageBase * 0.05), 750);
    return { employee: contribution, employer: contribution };
  }

  /**
   * Helper alias for monthly employee SSO contribution
   */
  static calculateMonthlySso(salary: number): number {
    return this.calculateSso(salary, true).employee;
  }

  /**
   * Calculates monthly personal withholding tax (ภ.ง.ด.1) using official Revenue Department progressive brackets.
   */
  static calculateMonthlyTax(profile: EmployeePayrollProfile): {
    annualTax: number;
    monthlyWithholdingTax: number;
    taxableIncomeAnnual: number;
  } {
    const monthlyGross = profile.baseSalaryTHB + profile.fixedAllowancesTHB;
    const annualGross = monthlyGross * 12;

    // 1. Standard Expense Deduction (50% max 100,000 THB)
    const expenseDeduction = Math.min(annualGross * 0.5, 100_000);

    // 2. Personal Allowance (60,000 THB)
    const personalAllowance = 60_000;

    // 3. Social Security Contribution (5% max 9,000 THB/year)
    const ssoAnnual = this.calculateSso(profile.baseSalaryTHB, profile.ssoEnrolled).employee * 12;

    // 4. Provident Fund Contribution (max 500,000 THB)
    const pvdAnnual = Math.min(profile.baseSalaryTHB * profile.pvdContributionRate * 12, 500_000);

    const totalDeductions = expenseDeduction + personalAllowance + ssoAnnual + pvdAnnual;
    const taxableIncomeAnnual = Math.max(0, annualGross - totalDeductions);

    // 5. Progressive Tax Brackets
    const annualTax = this.calculateProgressiveTax(taxableIncomeAnnual);
    const monthlyWithholdingTax = Math.round((annualTax / 12) * 100) / 100;

    return {
      annualTax,
      monthlyWithholdingTax,
      taxableIncomeAnnual
    };
  }

  /**
   * Helper alias for monthly withholding tax from profile or partial object
   */
  static calculateMonthlyWithholdingTax(profile: any): number {
    const normProfile: EmployeePayrollProfile = {
      employeeId: profile.employeeId || 'EMP',
      name: profile.name || profile.fullName || 'Employee',
      taxId: profile.taxId || '1100500123456',
      baseSalaryTHB: profile.baseSalaryTHB ?? 0,
      fixedAllowancesTHB: profile.fixedAllowancesTHB ?? profile.fixedAllowanceTHB ?? 0,
      pvdContributionRate: profile.pvdContributionRate ?? ((profile.providentFundPercent ?? 0) / 100),
      ssoEnrolled: profile.ssoEnrolled ?? profile.hasSocialSecurity ?? true,
      bankAccountRef: profile.bankAccountRef || profile.bankAccountNumber || ''
    };
    return this.calculateMonthlyTax(normProfile).monthlyWithholdingTax;
  }

  /**
   * Evaluates progressive tax rate against annual net taxable income.
   */
  static calculateProgressiveTax(taxableIncome: number): number {
    let tax = 0;
    let rem = taxableIncome;

    const brackets = [
      { limit: 150_000, rate: 0.00 },
      { limit: 150_000, rate: 0.05 }, // 150,001 - 300,000
      { limit: 200_000, rate: 0.10 }, // 300,001 - 500,000
      { limit: 250_000, rate: 0.15 }, // 500,001 - 750,000
      { limit: 250_000, rate: 0.20 }, // 750,001 - 1,000,000
      { limit: 1_000_000, rate: 0.25 }, // 1,000,001 - 2,000,000
      { limit: 3_000_000, rate: 0.30 }, // 2,000,001 - 5,000,000
      { limit: Infinity, rate: 0.35 }   // > 5,000,000
    ];

    for (const b of brackets) {
      if (rem <= 0) break;
      const taxableInBracket = Math.min(rem, b.limit);
      tax += taxableInBracket * b.rate;
      rem -= taxableInBracket;
    }

    return Math.round(tax * 100) / 100;
  }

  /**
   * Evaluates all monthly payroll deductions.
   */
  static evaluateDeductions(profile: EmployeePayrollProfile): PayrollDeductions {
    const sso = this.calculateSso(profile.baseSalaryTHB, profile.ssoEnrolled);
    const pvd = Math.round(profile.baseSalaryTHB * profile.pvdContributionRate * 100) / 100;
    const { monthlyWithholdingTax } = this.calculateMonthlyTax(profile);

    const totalDeductionsTHB = Math.round((sso.employee + pvd + monthlyWithholdingTax) * 100) / 100;

    return {
      ssoEmployeeTHB: sso.employee,
      ssoEmployerTHB: sso.employer,
      pvdEmployeeTHB: pvd,
      pvdEmployerTHB: pvd,
      withholdingTaxTHB: monthlyWithholdingTax,
      totalDeductionsTHB
    };
  }
}

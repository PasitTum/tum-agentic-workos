export interface EmployeePayrollProfile {
  employeeId: string;
  name: string;
  taxId: string; // 13-digit Thai Tax ID
  baseSalaryTHB: number;
  fixedAllowancesTHB: number;
  pvdContributionRate: number; // e.g. 0.05 for 5%
  ssoEnrolled: boolean; // ประกันสังคม ม.33
  bankAccountRef: string;
  fullName?: string;
  fixedAllowanceTHB?: number;
  hasSocialSecurity?: boolean;
  providentFundPercent?: number;
  personalDeductionsTHB?: number;
  spouseDeductionTHB?: number;
  childCount?: number;
  paymentMethod?: string;
  bankAccountNumber?: string;
}

export interface PayrollDeductions {
  ssoEmployeeTHB: number; // 5% max 750
  ssoEmployerTHB: number; // 5% max 750
  pvdEmployeeTHB: number;
  pvdEmployerTHB: number;
  withholdingTaxTHB: number; // ภาษีหัก ณ ที่จ่าย ภ.ง.ด.1
  totalDeductionsTHB: number;
}

export interface MonthlyPayslip {
  payslipId: string;
  employeeId: string;
  employeeName: string;
  taxId: string;
  periodYear: number;
  periodMonth: number;
  grossIncomeTHB: number;
  deductions: PayrollDeductions;
  netPayableTHB: number;
  netPayableText: string; // Thai Baht Text
  issuedAt: string;
  quantumSeal: {
    algorithm: string;
    signature: string;
    digest: string;
  };
  grossEarningsTHB?: number;
  ssoEmployeeTHB?: number;
  providentFundTHB?: number;
  withholdingTaxTHB?: number;
  totalDeductionsTHB?: number;
  netPayTHB?: number;
  pqcSealSignature?: string;
  pqcAlgorithm?: string;
}

export interface Pnd1FilingRecord {
  recordSequence: number;
  taxId: string;
  employeeName: string;
  incomeType: '40(1)';
  paymentDate: string;
  grossIncomeTHB: number;
  withholdingTaxTHB: number;
  taxCondition: '1'; // 1 = หัก ณ ที่จ่าย (Withholding)
}

export interface Pnd1MonthlyFiling {
  filingId: string;
  taxYear: number;
  taxMonth: number;
  employerTaxId: string;
  employerBranch: string;
  totalEmployees: number;
  totalGrossIncomeTHB: number;
  totalTaxWithheldTHB: number;
  records: Pnd1FilingRecord[];
  rdTextPayload: string; // Official fixed-width / pipe-delimited RD format
  rdUploadText?: string;
  sealedAt: string;
}

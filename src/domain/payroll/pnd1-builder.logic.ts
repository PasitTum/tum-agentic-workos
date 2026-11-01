import {
  Pnd1MonthlyFiling
} from './payroll.types.js';

export class Pnd1BuilderLogic {
  /**
   * Builds official Thai Revenue Department (RD) P.N.D.1 (ภ.ง.ด.1) text upload payload.
   * Standard format: RecordSeq|TaxID|Name|PaymentDate(DD/MM/YYYY)|IncomeType(40(1))|IncomeAmount|TaxAmount|Condition(1)
   */
  static buildRdText(filing: Pnd1MonthlyFiling): string {
    const lines: string[] = [];

    // Header record: H|EmployerTaxId|Branch|TaxMonth(MM)|TaxYear(YYYY BE)|TotalRecords|TotalIncome|TotalTax
    const thaiBuddhistYear = filing.taxYear + 543;
    const monthStr = filing.taxMonth.toString().padStart(2, '0');
    const header = `H|${filing.employerTaxId}|${filing.employerBranch}|${monthStr}|${thaiBuddhistYear}|${filing.totalEmployees}|${filing.totalGrossIncomeTHB.toFixed(2)}|${filing.totalTaxWithheldTHB.toFixed(2)}`;
    lines.push(header);

    // Detail records
    for (const rec of filing.records) {
      const line = `D|${rec.recordSequence}|${rec.taxId}|${rec.employeeName}|${rec.paymentDate}|${rec.incomeType}|${rec.grossIncomeTHB.toFixed(2)}|${rec.withholdingTaxTHB.toFixed(2)}|${rec.taxCondition}`;
      lines.push(line);
    }

    return lines.join('\r\n');
  }

  /**
   * Validates P.N.D.1 filing record sums.
   */
  static validateFiling(filing: Pnd1MonthlyFiling): boolean {
    const sumGross = Math.round(filing.records.reduce((sum, r) => sum + r.grossIncomeTHB, 0) * 100) / 100;
    const sumTax = Math.round(filing.records.reduce((sum, r) => sum + r.withholdingTaxTHB, 0) * 100) / 100;

    return (
      filing.records.length === filing.totalEmployees &&
      Math.abs(sumGross - filing.totalGrossIncomeTHB) <= 0.05 &&
      Math.abs(sumTax - filing.totalTaxWithheldTHB) <= 0.05
    );
  }
}

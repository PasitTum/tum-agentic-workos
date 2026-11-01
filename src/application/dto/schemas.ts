import { z } from 'zod';

export const SkillItemSchema = z.object({
  name: z.string().min(1),
  category: z.enum(['ENGINEERING', 'PROCUREMENT', 'AUDIT', 'SECURITY', 'LEGAL', 'GENERAL']),
  proficiency: z.number().int().min(1).max(10)
});

export const RegisterAgentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  departmentId: z.string().min(1),
  supervisorId: z.string().nullable(),
  skills: z.array(SkillItemSchema).default([]),
  modelEngine: z.string().default('gemini-3.8-flash'),
  dailyTokenBudget: z.number().positive().default(2_000_000),
  spendingLimit: z.number().nonnegative().default(0)
});

export const RegisterEmployeeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  title: z.string().min(1),
  departmentId: z.string().min(1),
  supervisorId: z.string().nullable().default(null),
  approvalLimit: z.number().nonnegative().default(100_000)
});

export const CreateDelegationSchema = z.object({
  delegatorEmployeeId: z.string().min(1),
  delegateeAgentId: z.string().min(1),
  scope: z.array(z.string()).min(1),
  maxFinancialCap: z.number().positive(),
  validUntil: z.string().datetime()
});

export const LineItemSchema = z.object({
  itemId: z.string().min(1),
  sku: z.string().min(1),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().positive()
});

export const CreatePurchaseRequisitionSchema = z.object({
  requesterId: z.string().min(1),
  requesterType: z.enum(['HUMAN', 'AGENT']),
  departmentId: z.string().min(1),
  items: z.array(LineItemSchema).min(1),
  justification: z.string().min(3)
});

export const CreatePurchaseOrderSchema = z.object({
  prNumber: z.string().min(1),
  vendorId: z.string().min(1),
  vendorName: z.string().min(1),
  paymentTerms: z.string().default('Net 30'),
  taxRate: z.number().min(0).max(1).default(0.07)
});

export const SubmitGoodsReceiptSchema = z.object({
  poNumber: z.string().min(1),
  warehouseId: z.string().min(1),
  inspectorId: z.string().min(1),
  inspectorType: z.enum(['HUMAN', 'AGENT']),
  items: z.array(z.object({
    itemId: z.string().min(1),
    sku: z.string().min(1),
    receivedQuantity: z.number().nonnegative(),
    acceptedQuantity: z.number().nonnegative(),
    rejectedQuantity: z.number().nonnegative().default(0),
    batchNumber: z.string().optional(),
    notes: z.string().optional()
  })).min(1)
});

export const SubmitVendorInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1),
  vendorId: z.string().min(1),
  poNumber: z.string().min(1),
  grnNumber: z.string().optional(),
  dueDate: z.string().datetime(),
  items: z.array(z.object({
    itemId: z.string().min(1),
    sku: z.string().min(1),
    billedQuantity: z.number().positive(),
    unitPrice: z.number().positive()
  })).min(1),
  taxRate: z.number().min(0).max(1).default(0.07),
  bankAccountRef: z.string().min(1)
});

export const MintDacSchema = z.object({
  agentId: z.string().min(1),
  issuerId: z.string().min(1),
  scopes: z.array(z.string()).min(1),
  spendingCapTHB: z.number().nonnegative(),
  durationDays: z.number().positive().default(30)
});

export const InterceptSyscallSchema = z.object({
  agentId: z.string().min(1),
  syscall: z.enum(['SYS_FILE_READ', 'SYS_FILE_WRITE', 'SYS_NET_CONNECT', 'SYS_PROCESS_SPAWN', 'SYS_ENV_ACCESS']),
  target: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()).optional()
});

export const LegacySyncPayloadSchema = z.object({
  externalSystem: z.enum(['SAP_S4HANA', 'SALESFORCE_CRM', 'ORACLE_NETSUITE']),
  externalEntityId: z.string().min(1),
  entityType: z.enum(['PURCHASE_ORDER', 'INVOICE', 'VENDOR', 'EMPLOYEE']),
  rawPayload: z.record(z.string(), z.unknown())
});

export const MergeConflictFragmentSchema = z.object({
  filePath: z.string().min(1),
  baseCode: z.string(),
  branchACode: z.string(),
  branchBCode: z.string()
});

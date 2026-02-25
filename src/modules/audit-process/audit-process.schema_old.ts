import { z } from 'zod';

export const createAuditProcessSchema = z.object({
  chptCode: z.string().min(1, 'Process template code required'),
  auditType: z.enum(['ONBOARD', 'WEEKLY', 'HOTCASE', 'MONTHLY']),
  triggerUsiCode: z.string().min(1, 'Teacher USI code required'),
  cuieCode: z.string().optional(),
  checkerUsiCode: z.string().optional(),
});

export const updateAuditProcessSchema = z.object({
  mychecker: z.string().optional(),
  description: z.string().optional(),
});

export const assignAuditProcessSchema = z.object({
  checkerUsiCode: z.string().min(1, 'Auditor code required'),
});

export type CreateAuditProcessInput = z.infer<typeof createAuditProcessSchema>;

import { z } from 'zod';

export const createAuditProcessSchema = z.object({
  cuie_code: z.string().min(1, 'cuie_code is required'),
  audit_type: z.enum(['ONB-AUDIT', 'WKL-AUDIT', 'MTL-AUDIT', 'HOT-AUDIT', 'RTR-AUDIT']),
  trigger_usi_code: z.string().min(1, 'trigger_usi_code is required'),
});

export type CreateAuditProcessInput = z.infer<typeof createAuditProcessSchema>;

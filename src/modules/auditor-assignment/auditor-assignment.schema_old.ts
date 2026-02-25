import { z } from 'zod';

export const assignAuditorSchema = z.object({
  chpiCode: z.string().min(1, 'Audit process code required'),
  auditorCode: z.string().min(1, 'Auditor code required'),
});

export const randomAssignSchema = z.object({
  chpiCode: z.string().min(1, 'Audit process code required'),
});

export type AssignAuditorInput = z.infer<typeof assignAuditorSchema>;
export type RandomAssignInput = z.infer<typeof randomAssignSchema>;

import { z } from 'zod';

export const assignAuditorSchema = z.object({
  chpi_code: z.string().min(1, 'chpi_code is required'),
  auditor_usi_code: z.string().min(1, 'auditor_usi_code is required'),
});

export type AssignAuditorInput = z.infer<typeof assignAuditorSchema>;

export const randomAssignSchema = z.object({
  chpi_codes: z.array(z.string().min(1)).min(1, 'At least one chpi_code is required'),
});

export type RandomAssignInput = z.infer<typeof randomAssignSchema>;

export const unassignAuditorSchema = z.object({
  chpi_code: z.string().min(1, 'chpi_code is required'),
});

export type UnassignAuditorInput = z.infer<typeof unassignAuditorSchema>;

export const assignOnboardSchema = z.object({
  usi_code: z.string().min(1, 'usi_code is required'),
  auditor_usi_code: z.string().min(1, 'auditor_usi_code is required'),
  cuie_code: z.string().min(1, 'cuie_code is required'),
});

export type AssignOnboardInput = z.infer<typeof assignOnboardSchema>;

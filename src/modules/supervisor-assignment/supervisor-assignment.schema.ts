import { z } from 'zod';

export const assignSupervisorSchema = z.object({
  chpiCodes: z.array(z.string().min(1)).min(1, 'At least one chpiCode is required'),
  supervisorCode: z.string().min(1, 'supervisorCode is required'),
});

export type AssignSupervisorInput = z.infer<typeof assignSupervisorSchema>;

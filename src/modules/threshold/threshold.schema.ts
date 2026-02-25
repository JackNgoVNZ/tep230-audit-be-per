import { z } from 'zod';

export const updateThresholdSchema = z.object({
  min_score: z.number().min(0, 'min_score must be >= 0').max(5, 'min_score must be <= 5').nullable().optional(),
  max_score: z.number().min(0, 'max_score must be >= 0').max(5, 'max_score must be <= 5').nullable().optional(),
  has_second_audit: z.number().min(0).max(1).optional(),
  has_unreg4: z.number().min(0).max(1).optional(),
  published: z.number().min(0).max(1).optional(),
});

export type UpdateThresholdInput = z.infer<typeof updateThresholdSchema>;

import { z } from 'zod';

export const updateThresholdSchema = z.object({
  min_score: z.number().min(0).max(5).optional(),
  max_score: z.number().min(0).max(5).optional(),
  has_second_audit: z.number().min(0).max(1).optional(),
  has_unreg4: z.number().min(0).max(1).optional(),
  published: z.number().min(0).max(1).optional(),
});

export type UpdateThresholdInput = z.infer<typeof updateThresholdSchema>;

import { z } from 'zod';

export const batchUpdateSchema = z.object({
  items: z.array(z.object({
    chli_code: z.string().min(1, 'chli_code is required'),
    score1: z.number().min(0).max(5),
    reason: z.string().max(2048).optional(),
  })).min(1, 'At least one item required'),
});

export type BatchUpdateInput = z.infer<typeof batchUpdateSchema>;

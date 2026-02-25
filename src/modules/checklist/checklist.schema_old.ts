import { z } from 'zod';

export const batchUpdateSchema = z.object({
  items: z.array(z.object({
    code: z.string().min(1, 'Checklist item code required'),
    score1: z.string().nullable().optional(),
    score2: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
  })).min(1, 'At least one item required'),
});

export const updateChecklistSchema = z.object({
  score1: z.string().nullable().optional(),
  score2: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

export type BatchUpdateInput = z.infer<typeof batchUpdateSchema>;
export type UpdateChecklistInput = z.infer<typeof updateChecklistSchema>;

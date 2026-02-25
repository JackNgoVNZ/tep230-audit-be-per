import { z } from 'zod';

export const createChptSchema = z.object({
  code: z.string().min(1, 'code is required'),
  name: z.string().min(1, 'name is required'),
  mypt: z.string().optional(),
  mygg: z.string().optional(),
  mylcp: z.string().optional(),
  mylcet: z.string().optional(),
  triggerusertype: z.string().optional(),
  supust: z.string().optional(),
  note: z.string().optional(),
});

export const updateChptSchema = z.object({
  name: z.string().min(1).optional(),
  mypt: z.string().optional(),
  mygg: z.string().optional(),
  mylcp: z.string().optional(),
  mylcet: z.string().optional(),
  triggerusertype: z.string().optional(),
  supust: z.string().optional(),
  note: z.string().optional(),
});

export const createChstSchema = z.object({
  code: z.string().min(1, 'code is required'),
  name: z.string().min(1, 'name is required'),
  mychpt: z.string().min(1, 'mychpt is required'),
  checksample: z.string().optional(),
  mychrt: z.string().optional(),
});

export const updateChstSchema = z.object({
  name: z.string().min(1).optional(),
  checksample: z.string().optional(),
  mychrt: z.string().optional(),
});

export const createChltSchema = z.object({
  code: z.string().min(1, 'code is required'),
  name: z.string().min(1, 'name is required'),
  mychst: z.string().min(1, 'mychst is required'),
  subcode: z.string().optional(),
  myparentchlt: z.string().optional(),
  scoretype: z.string().optional(),
  score1: z.number().optional(),
  scoretype2: z.string().optional(),
  score2: z.number().optional(),
});

export const updateChltSchema = z.object({
  name: z.string().min(1).optional(),
  subcode: z.string().optional(),
  scoretype: z.string().optional(),
  score1: z.number().optional(),
  scoretype2: z.string().optional(),
  score2: z.number().optional(),
});

export const batchCreateChptSchema = z.object({
  pt: z.string().min(1, 'pt is required'),
  gg: z.array(z.string().min(1)).min(1, 'at least one gg is required'),
  lcp: z.array(z.string().min(1)).min(1, 'at least one lcp is required'),
  lcet: z.array(z.string().min(1)).min(1, 'at least one lcet is required'),
});

export type CreateChptInput = z.infer<typeof createChptSchema>;
export type UpdateChptInput = z.infer<typeof updateChptSchema>;
export type BatchCreateChptInput = z.infer<typeof batchCreateChptSchema>;
export type CreateChstInput = z.infer<typeof createChstSchema>;
export type UpdateChstInput = z.infer<typeof updateChstSchema>;
export type CreateChltInput = z.infer<typeof createChltSchema>;
export type UpdateChltInput = z.infer<typeof updateChltSchema>;

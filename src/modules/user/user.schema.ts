import { z } from 'zod';

export const createUserSchema = z.object({
  username: z.string().min(1, 'username is required'),
  fullname: z.string().min(1, 'fullname is required'),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
  phone: z.string().optional(),
  myust: z.enum(['TO', 'QS', 'QA', 'TE'], { message: 'myust must be TO, QS, QA, or TE' }),
});

export const updateUserSchema = z.object({
  fullname: z.string().min(1).optional(),
  email: z.string().email().or(z.literal('')).optional(),
  phone: z.string().optional(),
  myust: z.enum(['TO', 'QS', 'QA', 'TE']).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

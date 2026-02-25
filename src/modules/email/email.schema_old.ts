import { z } from 'zod';

export const sendEmailSchema = z.object({
  templateCode: z.string().min(1, 'Template code required'),
  recipientEmail: z.string().email('Valid email required'),
  recipientName: z.string().optional(),
  variables: z.record(z.string(), z.string()).optional(),
});

export const createTemplateSchema = z.object({
  code: z.string().min(1, 'Template code required'),
  name: z.string().min(1, 'Template name required'),
  subject: z.string().min(1, 'Subject required'),
  bodyHtml: z.string().min(1, 'Body HTML required'),
  auditType: z.string().optional(),
  triggerStatus: z.string().optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().optional(),
  subject: z.string().optional(),
  bodyHtml: z.string().optional(),
  auditType: z.string().nullable().optional(),
  triggerStatus: z.string().nullable().optional(),
  published: z.number().min(0).max(1).optional(),
});

export type SendEmailInput = z.infer<typeof sendEmailSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

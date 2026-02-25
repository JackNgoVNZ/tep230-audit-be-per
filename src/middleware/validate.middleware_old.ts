import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { sendError } from '../common/utils/response';

export function validate(schema: z.ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const messages = result.error.issues.map(
        (issue: z.core.$ZodIssue) => `${issue.path.join('.')}: ${issue.message}`
      );
      sendError(res, messages.join('; '), 422);
      return;
    }
    next();
  };
}

export function validateQuery(schema: z.ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const messages = result.error.issues.map(
        (issue: z.core.$ZodIssue) => `${issue.path.join('.')}: ${issue.message}`
      );
      sendError(res, messages.join('; '), 422);
      return;
    }
    next();
  };
}

import { Request, Response, NextFunction } from 'express';
import { AuditStepService } from './audit-step.service';
import { sendSuccess, sendError } from '../../common/utils/response';

const service = new AuditStepService();

export class AuditStepController {
  async start(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.params.code as string;
      const result = await service.startStep(code);
      sendSuccess(res, result, 'Step started');
    } catch (error: any) {
      if (error.statusCode) {
        sendError(res, error.message, error.statusCode);
      } else {
        next(error);
      }
    }
  }

  async complete(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.params.code as string;
      const result = await service.completeStep(code);
      sendSuccess(res, result, 'Step completed');
    } catch (error: any) {
      if (error.statusCode) {
        sendError(res, error.message, error.statusCode);
      } else {
        next(error);
      }
    }
  }
}

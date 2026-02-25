import { Request, Response, NextFunction } from 'express';
import { ChecklistService } from './checklist.service';
import { sendSuccess, sendError } from '../../common/utils/response';

const service = new ChecklistService();

export class ChecklistController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const chsiCode = req.query.chsiCode as string;
      if (!chsiCode) {
        sendError(res, 'chsiCode query parameter is required', 400);
        return;
      }
      const result = await service.getChecklistsByStep(chsiCode);
      sendSuccess(res, result, 'Checklist items');
    } catch (error: any) {
      if (error.statusCode) {
        sendError(res, error.message, error.statusCode);
      } else {
        next(error);
      }
    }
  }

  async batchUpdate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.batchUpdate(req.body);
      sendSuccess(res, result, 'Checklist items updated');
    } catch (error: any) {
      if (error.statusCode) {
        sendError(res, error.message, error.statusCode);
      } else {
        next(error);
      }
    }
  }
}

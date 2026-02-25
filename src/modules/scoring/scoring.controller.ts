import { Request, Response, NextFunction } from 'express';
import { ScoringService } from './scoring.service';
import { sendSuccess, sendError } from '../../common/utils/response';

const service = new ScoringService();

export class ScoringController {
  async calculate(req: Request, res: Response, next: NextFunction) {
    try {
      const chpiCode = req.params.chpiCode as string;
      const result = await service.calculateScore(chpiCode);
      sendSuccess(res, result, 'Score calculated');
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
      const chpiCode = req.params.chpiCode as string;
      const items = req.body?.items as { chli_code: string; score1: number; reason: string }[] | undefined;
      const result = await service.completeAudit(chpiCode, items);
      sendSuccess(res, result, 'Audit completed');
    } catch (error: any) {
      if (error.statusCode) {
        sendError(res, error.message, error.statusCode);
      } else {
        next(error);
      }
    }
  }
}

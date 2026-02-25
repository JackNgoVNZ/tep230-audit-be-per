import { Request, Response, NextFunction } from 'express';
import { ScoringService } from './scoring.service';
import { sendSuccess } from '../../common/utils/response';

const service = new ScoringService();

export class ScoringController {
  async calculate(req: Request, res: Response, next: NextFunction) {
    try {
      const chpiCode = req.params.chpiCode as string;
      const result = await service.calculateScore(chpiCode);
      sendSuccess(res, result, 'Score calculated');
    } catch (error) { next(error); }
  }

  async checkThreshold(req: Request, res: Response, next: NextFunction) {
    try {
      const chpiCode = req.params.chpiCode as string;
      const result = await service.checkThreshold(chpiCode);
      sendSuccess(res, result, 'Threshold check result');
    } catch (error) { next(error); }
  }

  async complete(req: Request, res: Response, next: NextFunction) {
    try {
      const chpiCode = req.params.chpiCode as string;
      const result = await service.completeAudit(chpiCode);
      sendSuccess(res, result, 'Audit completed');
    } catch (error) { next(error); }
  }
}

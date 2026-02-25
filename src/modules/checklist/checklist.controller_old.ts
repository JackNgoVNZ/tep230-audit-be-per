import { Request, Response, NextFunction } from 'express';
import { ChecklistService } from './checklist.service';
import { sendSuccess } from '../../common/utils/response';

const service = new ChecklistService();

export class ChecklistController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const chsiCode = req.query.chsiCode as string;
      const result = await service.getChecklistsByStep(chsiCode);
      sendSuccess(res, result, 'Checklist items');
    } catch (error) { next(error); }
  }

  async batchUpdate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.batchUpdate(req.body);
      sendSuccess(res, result, 'Checklist items updated');
    } catch (error) { next(error); }
  }

  async updateSingle(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.params.code as string;
      const { score1, score2, description } = req.body;
      const result = await service.updateSingle(code, score1, score2, description);
      sendSuccess(res, result, 'Checklist item updated');
    } catch (error) { next(error); }
  }
}

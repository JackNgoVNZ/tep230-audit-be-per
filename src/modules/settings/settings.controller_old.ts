import { Request, Response, NextFunction } from 'express';
import { SettingsService } from './settings.service';
import { sendSuccess } from '../../common/utils/response';
import { parsePagination, buildPaginationMeta } from '../../common/utils/pagination';

const service = new SettingsService();

export class SettingsController {
  async listChecklistTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePagination(req.query);
      const chstCode = req.query.chstCode as string | undefined;
      const result = await service.listChecklistTemplates(page, limit, chstCode);
      sendSuccess(res, result.data, 'Checklist templates', 200, buildPaginationMeta(result.total, page, limit));
    } catch (error) { next(error); }
  }

  async listProcessTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePagination(req.query);
      const result = await service.listProcessTemplates(page, limit);
      sendSuccess(res, result.data, 'Process templates', 200, buildPaginationMeta(result.total, page, limit));
    } catch (error) { next(error); }
  }

  async listStepTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePagination(req.query);
      const chptCode = req.query.chptCode as string | undefined;
      const result = await service.listStepTemplates(page, limit, chptCode);
      sendSuccess(res, result.data, 'Step templates', 200, buildPaginationMeta(result.total, page, limit));
    } catch (error) { next(error); }
  }
}

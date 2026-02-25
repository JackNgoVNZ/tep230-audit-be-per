import { Request, Response, NextFunction } from 'express';
import { GvFilterService } from './gv-filter.service';
import { sendSuccess } from '../../common/utils/response';
import { parsePagination, buildPaginationMeta } from '../../common/utils/pagination';

const service = new GvFilterService();

export class GvFilterController {
  async filterOnboard(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePagination(req.query);
      const result = await service.filterOnboard(page, limit);
      sendSuccess(res, result.data, 'Onboard GV list', 200, buildPaginationMeta(result.total, page, limit));
    } catch (error) { next(error); }
  }

  async filterHotcase(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePagination(req.query);
      const result = await service.filterHotcase(page, limit);
      sendSuccess(res, result.data, 'Hotcase GV list', 200, buildPaginationMeta(result.total, page, limit));
    } catch (error) { next(error); }
  }

  async filterWeekly(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePagination(req.query);
      const result = await service.filterWeekly(page, limit);
      sendSuccess(res, result.data, 'Weekly GV list', 200, buildPaginationMeta(result.total, page, limit));
    } catch (error) { next(error); }
  }

  async filterMonthly(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePagination(req.query);
      const result = await service.filterMonthly(page, limit);
      sendSuccess(res, result.data, 'Monthly GV list', 200, buildPaginationMeta(result.total, page, limit));
    } catch (error) { next(error); }
  }
}

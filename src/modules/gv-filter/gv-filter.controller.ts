import { Request, Response, NextFunction } from 'express';
import { GvFilterService } from './gv-filter.service';
import { parsePagination } from '../../common/utils/pagination';
import { sendSuccess, sendError } from '../../common/utils/response';

const service = new GvFilterService();

export class GvFilterController {
  async getCurrentPeriods(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.getCurrentPeriods();
      sendSuccess(res, result, 'Current CAP periods');
    } catch (error) {
      next(error);
    }
  }

  async filterOnboard(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePagination(req.query);
      const filters = {
        pt: req.query.pt as string | undefined,
        gg: req.query.gg as string | undefined,
        status: req.query.status as string | undefined,
        search: req.query.search as string | undefined,
        auditor: req.query.auditor as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
      };
      const result = await service.filterOnboard(page, limit, filters);
      sendSuccess(res, result.data, 'Onboard GV list', 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async filterHotcase(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePagination(req.query);
      const result = await service.filterHotcase(page, limit);
      sendSuccess(res, result.data, 'Hotcase GV list', 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async filterWeekly(req: Request, res: Response, next: NextFunction) {
    try {
      const capWeekCode = req.query.cap_week_code as string;
      if (!capWeekCode) {
        return sendError(res, 'cap_week_code is required', 400);
      }
      const { page, limit } = parsePagination(req.query);
      const result = await service.filterWeekly(capWeekCode, page, limit);
      sendSuccess(res, result.data, 'Weekly GV list', 200, result.meta);
    } catch (error: any) {
      if (error.statusCode) sendError(res, error.message, error.statusCode);
      else next(error);
    }
  }

  async filterMonthly(req: Request, res: Response, next: NextFunction) {
    try {
      const capMonthCode = req.query.cap_month_code as string;
      if (!capMonthCode) {
        return sendError(res, 'cap_month_code is required', 400);
      }
      const { page, limit } = parsePagination(req.query);
      const result = await service.filterMonthly(capMonthCode, page, limit);
      sendSuccess(res, result.data, 'Monthly GV list', 200, result.meta);
    } catch (error: any) {
      if (error.statusCode) sendError(res, error.message, error.statusCode);
      else next(error);
    }
  }

  async filterRetraining(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePagination(req.query);
      const result = await service.filterRetraining(page, limit);
      sendSuccess(res, result.data, 'Retraining GV list', 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getOnboardFilterOptions(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.getOnboardFilterOptions();
      sendSuccess(res, result, 'Onboard filter options');
    } catch (error) {
      next(error);
    }
  }

}

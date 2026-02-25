import { Request, Response, NextFunction } from 'express';
import { AuditProcessService } from './audit-process.service';
import { parsePagination } from '../../common/utils/pagination';
import { sendSuccess, sendError } from '../../common/utils/response';

const service = new AuditProcessService();

export class AuditProcessController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePagination(req.query);
      const result = await service.list(page, limit, {
        auditType: req.query.auditType as string | undefined,
        status: req.query.status as string | undefined,
        search: req.query.search as string | undefined,
        auditor: req.query.auditor as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        pt: req.query.pt as string | undefined,
        gg: req.query.gg as string | undefined,
        userCode: req.user?.usi_code,
        userRole: req.user?.myust,
      });
      sendSuccess(res, result.data, 'Audit processes', 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getFilterOptions(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.getFilterOptions();
      sendSuccess(res, result, 'Filter options');
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.createAuditProcess(req.body);
      sendSuccess(res, result, 'Audit process created', 201);
    } catch (error: any) {
      if (error.statusCode) {
        sendError(res, error.message, error.statusCode);
      } else {
        next(error);
      }
    }
  }

  async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePagination(req.query);
      const filters = {
        teacher: req.query.teacher as string | undefined,
        auditor: req.query.auditor as string | undefined,
        fromDate: req.query.fromDate as string | undefined,
        toDate: req.query.toDate as string | undefined,
        pt: req.query.pt as string | undefined,
        gg: req.query.gg as string | undefined,
      };
      const result = await service.getHistory(page, limit, filters);
      sendSuccess(res, result.data, 'Audit history', 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async start(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.params.code as string;
      const result = await service.startAudit(code);
      sendSuccess(res, result, 'Audit started');
    } catch (error: any) {
      if (error.statusCode) {
        sendError(res, error.message, error.statusCode);
      } else {
        next(error);
      }
    }
  }

  async getDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.params.code as string;
      const result = await service.getDetail(code);
      sendSuccess(res, result, 'Audit process detail');
    } catch (error: any) {
      if (error.statusCode) {
        sendError(res, error.message, error.statusCode);
      } else {
        next(error);
      }
    }
  }
}

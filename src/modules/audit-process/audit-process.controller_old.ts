import { Request, Response, NextFunction } from 'express';
import { AuditProcessService } from './audit-process.service';
import { sendSuccess } from '../../common/utils/response';
import { parsePagination, buildPaginationMeta } from '../../common/utils/pagination';

const service = new AuditProcessService();

export class AuditProcessController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.createAuditProcess(req.body, req.user!.code);
      sendSuccess(res, result, 'Audit process created with cascade', 201);
    } catch (error) { next(error); }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePagination(req.query);
      const auditType = req.query.auditType as string | undefined;
      const status = req.query.status as string | undefined;
      const result = await service.listProcesses(page, limit, auditType, status);
      sendSuccess(res, result.data, 'Audit processes', 200, buildPaginationMeta(result.total, page, limit));
    } catch (error) { next(error); }
  }

  async detail(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.getProcessDetail(req.params.code as string);
      sendSuccess(res, result, 'Audit process detail');
    } catch (error) { next(error); }
  }

  async assign(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.assignAuditor(req.params.code as string, req.body.checkerUsiCode);
      sendSuccess(res, result, 'Auditor assigned');
    } catch (error) { next(error); }
  }

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.cancelProcess(req.params.code as string);
      sendSuccess(res, result, 'Audit process cancelled');
    } catch (error) { next(error); }
  }
}

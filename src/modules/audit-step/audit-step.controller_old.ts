import { Request, Response, NextFunction } from 'express';
import { AuditStepService } from './audit-step.service';
import { sendSuccess } from '../../common/utils/response';
import { parsePagination, buildPaginationMeta } from '../../common/utils/pagination';

const service = new AuditStepService();

export class AuditStepController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePagination(req.query);
      const chpiCode = req.query.chpiCode as string;
      const result = await service.listSteps(chpiCode, page, limit);
      sendSuccess(res, result.data, 'Audit steps list', 200, buildPaginationMeta(result.total, page, limit));
    } catch (error) { next(error); }
  }

  async detail(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.params.code as string;
      const result = await service.getStepDetail(code);
      sendSuccess(res, result, 'Audit step detail');
    } catch (error) { next(error); }
  }

  async start(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.params.code as string;
      const result = await service.startStep(code, req.user!.code);
      sendSuccess(res, result, 'Audit step started');
    } catch (error) { next(error); }
  }

  async complete(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.params.code as string;
      const result = await service.completeStep(code, req.user!.code);
      sendSuccess(res, result, 'Audit step completed');
    } catch (error) { next(error); }
  }
}

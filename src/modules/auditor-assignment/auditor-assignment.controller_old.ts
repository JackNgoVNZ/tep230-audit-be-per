import { Request, Response, NextFunction } from 'express';
import { AuditorAssignmentService } from './auditor-assignment.service';
import { sendSuccess } from '../../common/utils/response';
import { parsePagination, buildPaginationMeta } from '../../common/utils/pagination';

const service = new AuditorAssignmentService();

export class AuditorAssignmentController {
  async listAuditors(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, search } = parsePagination(req.query);
      const result = await service.listAuditors(page, limit, search);
      sendSuccess(res, result.data, 'Auditors list', 200, buildPaginationMeta(result.total, page, limit));
    } catch (error) { next(error); }
  }

  async assign(req: Request, res: Response, next: NextFunction) {
    try {
      const { chpiCode, auditorCode } = req.body;
      const result = await service.assignAuditor(chpiCode, auditorCode);
      sendSuccess(res, result, 'Auditor assigned');
    } catch (error) { next(error); }
  }

  async randomAssign(req: Request, res: Response, next: NextFunction) {
    try {
      const { chpiCode } = req.body;
      const result = await service.randomAssign(chpiCode);
      sendSuccess(res, result, 'Auditor randomly assigned');
    } catch (error) { next(error); }
  }

  async performance(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.params.code as string;
      const result = await service.getAuditorPerformance(code);
      sendSuccess(res, result, 'Auditor performance');
    } catch (error) { next(error); }
  }
}

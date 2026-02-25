import { Request, Response, NextFunction } from 'express';
import { SupervisorAssignmentService } from './supervisor-assignment.service';
import { parsePagination } from '../../common/utils/pagination';
import { sendSuccess, sendError } from '../../common/utils/response';

const service = new SupervisorAssignmentService();

export class SupervisorAssignmentController {
  async listAuditors(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await service.listAuditors();
      sendSuccess(res, data, 'Auditor list');
    } catch (error) {
      next(error);
    }
  }

  async getCompletedSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.params.code as string;
      const data = await service.getCompletedSessions(code);
      sendSuccess(res, data, 'Completed sessions');
    } catch (error) {
      next(error);
    }
  }

  async assign(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.assign(req.body);
      sendSuccess(res, result, 'Supervisor assigned', 200);
    } catch (error: any) {
      if (error.statusCode) sendError(res, error.message, error.statusCode);
      else next(error);
    }
  }

  async listAssignments(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePagination(req.query);
      const result = await service.listAssignments(page, limit);
      sendSuccess(res, result.data, 'Supervisor assignments');
    } catch (error) {
      next(error);
    }
  }
}

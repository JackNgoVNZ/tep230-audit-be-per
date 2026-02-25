import { Request, Response, NextFunction } from 'express';
import { AuditorAssignmentService } from './auditor-assignment.service';
import { parsePagination } from '../../common/utils/pagination';
import { sendSuccess, sendError } from '../../common/utils/response';

const service = new AuditorAssignmentService();

export class AuditorAssignmentController {
  async listAuditors(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePagination(req.query);
      const result = await service.listAuditors(page, limit);
      sendSuccess(res, result.data, 'Auditors list', 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async assign(req: Request, res: Response, next: NextFunction) {
    try {
      const { chpi_code, auditor_usi_code } = req.body;
      const result = await service.assignAuditor(chpi_code, auditor_usi_code);
      sendSuccess(res, result, 'Auditor assigned');
    } catch (error: any) {
      if (error.statusCode) {
        sendError(res, error.message, error.statusCode);
      } else {
        next(error);
      }
    }
  }

  async randomAssign(req: Request, res: Response, next: NextFunction) {
    try {
      const { chpi_codes } = req.body;
      const result = await service.randomAssign(chpi_codes);
      sendSuccess(res, result, 'Random assignment completed');
    } catch (error: any) {
      if (error.statusCode) {
        sendError(res, error.message, error.statusCode);
      } else {
        next(error);
      }
    }
  }

  async searchAuditors(req: Request, res: Response, next: NextFunction) {
    try {
      const q = (req.query.q as string) || '';
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const result = await service.searchAuditors(q, limit);
      sendSuccess(res, result, 'Auditor search results');
    } catch (error) {
      next(error);
    }
  }

  async unassign(req: Request, res: Response, next: NextFunction) {
    try {
      const { chpi_code } = req.body;
      const result = await service.unassignAuditor(chpi_code);
      sendSuccess(res, result, 'Auditor unassigned');
    } catch (error: any) {
      if (error.statusCode) {
        sendError(res, error.message, error.statusCode);
      } else {
        next(error);
      }
    }
  }

  async assignOnboard(req: Request, res: Response, next: NextFunction) {
    try {
      const { usi_code, auditor_usi_code, cuie_code } = req.body;
      const result = await service.assignOnboard(usi_code, auditor_usi_code, cuie_code);
      sendSuccess(res, result, 'Onboard auditor assigned');
    } catch (error: any) {
      if (error.statusCode) {
        sendError(res, error.message, error.statusCode);
      } else {
        next(error);
      }
    }
  }

  async performance(req: Request, res: Response, next: NextFunction) {
    try {
      const chriCode = req.params.chriCode as string;
      const result = await service.getPerformance(chriCode);
      sendSuccess(res, result, 'Auditor performance');
    } catch (error) {
      next(error);
    }
  }
}

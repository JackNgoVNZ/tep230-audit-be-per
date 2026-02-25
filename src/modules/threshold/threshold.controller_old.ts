import { Request, Response, NextFunction } from 'express';
import { ThresholdService } from './threshold.service';
import { sendSuccess } from '../../common/utils/response';

const service = new ThresholdService();

export class ThresholdController {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.listThresholds();
      sendSuccess(res, result, 'Threshold configs');
    } catch (error) { next(error); }
  }

  async getByAuditType(req: Request, res: Response, next: NextFunction) {
    try {
      const auditType = req.params.auditType as string;
      const result = await service.getByAuditType(auditType);
      sendSuccess(res, result, 'Threshold configs for audit type');
    } catch (error) { next(error); }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id as string, 10);
      const result = await service.updateThreshold(id, req.body);
      sendSuccess(res, result, 'Threshold config updated');
    } catch (error) { next(error); }
  }
}

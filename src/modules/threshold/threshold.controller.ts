import { Request, Response, NextFunction } from 'express';
import { ThresholdService } from './threshold.service';
import { sendSuccess } from '../../common/utils/response';

const service = new ThresholdService();

export class ThresholdController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const auditType = req.query.auditType as string | undefined;
      const data = await service.listAll(auditType);
      sendSuccess(res, data, 'Threshold configs');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid id' });
        return;
      }
      const result = await service.updateById(id, req.body);
      if (!result) {
        res.status(404).json({ success: false, message: 'Threshold config not found' });
        return;
      }
      sendSuccess(res, result, 'Threshold config updated');
    } catch (error) {
      next(error);
    }
  }
}

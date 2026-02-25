import { Request, Response, NextFunction } from 'express';
import { syncOnboardGv } from '../../jobs/sync-onboard-gv.job';

export class JobsController {
  async triggerSyncOnboardGv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { dateFrom, dateTo } = req.body as { dateFrom?: string; dateTo?: string };
      const result = await syncOnboardGv({ dateFrom, dateTo });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

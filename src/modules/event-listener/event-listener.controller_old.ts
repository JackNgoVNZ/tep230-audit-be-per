import { Request, Response, NextFunction } from 'express';
import { EventListenerService } from './event-listener.service';
import { sendSuccess } from '../../common/utils/response';
import { parsePagination, buildPaginationMeta } from '../../common/utils/pagination';

const service = new EventListenerService();

export class EventListenerController {
  async recentEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePagination(req.query);
      const eventType = req.query.eventType as string | undefined;
      const result = await service.getRecentEvents(page, limit, eventType);
      sendSuccess(res, result.data, 'Recent CUIE events', 200, buildPaginationMeta(result.total, page, limit));
    } catch (error) { next(error); }
  }

  async pollEvents(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.pollEvents();
      sendSuccess(res, result, 'CUIE events polled');
    } catch (error) { next(error); }
  }
}

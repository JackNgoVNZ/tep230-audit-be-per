import { Request, Response, NextFunction } from 'express';
import { NotificationService } from './notification.service';
import { sendSuccess } from '../../common/utils/response';
import { parsePagination, buildPaginationMeta } from '../../common/utils/pagination';

const service = new NotificationService();

export class NotificationController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePagination(req.query);
      const result = await service.listNotifications(req.user!.code, page, limit);
      sendSuccess(res, result.data, 'Notifications', 200, buildPaginationMeta(result.total, page, limit));
    } catch (error) { next(error); }
  }

  async markRead(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id as string, 10);
      const result = await service.markAsRead(id, req.user!.code);
      sendSuccess(res, result, 'Notification marked as read');
    } catch (error) { next(error); }
  }
}

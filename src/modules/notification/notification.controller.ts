import { Request, Response, NextFunction } from 'express';
import { NotificationService } from './notification.service';
import { sendSuccess, sendError } from '../../common/utils/response';

const service = new NotificationService();

export class NotificationController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.listNotifications(req.user!.usi_code);
      sendSuccess(res, result, 'Notifications');
    } catch (error: any) {
      if (error.statusCode) { sendError(res, error.message, error.statusCode); }
      else { next(error); }
    }
  }

  async markRead(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id as string, 10);
      const result = await service.markAsRead(id);
      sendSuccess(res, result, 'Notification marked as read');
    } catch (error: any) {
      if (error.statusCode) { sendError(res, error.message, error.statusCode); }
      else { next(error); }
    }
  }
}

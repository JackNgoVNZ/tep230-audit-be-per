import { Request, Response, NextFunction } from 'express';
import { EmailService } from './email.service';
import { sendSuccess } from '../../common/utils/response';

const service = new EmailService();

export class EmailController {
  async send(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.sendEmail(req.body);
      sendSuccess(res, result, 'Email sent');
    } catch (error) { next(error); }
  }

  async listTemplates(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.listTemplates();
      sendSuccess(res, result, 'Email templates');
    } catch (error) { next(error); }
  }

  async createTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.createTemplate(req.body);
      sendSuccess(res, result, 'Email template created', 201);
    } catch (error) { next(error); }
  }

  async updateTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id as string, 10);
      const result = await service.updateTemplate(id, req.body);
      sendSuccess(res, result, 'Email template updated');
    } catch (error) { next(error); }
  }
}

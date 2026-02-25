import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service';
import { sendSuccess } from '../../common/utils/response';
import { parsePagination, buildPaginationMeta } from '../../common/utils/pagination';

const service = new UserService();

export class UserController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, search } = parsePagination(req.query);
      const role = req.query.role as string | undefined;
      const result = await service.listUsers(page, limit, role, search);
      sendSuccess(res, result.data, 'Users list', 200, buildPaginationMeta(result.total, page, limit));
    } catch (error) { next(error); }
  }

  async detail(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.params.code as string;
      const result = await service.getUserDetail(code);
      sendSuccess(res, result, 'User detail');
    } catch (error) { next(error); }
  }

  async auditHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePagination(req.query);
      const code = req.params.code as string;
      const result = await service.getUserAuditHistory(code, page, limit);
      sendSuccess(res, result.data, 'User audit history', 200, buildPaginationMeta(result.total, page, limit));
    } catch (error) { next(error); }
  }

  async stats(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.params.code as string;
      const result = await service.getUserStats(code);
      sendSuccess(res, result, 'User statistics');
    } catch (error) { next(error); }
  }
}

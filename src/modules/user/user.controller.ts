import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service';
import { sendSuccess, sendError } from '../../common/utils/response';
import { parsePagination, buildPaginationMeta } from '../../common/utils/pagination';

const service = new UserService();

export class UserController {
  async lookup(req: Request, res: Response, next: NextFunction) {
    try {
      const username = req.params.username as string;
      const result = await service.lookupByUsername(username);
      if (!result) {
        res.json({ success: true, data: null, message: 'User not found' });
        return;
      }
      sendSuccess(res, result, 'User found');
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePagination(req.query);
      const myust = req.query.myust as string | undefined;
      const keyword = req.query.keyword as string | undefined;
      const active = req.query.active as string | undefined;

      const result = await service.listUsers(page, limit, { myust, keyword, active });
      sendSuccess(res, result.data, 'Users list', 200, buildPaginationMeta(result.total, page, limit));
    } catch (error) {
      next(error);
    }
  }

  async detail(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.params.code as string;
      const result = await service.getByCode(code);
      if (!result) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }
      sendSuccess(res, result, 'User detail');
    } catch (error) {
      next(error);
    }
  }

  async auditHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.params.code as string;
      const { page, limit } = parsePagination(req.query);
      const type = req.query.type as string | undefined;

      const result = await service.getAuditHistory(code, page, limit, type);
      sendSuccess(res, result.data, 'Audit history', 200, buildPaginationMeta(result.total, page, limit));
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.createUser(req.body);
      sendSuccess(res, result, 'User created', 201);
    } catch (error: any) {
      if (error.statusCode) {
        sendError(res, error.message, error.statusCode);
      } else {
        next(error);
      }
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.params.code as string;
      const result = await service.updateUser(code, req.body);
      sendSuccess(res, result, 'User updated');
    } catch (error: any) {
      if (error.statusCode) {
        sendError(res, error.message, error.statusCode);
      } else {
        next(error);
      }
    }
  }

  async unpublish(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.params.code as string;
      const result = await service.unpublishUsid(code);
      sendSuccess(res, result, 'USID unpublished');
    } catch (error: any) {
      if (error.statusCode) {
        sendError(res, error.message, error.statusCode);
      } else {
        next(error);
      }
    }
  }

  async publish(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.params.code as string;
      const result = await service.publishUsid(code);
      sendSuccess(res, result, 'USID published');
    } catch (error: any) {
      if (error.statusCode) {
        sendError(res, error.message, error.statusCode);
      } else {
        next(error);
      }
    }
  }
}

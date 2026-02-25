import { Request, Response, NextFunction } from 'express';
import { SettingsService } from './settings.service';
import { sendSuccess, sendError } from '../../common/utils/response';
import { parsePagination, buildPaginationMeta } from '../../common/utils/pagination';

const service = new SettingsService();

export class SettingsController {
  async chptFilterOptions(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.getChptFilterOptions();
      sendSuccess(res, result, 'Filter options');
    } catch (error) {
      next(error);
    }
  }

  async listChpt(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePagination(req.query);
      const mypt = req.query.mypt as string | undefined;
      const mygg = req.query.mygg as string | undefined;
      const mylcp = req.query.mylcp as string | undefined;
      const mylcet = req.query.mylcet as string | undefined;
      const published = req.query.published as string | undefined;
      const result = await service.listChpt(page, limit, { mypt, mygg, mylcp, mylcet, published });
      sendSuccess(res, result.data, 'Process templates', 200, buildPaginationMeta(result.total, page, limit));
    } catch (error) {
      next(error);
    }
  }

  async createChpt(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.createChpt(req.body);
      sendSuccess(res, result, 'CHPT created', 201);
    } catch (error: any) {
      if (error.statusCode) { sendError(res, error.message, error.statusCode); } else { next(error); }
    }
  }

  async updateChpt(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.params.code as string;
      const result = await service.updateChpt(code, req.body);
      sendSuccess(res, result, 'CHPT updated');
    } catch (error: any) {
      if (error.statusCode) { sendError(res, error.message, error.statusCode); } else { next(error); }
    }
  }

  async unpublishChpt(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.params.code as string;
      const result = await service.unpublishChpt(code);
      sendSuccess(res, result, 'CHPT unpublished');
    } catch (error: any) {
      if (error.statusCode) { sendError(res, error.message, error.statusCode); } else { next(error); }
    }
  }

  async publishChpt(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.params.code as string;
      const result = await service.publishChpt(code);
      sendSuccess(res, result, 'CHPT published');
    } catch (error: any) {
      if (error.statusCode) { sendError(res, error.message, error.statusCode); } else { next(error); }
    }
  }

  async existingChptByPt(req: Request, res: Response, next: NextFunction) {
    try {
      const pt = req.params.pt as string;
      const result = await service.getExistingChptByPt(pt);
      sendSuccess(res, result, 'Existing CHPTs for PT');
    } catch (error) {
      next(error);
    }
  }

  async batchCreateChpt(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.batchCreateChpt(req.body);
      sendSuccess(res, result, `${result.created} CHPTs created`, 201);
    } catch (error: any) {
      if (error.statusCode) { sendError(res, error.message, error.statusCode); } else { next(error); }
    }
  }

  async listChst(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePagination(req.query);
      const chptCode = req.query.chptCode as string | undefined;
      const result = await service.listChst(page, limit, chptCode);
      sendSuccess(res, result.data, 'Step templates', 200, buildPaginationMeta(result.total, page, limit));
    } catch (error) {
      next(error);
    }
  }

  async createChst(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.createChst(req.body);
      sendSuccess(res, result, 'CHST created', 201);
    } catch (error: any) {
      if (error.statusCode) { sendError(res, error.message, error.statusCode); } else { next(error); }
    }
  }

  async updateChst(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.params.code as string;
      const result = await service.updateChst(code, req.body);
      sendSuccess(res, result, 'CHST updated');
    } catch (error: any) {
      if (error.statusCode) { sendError(res, error.message, error.statusCode); } else { next(error); }
    }
  }

  async unpublishChst(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.params.code as string;
      const result = await service.unpublishChst(code);
      sendSuccess(res, result, 'CHST unpublished');
    } catch (error: any) {
      if (error.statusCode) { sendError(res, error.message, error.statusCode); } else { next(error); }
    }
  }

  async publishChst(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.params.code as string;
      const result = await service.publishChst(code);
      sendSuccess(res, result, 'CHST published');
    } catch (error: any) {
      if (error.statusCode) { sendError(res, error.message, error.statusCode); } else { next(error); }
    }
  }

  async listChlt(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePagination(req.query);
      const chstCode = req.query.chstCode as string | undefined;
      const result = await service.listChlt(page, limit, chstCode);
      sendSuccess(res, result.data, 'Checklist templates', 200, buildPaginationMeta(result.total, page, limit));
    } catch (error) {
      next(error);
    }
  }

  async createChlt(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.createChlt(req.body);
      sendSuccess(res, result, 'CHLT created', 201);
    } catch (error: any) {
      if (error.statusCode) { sendError(res, error.message, error.statusCode); } else { next(error); }
    }
  }

  async updateChlt(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.params.code as string;
      const result = await service.updateChlt(code, req.body);
      sendSuccess(res, result, 'CHLT updated');
    } catch (error: any) {
      if (error.statusCode) { sendError(res, error.message, error.statusCode); } else { next(error); }
    }
  }

  async unpublishChlt(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.params.code as string;
      const result = await service.unpublishChlt(code);
      sendSuccess(res, result, 'CHLT unpublished');
    } catch (error: any) {
      if (error.statusCode) { sendError(res, error.message, error.statusCode); } else { next(error); }
    }
  }

  async publishChlt(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.params.code as string;
      const result = await service.publishChlt(code);
      sendSuccess(res, result, 'CHLT published');
    } catch (error: any) {
      if (error.statusCode) { sendError(res, error.message, error.statusCode); } else { next(error); }
    }
  }
}

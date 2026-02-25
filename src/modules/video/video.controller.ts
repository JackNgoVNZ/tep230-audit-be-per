import { Request, Response, NextFunction } from 'express';
import { VideoService } from './video.service';
import { sendSuccess, sendError } from '../../common/utils/response';

const service = new VideoService();

export class VideoController {
  async getBySession(req: Request, res: Response, next: NextFunction) {
    try {
      const chpiCode = req.params.chpiCode as string;
      const result = await service.getVideoBySession(chpiCode);
      sendSuccess(res, result, 'Video data for session');
    } catch (error: any) {
      if (error.statusCode) { sendError(res, error.message, error.statusCode); }
      else { next(error); }
    }
  }

  async getByCuie(req: Request, res: Response, next: NextFunction) {
    try {
      const cuieCode = req.params.cuieCode as string;
      const result = await service.getVideoByCuie(cuieCode);
      sendSuccess(res, result, 'Video data for CUIE event');
    } catch (error: any) {
      if (error.statusCode) { sendError(res, error.message, error.statusCode); }
      else { next(error); }
    }
  }
}

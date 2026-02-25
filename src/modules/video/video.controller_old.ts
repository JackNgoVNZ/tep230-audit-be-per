import { Request, Response, NextFunction } from 'express';
import { VideoService } from './video.service';
import { sendSuccess } from '../../common/utils/response';

const service = new VideoService();

export class VideoController {
  async getByCuie(req: Request, res: Response, next: NextFunction) {
    try {
      const cuieCode = req.params.cuieCode as string;
      const result = await service.getVideoByCuie(cuieCode);
      sendSuccess(res, result, 'Video data for CUIE event');
    } catch (error) { next(error); }
  }

  async getBySession(req: Request, res: Response, next: NextFunction) {
    try {
      const chpiCode = req.params.chpiCode as string;
      const result = await service.getVideoBySession(chpiCode);
      sendSuccess(res, result, 'Video data for audit session');
    } catch (error) { next(error); }
  }

  async sync(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.syncVideoData();
      sendSuccess(res, result, 'Video sync triggered');
    } catch (error) { next(error); }
  }
}

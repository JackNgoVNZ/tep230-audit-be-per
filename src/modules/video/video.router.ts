import { Router } from 'express';
import { VideoController } from './video.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roles } from '../../middleware/roles.middleware';

const router = Router();
const controller = new VideoController();

router.use(authMiddleware);

router.get('/by-session/:chpiCode', roles(['AD', 'TO', 'QS', 'QA']), (req, res, next) => controller.getBySession(req, res, next));
router.get('/by-cuie/:cuieCode', roles(['AD', 'TO', 'QS', 'QA']), (req, res, next) => controller.getByCuie(req, res, next));

export default router;

import { Router } from 'express';
import { VideoController } from './video.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roles } from '../../middleware/roles.middleware';

const router = Router();
const controller = new VideoController();

router.use(authMiddleware);

router.get('/by-cuie/:cuieCode', roles(['AD', 'TO', 'QS', 'QA']), controller.getByCuie);
router.get('/by-session/:chpiCode', roles(['AD', 'TO', 'QS', 'QA']), controller.getBySession);
router.post('/sync', roles(['AD', 'TO']), controller.sync);

export default router;

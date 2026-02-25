import { Router } from 'express';
import { ScoringController } from './scoring.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roles } from '../../middleware/roles.middleware';

const router = Router();
const controller = new ScoringController();

router.use(authMiddleware);

router.post('/calculate/:chpiCode', roles(['AD', 'TO', 'QS', 'QA']), controller.calculate);
router.post('/check-threshold/:chpiCode', roles(['AD', 'TO', 'QS', 'QA']), controller.checkThreshold);
router.post('/complete/:chpiCode', roles(['AD', 'TO', 'QS', 'QA']), controller.complete);

export default router;

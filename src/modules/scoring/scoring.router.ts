import { Router } from 'express';
import { ScoringController } from './scoring.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roles } from '../../middleware/roles.middleware';

const router = Router();
const controller = new ScoringController();

router.use(authMiddleware);

router.post('/calculate/:chpiCode', roles(['AD', 'TO', 'QS', 'QA']), (req, res, next) => controller.calculate(req, res, next));

router.post('/complete/:chpiCode', roles(['AD', 'TO', 'QS', 'QA']), (req, res, next) => controller.complete(req, res, next));

export default router;

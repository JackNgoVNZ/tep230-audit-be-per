import { Router } from 'express';
import { AuditStepController } from './audit-step.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roles } from '../../middleware/roles.middleware';

const router = Router();
const controller = new AuditStepController();

router.use(authMiddleware);

router.post('/:code/start', roles(['AD', 'TO', 'QS', 'QA']), (req, res, next) => controller.start(req, res, next));

router.post('/:code/complete', roles(['AD', 'TO', 'QS', 'QA']), (req, res, next) => controller.complete(req, res, next));

export default router;

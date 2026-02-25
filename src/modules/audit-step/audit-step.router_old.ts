import { Router } from 'express';
import { AuditStepController } from './audit-step.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roles } from '../../middleware/roles.middleware';

const router = Router();
const controller = new AuditStepController();

router.use(authMiddleware);

router.get('/', roles(['AD', 'TO', 'QS', 'QA']), controller.list);
router.get('/:code', roles(['AD', 'TO', 'QS', 'QA']), controller.detail);
router.post('/:code/start', roles(['AD', 'TO', 'QS', 'QA']), controller.start);
router.post('/:code/complete', roles(['AD', 'TO', 'QS', 'QA']), controller.complete);

export default router;

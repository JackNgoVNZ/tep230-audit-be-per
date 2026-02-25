import { Router } from 'express';
import { UserController } from './user.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roles } from '../../middleware/roles.middleware';

const router = Router();
const controller = new UserController();

router.use(authMiddleware);

router.get('/', roles(['AD', 'TO', 'QS', 'QA']), controller.list);
router.get('/:code', roles(['AD', 'TO', 'QS', 'QA']), controller.detail);
router.get('/:code/audit-history', roles(['AD', 'TO', 'QS', 'QA']), controller.auditHistory);
router.get('/:code/stats', roles(['AD', 'TO', 'QS', 'QA']), controller.stats);

export default router;

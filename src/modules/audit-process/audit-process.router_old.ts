import { Router } from 'express';
import { AuditProcessController } from './audit-process.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roles } from '../../middleware/roles.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createAuditProcessSchema, assignAuditProcessSchema } from './audit-process.schema';

const router = Router();
const controller = new AuditProcessController();

router.use(authMiddleware);

router.post('/', roles(['AD', 'TO', 'QS']), validate(createAuditProcessSchema), controller.create);
router.get('/', roles(['AD', 'TO', 'QS', 'QA']), controller.list);
router.get('/:code', roles(['AD', 'TO', 'QS', 'QA']), controller.detail);
router.post('/:code/assign', roles(['AD', 'TO', 'QS']), validate(assignAuditProcessSchema), controller.assign);
router.post('/:code/cancel', roles(['AD', 'TO']), controller.cancel);

export default router;

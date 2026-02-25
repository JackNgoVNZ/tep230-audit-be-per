import { Router } from 'express';
import { ChecklistController } from './checklist.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roles } from '../../middleware/roles.middleware';
import { validate } from '../../middleware/validate.middleware';
import { batchUpdateSchema } from './checklist.schema';

const router = Router();
const controller = new ChecklistController();

router.use(authMiddleware);

router.get('/', roles(['AD', 'TO', 'QS', 'QA']), (req, res, next) => controller.list(req, res, next));

router.put('/batch', roles(['AD', 'TO', 'QS', 'QA']), validate(batchUpdateSchema), (req, res, next) => controller.batchUpdate(req, res, next));

export default router;

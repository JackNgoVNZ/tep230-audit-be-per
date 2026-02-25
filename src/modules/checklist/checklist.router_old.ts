import { Router } from 'express';
import { ChecklistController } from './checklist.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roles } from '../../middleware/roles.middleware';
import { validate } from '../../middleware/validate.middleware';
import { batchUpdateSchema, updateChecklistSchema } from './checklist.schema';

const router = Router();
const controller = new ChecklistController();

router.use(authMiddleware);

router.get('/', roles(['AD', 'TO', 'QS', 'QA']), controller.list);
router.put('/batch', roles(['AD', 'TO', 'QS', 'QA']), validate(batchUpdateSchema), controller.batchUpdate);
router.put('/:code', roles(['AD', 'TO', 'QS', 'QA']), validate(updateChecklistSchema), controller.updateSingle);

export default router;

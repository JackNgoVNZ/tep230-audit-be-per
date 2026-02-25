import { Router } from 'express';
import { AuditorAssignmentController } from './auditor-assignment.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roles } from '../../middleware/roles.middleware';
import { validate } from '../../middleware/validate.middleware';
import { assignAuditorSchema, randomAssignSchema } from './auditor-assignment.schema';

const router = Router();
const controller = new AuditorAssignmentController();

router.use(authMiddleware);

router.get('/', roles(['AD', 'TO', 'QS']), controller.listAuditors);
router.post('/assign', roles(['AD', 'TO', 'QS']), validate(assignAuditorSchema), controller.assign);
router.post('/random-assign', roles(['AD', 'TO', 'QS']), validate(randomAssignSchema), controller.randomAssign);
router.get('/:code/performance', roles(['AD', 'TO', 'QS']), controller.performance);

export default router;

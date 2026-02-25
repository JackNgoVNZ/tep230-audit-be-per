import { Router } from 'express';
import { SupervisorAssignmentController } from './supervisor-assignment.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roles } from '../../middleware/roles.middleware';
import { validate } from '../../middleware/validate.middleware';
import { assignSupervisorSchema } from './supervisor-assignment.schema';

const router = Router();
const controller = new SupervisorAssignmentController();

router.use(authMiddleware);

router.get('/auditors', roles(['AD', 'TO']), (req, res, next) => controller.listAuditors(req, res, next));
router.get('/auditor/:code/completed-sessions', roles(['AD', 'TO']), (req, res, next) => controller.getCompletedSessions(req, res, next));
router.post('/assign', roles(['AD', 'TO']), validate(assignSupervisorSchema), (req, res, next) => controller.assign(req, res, next));
router.get('/', roles(['AD', 'TO']), (req, res, next) => controller.listAssignments(req, res, next));

export default router;

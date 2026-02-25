import { Router } from 'express';
import { AuditorAssignmentController } from './auditor-assignment.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roles } from '../../middleware/roles.middleware';
import { validate } from '../../middleware/validate.middleware';
import { assignAuditorSchema, randomAssignSchema, unassignAuditorSchema, assignOnboardSchema } from './auditor-assignment.schema';

const router = Router();
const controller = new AuditorAssignmentController();

router.use(authMiddleware);

router.get('/', roles(['AD', 'TO', 'QS']), (req, res, next) => controller.listAuditors(req, res, next));

router.get('/search', roles(['AD', 'TO', 'QS']), (req, res, next) => controller.searchAuditors(req, res, next));

router.get('/:chriCode/performance', roles(['AD', 'TO', 'QS']), (req, res, next) => controller.performance(req, res, next));

router.post('/assign', roles(['AD', 'TO', 'QS']), validate(assignAuditorSchema), (req, res, next) => controller.assign(req, res, next));

router.post('/assign-onboard', roles(['AD', 'TO', 'QS']), validate(assignOnboardSchema), (req, res, next) => controller.assignOnboard(req, res, next));

router.post('/unassign', roles(['AD', 'TO', 'QS']), validate(unassignAuditorSchema), (req, res, next) => controller.unassign(req, res, next));

router.post('/random-assign', roles(['AD', 'TO', 'QS']), validate(randomAssignSchema), (req, res, next) => controller.randomAssign(req, res, next));

export default router;

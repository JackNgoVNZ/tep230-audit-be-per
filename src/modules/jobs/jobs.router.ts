import { Router } from 'express';
import { JobsController } from './jobs.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roles } from '../../middleware/roles.middleware';

const router = Router();
const controller = new JobsController();

router.use(authMiddleware);

router.post('/sync-onboard-gv', roles(['AD', 'TO']), (req, res, next) => controller.triggerSyncOnboardGv(req, res, next));

export default router;

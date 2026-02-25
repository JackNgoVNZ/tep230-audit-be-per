import { Router } from 'express';
import { SettingsController } from './settings.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roles } from '../../middleware/roles.middleware';

const router = Router();
const controller = new SettingsController();

router.use(authMiddleware);
router.use(roles(['AD', 'TO', 'QS']));

router.get('/chlt', controller.listChecklistTemplates);
router.get('/chpt', controller.listProcessTemplates);
router.get('/chst', controller.listStepTemplates);

export default router;

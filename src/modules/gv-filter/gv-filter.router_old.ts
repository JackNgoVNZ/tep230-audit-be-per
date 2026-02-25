import { Router } from 'express';
import { GvFilterController } from './gv-filter.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roles } from '../../middleware/roles.middleware';

const router = Router();
const controller = new GvFilterController();

router.use(authMiddleware);
router.use(roles(['AD', 'TO', 'QS', 'QA']));

router.get('/onboard', controller.filterOnboard);
router.get('/hotcase', controller.filterHotcase);
router.get('/weekly', controller.filterWeekly);
router.get('/monthly', controller.filterMonthly);

export default router;

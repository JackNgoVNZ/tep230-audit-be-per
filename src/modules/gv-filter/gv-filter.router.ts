import { Router } from 'express';
import { GvFilterController } from './gv-filter.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roles } from '../../middleware/roles.middleware';

const router = Router();
const controller = new GvFilterController();

router.use(authMiddleware);

router.get('/current-periods', roles(['AD', 'TO', 'QS', 'QA']), (req, res, next) => controller.getCurrentPeriods(req, res, next));
router.get('/onboard', roles(['AD', 'TO', 'QS', 'QA']), (req, res, next) => controller.filterOnboard(req, res, next));
router.get('/onboard/filter-options', roles(['AD', 'TO', 'QS', 'QA']), (req, res, next) => controller.getOnboardFilterOptions(req, res, next));
router.get('/hotcase', roles(['AD', 'TO', 'QS', 'QA']), (req, res, next) => controller.filterHotcase(req, res, next));
router.get('/weekly', roles(['AD', 'TO', 'QS', 'QA']), (req, res, next) => controller.filterWeekly(req, res, next));
router.get('/monthly', roles(['AD', 'TO', 'QS', 'QA']), (req, res, next) => controller.filterMonthly(req, res, next));
router.get('/retraining', roles(['AD', 'TO', 'QS', 'QA']), (req, res, next) => controller.filterRetraining(req, res, next));

export default router;

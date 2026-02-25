import { Router } from 'express';
import { SettingsController } from './settings.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roles } from '../../middleware/roles.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createChptSchema, updateChptSchema, batchCreateChptSchema, createChstSchema, updateChstSchema, createChltSchema, updateChltSchema } from './settings.schema';

const router = Router();
const controller = new SettingsController();

router.use(authMiddleware);

// CHPT routes
router.get('/chpt/filter-options', roles(['AD', 'TO', 'QS']), (req, res, next) => controller.chptFilterOptions(req, res, next));
router.get('/chpt', roles(['AD', 'TO', 'QS']), (req, res, next) => controller.listChpt(req, res, next));
router.post('/chpt', roles(['AD', 'TO']), validate(createChptSchema), (req, res, next) => controller.createChpt(req, res, next));
router.put('/chpt/:code', roles(['AD', 'TO']), validate(updateChptSchema), (req, res, next) => controller.updateChpt(req, res, next));
router.patch('/chpt/:code/unpublish', roles(['AD', 'TO']), (req, res, next) => controller.unpublishChpt(req, res, next));
router.patch('/chpt/:code/publish', roles(['AD', 'TO']), (req, res, next) => controller.publishChpt(req, res, next));
router.get('/chpt/existing/:pt', roles(['AD', 'TO']), (req, res, next) => controller.existingChptByPt(req, res, next));
router.post('/chpt/batch', roles(['AD', 'TO']), validate(batchCreateChptSchema), (req, res, next) => controller.batchCreateChpt(req, res, next));

// CHST routes
router.get('/chst', roles(['AD', 'TO', 'QS']), (req, res, next) => controller.listChst(req, res, next));
router.post('/chst', roles(['AD', 'TO']), validate(createChstSchema), (req, res, next) => controller.createChst(req, res, next));
router.put('/chst/:code', roles(['AD', 'TO']), validate(updateChstSchema), (req, res, next) => controller.updateChst(req, res, next));
router.patch('/chst/:code/unpublish', roles(['AD', 'TO']), (req, res, next) => controller.unpublishChst(req, res, next));
router.patch('/chst/:code/publish', roles(['AD', 'TO']), (req, res, next) => controller.publishChst(req, res, next));

// CHLT routes
router.get('/chlt', roles(['AD', 'TO', 'QS']), (req, res, next) => controller.listChlt(req, res, next));
router.post('/chlt', roles(['AD', 'TO']), validate(createChltSchema), (req, res, next) => controller.createChlt(req, res, next));
router.put('/chlt/:code', roles(['AD', 'TO']), validate(updateChltSchema), (req, res, next) => controller.updateChlt(req, res, next));
router.patch('/chlt/:code/unpublish', roles(['AD', 'TO']), (req, res, next) => controller.unpublishChlt(req, res, next));
router.patch('/chlt/:code/publish', roles(['AD', 'TO']), (req, res, next) => controller.publishChlt(req, res, next));

export default router;

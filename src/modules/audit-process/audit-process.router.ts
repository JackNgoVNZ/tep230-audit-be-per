import { Router } from 'express';
import { AuditProcessController } from './audit-process.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roles } from '../../middleware/roles.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createAuditProcessSchema } from './audit-process.schema';

const router = Router();
const controller = new AuditProcessController();

router.use(authMiddleware);

router.get('/', roles(['AD', 'TO', 'QS', 'QA']), (req, res, next) => controller.list(req, res, next));

router.get('/filter-options', roles(['AD', 'TO', 'QS', 'QA']), (req, res, next) => controller.getFilterOptions(req, res, next));

router.post('/', roles(['AD', 'TO', 'QS']), validate(createAuditProcessSchema), (req, res, next) => controller.create(req, res, next));

router.get('/history', roles(['AD', 'TO', 'QS', 'QA']), (req, res, next) => controller.getHistory(req, res, next));

router.patch('/:code/start', roles(['AD', 'TO', 'QS']), (req, res, next) => controller.start(req, res, next));

router.get('/:code', roles(['AD', 'TO', 'QS', 'QA']), (req, res, next) => controller.getDetail(req, res, next));

export default router;

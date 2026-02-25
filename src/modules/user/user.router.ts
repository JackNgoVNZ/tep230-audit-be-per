import { Router } from 'express';
import { UserController } from './user.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roles } from '../../middleware/roles.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createUserSchema, updateUserSchema } from './user.schema';

const router = Router();
const controller = new UserController();

router.use(authMiddleware);

router.get('/', roles(['AD', 'TO', 'QS', 'QA']), (req, res, next) => controller.list(req, res, next));
router.get('/lookup/:username', roles(['AD', 'TO']), (req, res, next) => controller.lookup(req, res, next));
router.post('/', roles(['AD', 'TO']), validate(createUserSchema), (req, res, next) => controller.create(req, res, next));
router.put('/:code', roles(['AD', 'TO']), validate(updateUserSchema), (req, res, next) => controller.update(req, res, next));
router.patch('/:code/unpublish', roles(['AD', 'TO']), (req, res, next) => controller.unpublish(req, res, next));
router.patch('/:code/publish', roles(['AD', 'TO']), (req, res, next) => controller.publish(req, res, next));
router.get('/:code/audit-history', roles(['AD', 'TO', 'QS', 'QA']), (req, res, next) => controller.auditHistory(req, res, next));
router.get('/:code', roles(['AD', 'TO', 'QS', 'QA']), (req, res, next) => controller.detail(req, res, next));

export default router;

import { Router } from 'express';
import { ThresholdController } from './threshold.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roles } from '../../middleware/roles.middleware';
import { validate } from '../../middleware/validate.middleware';
import { updateThresholdSchema } from './threshold.schema';

const router = Router();
const controller = new ThresholdController();

router.use(authMiddleware);

router.get('/', roles(['AD', 'TO', 'QS']), (req, res, next) => controller.list(req, res, next));
router.put('/:id', roles(['AD']), validate(updateThresholdSchema), (req, res, next) => controller.update(req, res, next));

export default router;

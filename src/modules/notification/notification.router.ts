import { Router } from 'express';
import { NotificationController } from './notification.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();
const controller = new NotificationController();

router.use(authMiddleware);

router.get('/', (req, res, next) => controller.list(req, res, next));
router.post('/mark-read/:id', (req, res, next) => controller.markRead(req, res, next));

export default router;

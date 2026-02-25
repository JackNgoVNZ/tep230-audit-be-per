import { Router } from 'express';
import { EventListenerController } from './event-listener.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roles } from '../../middleware/roles.middleware';

const router = Router();
const controller = new EventListenerController();

router.use(authMiddleware);

router.get('/recent', roles(['AD', 'TO', 'QS', 'QA']), controller.recentEvents);
router.post('/poll', roles(['AD', 'TO']), controller.pollEvents);

export default router;

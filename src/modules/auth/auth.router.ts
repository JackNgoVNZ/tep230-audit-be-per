import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validate } from '../../middleware/validate.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import { loginSchema } from './auth.schema';

const router = Router();
const controller = new AuthController();

router.post('/login', validate(loginSchema), (req, res) => controller.login(req, res));
router.get('/me', authMiddleware, (req, res) => controller.me(req, res));

export default router;

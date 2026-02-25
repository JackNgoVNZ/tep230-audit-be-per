import { Router } from 'express';
import { EmailController } from './email.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roles } from '../../middleware/roles.middleware';
import { validate } from '../../middleware/validate.middleware';
import { sendEmailSchema, createTemplateSchema, updateTemplateSchema } from './email.schema';

const router = Router();
const controller = new EmailController();

router.use(authMiddleware);

router.post('/send', roles(['AD', 'TO', 'QS']), validate(sendEmailSchema), (req, res, next) => controller.send(req, res, next));
router.get('/templates', roles(['AD', 'TO']), (req, res, next) => controller.listTemplates(req, res, next));
router.post('/templates', roles(['AD', 'TO']), validate(createTemplateSchema), (req, res, next) => controller.createTemplate(req, res, next));
router.put('/templates/:id', roles(['AD', 'TO']), validate(updateTemplateSchema), (req, res, next) => controller.updateTemplate(req, res, next));

export default router;

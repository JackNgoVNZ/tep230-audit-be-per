import { Router } from 'express';
import { EmailController } from './email.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roles } from '../../middleware/roles.middleware';
import { validate } from '../../middleware/validate.middleware';
import { sendEmailSchema, createTemplateSchema, updateTemplateSchema } from './email.schema';

const router = Router();
const controller = new EmailController();

router.use(authMiddleware);

router.post('/send', roles(['AD', 'TO', 'QS']), validate(sendEmailSchema), controller.send);
router.get('/templates', roles(['AD', 'TO']), controller.listTemplates);
router.post('/templates', roles(['AD']), validate(createTemplateSchema), controller.createTemplate);
router.put('/templates/:id', roles(['AD']), validate(updateTemplateSchema), controller.updateTemplate);

export default router;

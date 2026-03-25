import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { directController } from './direct.controller';

export const directRouter = Router();

directRouter.use(authMiddleware);

directRouter.post('/conversations', directController.getOrCreateConversation);
directRouter.get('/conversations', directController.getConversations);
directRouter.get('/conversations/:id/messages', directController.getMessages);

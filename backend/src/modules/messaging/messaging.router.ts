import { Router } from 'express';
import { messagingController } from './messaging.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

export const messagingRouter = Router();

messagingRouter.use(authMiddleware);

messagingRouter.get('/:channelId/messages', messagingController.getMessages);
messagingRouter.delete('/:channelId/messages/:messageId', messagingController.deleteMessage);

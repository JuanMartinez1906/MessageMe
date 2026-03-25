import { Response } from 'express';
import { messagingService } from './messaging.service';
import { AuthRequest } from '../../middleware/auth.middleware';

export const messagingController = {
  async getMessages(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { channelId } = req.params;
      const cursor = req.query.cursor as string | undefined;
      const messages = await messagingService.getMessages(channelId, req.userId!, cursor);
      res.json(messages);
    } catch (error: any) {
      const status = error.message.includes('not a member') ? 403 : 404;
      res.status(status).json({ message: error.message });
    }
  },

  async deleteMessage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { channelId, messageId } = req.params;
      await messagingService.deleteMessage(messageId, channelId, req.userId!);
      res.status(204).send();
    } catch (error: any) {
      const status = error.message.includes('authorized') ? 403
        : error.message.includes('not found') ? 404 : 400;
      res.status(status).json({ message: error.message });
    }
  },
};

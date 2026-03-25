import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { directService } from './direct.service';

export const directController = {
  async getOrCreateConversation(req: AuthRequest, res: Response) {
    try {
      const { participantId } = req.body;
      if (!participantId) return res.status(400).json({ error: 'participantId required' });
      if (participantId === req.userId) return res.status(400).json({ error: 'Cannot DM yourself' });

      const conversation = await directService.getOrCreateConversation(req.userId!, participantId);
      res.json(conversation);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async getConversations(req: AuthRequest, res: Response) {
    try {
      const conversations = await directService.getConversations(req.userId!);
      res.json(conversations);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async getMessages(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const cursor = req.query.cursor as string | undefined;
      const messages = await directService.getMessages(id, req.userId!, cursor);
      res.json(messages);
    } catch (err: any) {
      const status = err.message.includes('participant') ? 403 : 500;
      res.status(status).json({ error: err.message });
    }
  },
};

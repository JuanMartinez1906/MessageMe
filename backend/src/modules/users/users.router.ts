import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import { directService } from '../direct/direct.service';

export const usersRouter = Router();

usersRouter.use(authMiddleware);

usersRouter.get('/search', async (req: AuthRequest, res: Response) => {
  try {
    const q = (req.query.q as string) ?? '';
    if (q.trim().length < 1) return res.json([]);
    const users = await directService.searchUsers(q.trim(), req.userId!);
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

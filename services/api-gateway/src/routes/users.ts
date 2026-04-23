import { Router } from 'express';
import { user } from '../grpc-clients';
import { requireAuth } from '../middleware';

export const usersRouter = Router();

usersRouter.use(requireAuth());

usersRouter.get('/search', async (req, res, next) => {
  try {
    const query = (req.query.q as string) ?? '';
    const r = await user.search({ query, page: { limit: 20 } });
    res.json(
      (r.results ?? []).map((p: any) => ({
        id: p.userId,
        username: p.username,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl || null,
      }))
    );
  } catch (err) {
    next(err);
  }
});

usersRouter.patch('/me', async (req, res, next) => {
  try {
    const p = await user.updateProfile({
      userId: req.userId,
      displayName: req.body.displayName ?? '',
      avatarUrl: req.body.avatarUrl ?? '',
    });
    res.json({
      id: p.userId,
      username: p.username,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl || null,
    });
  } catch (err) {
    next(err);
  }
});

usersRouter.get('/:userId', async (req, res, next) => {
  try {
    const p = await user.getProfile({ userId: req.params.userId });
    res.json({
      id: p.userId,
      username: p.username,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl || null,
    });
  } catch (err) {
    next(err);
  }
});

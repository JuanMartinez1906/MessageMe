import { Router } from 'express';
import { auth, user } from '../grpc-clients';
import { requireAuth } from '../middleware';

export const authRouter = Router();

authRouter.post('/register', async (req, res, next) => {
  try {
    const r = await auth.register({
      email: req.body.email,
      username: req.body.username,
      password: req.body.password,
      displayName: req.body.displayName,
    });
    const profile = await user.getProfile({ userId: r.userId });
    res.status(201).json({
      user: {
        id: profile.userId,
        email: profile.email,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl || null,
      },
      accessToken: r.accessToken,
      refreshToken: r.refreshToken,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const r = await auth.login({ email: req.body.email, password: req.body.password });
    const profile = await user.getProfile({ userId: r.userId });
    res.json({
      user: {
        id: profile.userId,
        email: profile.email,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl || null,
      },
      accessToken: r.accessToken,
      refreshToken: r.refreshToken,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const r = await auth.refresh({ refreshToken: req.body.refreshToken });
    res.json({ accessToken: r.accessToken, refreshToken: r.refreshToken });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    await auth.logout({ refreshToken: req.body.refreshToken ?? '' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth(), async (req, res, next) => {
  try {
    const profile = await user.getProfile({ userId: req.userId });
    res.json({
      id: profile.userId,
      email: profile.email,
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl || null,
    });
  } catch (err) {
    next(err);
  }
});

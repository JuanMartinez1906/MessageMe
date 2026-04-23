import express from 'express';
import cors from 'cors';
import { createLogger } from '@messageme/shared';
import { config } from './config';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { groupsRouter } from './routes/groups';
import { conversationsRouter } from './routes/conversations';
import { messagesRouter } from './routes/messages';
import { presenceRouter } from './routes/presence';
import { deliveryRouter } from './routes/delivery';
import { filesRouter } from './routes/files';
import { errorHandler } from './middleware';

const log = createLogger('api-gateway');
const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/direct', conversationsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/presence', presenceRouter);
app.use('/api/delivery', deliveryRouter);
app.use('/api/files', filesRouter);

app.use(errorHandler(log));

app.listen(config.port, () => {
  log.info({ port: config.port }, 'api-gateway listening');
});

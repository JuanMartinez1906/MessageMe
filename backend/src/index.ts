import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config, isProduction } from './config';
import { authRouter } from './modules/auth/auth.router';
import { groupsRouter } from './modules/groups/groups.router';
import { messagingRouter } from './modules/messaging/messaging.router';
import { uploadRouter } from './modules/messaging/upload.router';
import { MessagingGateway } from './modules/messaging/messaging.gateway';

const app = express();
const httpServer = createServer(app);

const corsOptions = {
  origin: config.clientUrl,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

const io = new Server(httpServer, {
  cors: { origin: config.clientUrl, methods: ['GET', 'POST'] },
});

app.use(cors(corsOptions));
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// API routes
app.use('/api/auth', authRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/channels', messagingRouter);
app.use('/api/upload', uploadRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: config.nodeEnv });
});

// In production, serve the built frontend
if (isProduction) {
  const publicDir = path.join(__dirname, '../public');
  app.use(express.static(publicDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

new MessagingGateway(io);

httpServer.listen(config.port, () => {
  console.log(`Server running on port ${config.port} [${config.nodeEnv}]`);
});

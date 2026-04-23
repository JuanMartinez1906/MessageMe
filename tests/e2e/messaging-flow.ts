/**
 * End-to-end integration test for the MessageMe microservices stack.
 *
 * Prereqs: `docker compose -f infra/docker-compose.yml up -d` — wait until
 * all 12 services are healthy (`docker compose ps`).
 *
 * Flow exercised:
 *   1. Alice and Bob register + login via api-gateway (REST).
 *   2. Both connect to ws-gateway (Socket.io, JWT in handshake auth).
 *   3. Alice creates a DM conversation with Bob.
 *   4. Alice sends a TEXT message over the socket.
 *   5. Bob's socket receives `new-message` (Kafka → ws-gateway fan-out).
 *   6. Bob emits `message-delivered`.
 *   7. Alice's socket receives `message-delivered` (delivery-service → Kafka → ws-gateway).
 *
 * A successful run exercises: api-gateway → auth → user → direct → ws-gateway →
 * message-service → MongoDB → Kafka topic messages.sent → delivery-service →
 * Kafka topic messages.delivered → ws-gateway push to both users.
 */
import axios, { AxiosInstance } from 'axios';
import { io, Socket } from 'socket.io-client';
import { randomBytes } from 'crypto';

const API_URL = process.env.API_URL ?? 'http://localhost:8080/api';
const WS_URL = process.env.WS_URL ?? 'http://localhost:8081';
const LOG = !!process.env.LOG;

function log(...args: unknown[]) {
  if (LOG) console.log('[e2e]', ...args);
}

function uniqueSuffix() {
  return randomBytes(4).toString('hex');
}

interface Session {
  userId: string;
  username: string;
  accessToken: string;
  api: AxiosInstance;
  socket: Socket;
}

async function register(username: string, password: string): Promise<Session> {
  const email = `${username}@e2e.test`;
  const displayName = username;
  const { data } = await axios.post(`${API_URL}/auth/register`, {
    email,
    username,
    password,
    displayName,
  });
  log('registered', username, 'id', data.user.id);
  const api = axios.create({
    baseURL: API_URL,
    headers: { Authorization: `Bearer ${data.accessToken}` },
  });
  const socket = io(WS_URL, {
    auth: { token: data.accessToken },
    transports: ['websocket'],
    reconnection: false,
  });
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${username}: socket connect timeout`)), 10_000);
    socket.once('connect', () => {
      clearTimeout(t);
      log(username, 'socket connected', socket.id);
      resolve();
    });
    socket.once('connect_error', (err) => {
      clearTimeout(t);
      reject(new Error(`${username}: socket connect_error ${err.message}`));
    });
  });
  return {
    userId: data.user.id,
    username,
    accessToken: data.accessToken,
    api,
    socket,
  };
}

function waitForEvent<T = any>(socket: Socket, event: string, timeoutMs = 10_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`timeout waiting for '${event}' (${timeoutMs}ms)`)),
      timeoutMs
    );
    socket.once(event, (payload: T) => {
      clearTimeout(t);
      resolve(payload);
    });
  });
}

async function main() {
  const suffix = uniqueSuffix();
  const alicename = `alice_${suffix}`;
  const bobname = `bob_${suffix}`;

  console.log(`→ registering ${alicename} + ${bobname}`);
  const [alice, bob] = await Promise.all([
    register(alicename, 'Password1!'),
    register(bobname, 'Password1!'),
  ]);

  console.log('→ creating DM conversation');
  const { data: conv } = await alice.api.post('/conversations', {
    participantId: bob.userId,
  });
  log('conversation', conv.id);

  console.log('→ both join conversation room');
  alice.socket.emit('join-conversation', { conversationId: conv.id });
  bob.socket.emit('join-conversation', { conversationId: conv.id });
  await Promise.all([
    waitForEvent(alice.socket, 'joined-conversation', 5_000),
    waitForEvent(bob.socket, 'joined-conversation', 5_000),
  ]);

  console.log('→ alice sends TEXT message');
  const contentNeedle = `hola-${suffix}`;
  const bobReceives = waitForEvent<any>(bob.socket, 'new-message', 15_000);
  alice.socket.emit('send-message', {
    conversationId: conv.id,
    content: contentNeedle,
    type: 'TEXT',
  });

  const pushed = await bobReceives;
  if (pushed.content !== contentNeedle) {
    throw new Error(`bob received wrong content: ${JSON.stringify(pushed)}`);
  }
  if (pushed.senderId !== alice.userId) {
    throw new Error(`bob received wrong sender: ${pushed.senderId}`);
  }
  console.log(`✓ bob received message ${pushed.id}`);

  console.log('→ bob emits message-delivered');
  const aliceReceivesDelivered = waitForEvent<any>(alice.socket, 'message-delivered', 15_000);
  bob.socket.emit('message-delivered', { messageId: pushed.id });
  const deliveredEvt = await aliceReceivesDelivered;
  if (deliveredEvt.messageId !== pushed.id) {
    throw new Error(`alice got delivery for wrong msg: ${JSON.stringify(deliveredEvt)}`);
  }
  console.log(`✓ alice received message-delivered for ${deliveredEvt.messageId}`);

  console.log('→ cleanup');
  alice.socket.disconnect();
  bob.socket.disconnect();

  console.log('\nE2E PASSED');
}

main().catch((err) => {
  console.error('\nE2E FAILED');
  console.error(err.stack || err.message || err);
  process.exit(1);
});

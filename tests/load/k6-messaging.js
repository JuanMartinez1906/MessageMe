/**
 * k6 load test for the MessageMe api-gateway.
 *
 * Exercises the REST paths that every active user hits:
 *   - POST /api/auth/register  (setup per VU)
 *   - POST /api/auth/login     (hot path)
 *   - GET  /api/users/me       (hot path, auth-service gRPC validate + user-service profile)
 *   - GET  /api/conversations  (direct-service list)
 *
 * Reports req rate, failure rate, and http_req_duration p50/p95/p99 per endpoint.
 * The WS + Kafka path is covered by the E2E integration test (messaging-flow.ts);
 * here we validate the REST surface survives concurrent load.
 *
 * Run:
 *   brew install k6                   # once
 *   docker compose -f infra/docker-compose.yml up -d
 *   k6 run tests/load/k6-messaging.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

const API_URL = __ENV.API_URL || 'http://localhost:8080/api';

// Per-endpoint custom latency trends so the summary breaks them out by path.
const loginDuration = new Trend('login_duration', true);
const meDuration = new Trend('me_duration', true);
const conversationsDuration = new Trend('conversations_duration', true);

export const options = {
  scenarios: {
    steady: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 10 },
        { duration: '30s', target: 25 },
        { duration: '30s', target: 50 },
        { duration: '15s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<800'],
    login_duration: ['p(95)<600'],
    me_duration: ['p(95)<400'],
    conversations_duration: ['p(95)<500'],
  },
};

/** setup() runs once before the test. Pre-register a user pool VUs will pull from. */
export function setup() {
  const poolSize = 50;
  const users = [];
  for (let i = 0; i < poolSize; i++) {
    const username = `k6_${randomString(8)}`;
    const password = 'Password1!';
    const res = http.post(
      `${API_URL}/auth/register`,
      JSON.stringify({
        email: `${username}@k6.test`,
        username,
        password,
        displayName: username,
      }),
      { headers: { 'Content-Type': 'application/json' }, tags: { setup: 'register' } }
    );
    if (res.status !== 200 && res.status !== 201) {
      throw new Error(`setup register failed: ${res.status} ${res.body}`);
    }
    users.push({ username, password });
  }
  return { users };
}

export default function (data) {
  const user = data.users[(__VU - 1) % data.users.length];

  // Login
  const loginRes = http.post(
    `${API_URL}/auth/login`,
    JSON.stringify({ email: `${user.username}@k6.test`, password: user.password }),
    { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'login' } }
  );
  loginDuration.add(loginRes.timings.duration);
  const loginOk = check(loginRes, {
    'login 200': (r) => r.status === 200,
    'login has token': (r) => !!r.json('accessToken'),
  });
  if (!loginOk) {
    sleep(1);
    return;
  }
  const token = loginRes.json('accessToken');
  const authHeaders = {
    headers: { Authorization: `Bearer ${token}` },
  };

  // GET /users/me
  const meRes = http.get(`${API_URL}/users/me`, {
    ...authHeaders,
    tags: { endpoint: 'users_me' },
  });
  meDuration.add(meRes.timings.duration);
  check(meRes, { 'me 200': (r) => r.status === 200 });

  // GET /conversations
  const convRes = http.get(`${API_URL}/conversations`, {
    ...authHeaders,
    tags: { endpoint: 'conversations' },
  });
  conversationsDuration.add(convRes.timings.duration);
  check(convRes, { 'conversations 200': (r) => r.status === 200 });

  sleep(0.5 + Math.random() * 1.5);
}

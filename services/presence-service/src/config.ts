import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const config = {
  grpcHost: process.env.GRPC_HOST ?? '0.0.0.0',
  grpcPort: parseInt(process.env.GRPC_PORT ?? '50057', 10),

  redisUrl: required('REDIS_URL'),
  // TTL for a session key in Redis: if no heartbeat arrives the user is considered offline.
  presenceTtlSeconds: parseInt(process.env.PRESENCE_TTL_SECONDS ?? '90', 10),

  kafkaBrokers: (process.env.KAFKA_BROKERS ?? 'kafka:29092').split(',').map((s) => s.trim()),
  kafkaClientId: process.env.KAFKA_CLIENT_ID ?? 'presence-service',
};

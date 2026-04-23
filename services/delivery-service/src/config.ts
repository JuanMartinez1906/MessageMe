import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const config = {
  grpcHost: process.env.GRPC_HOST ?? '0.0.0.0',
  grpcPort: parseInt(process.env.GRPC_PORT ?? '50058', 10),

  mongoUrl: required('MONGO_URL'),
  mongoDb: process.env.MONGO_DB ?? 'messageme_delivery',

  redisUrl: required('REDIS_URL'),

  kafkaBrokers: (process.env.KAFKA_BROKERS ?? 'kafka:29092').split(',').map((s) => s.trim()),
  kafkaClientId: process.env.KAFKA_CLIENT_ID ?? 'delivery-service',
  kafkaGroupId: process.env.KAFKA_GROUP_ID ?? 'delivery-service-sent',
};

import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const config = {
  port: parseInt(process.env.PORT ?? '8081', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',

  authServiceAddr: process.env.AUTH_SERVICE_ADDR ?? 'localhost:50051',
  groupServiceAddr: process.env.GROUP_SERVICE_ADDR ?? 'localhost:50053',
  directServiceAddr: process.env.DIRECT_SERVICE_ADDR ?? 'localhost:50055',
  messageServiceAddr: process.env.MESSAGE_SERVICE_ADDR ?? 'localhost:50056',
  presenceServiceAddr: process.env.PRESENCE_SERVICE_ADDR ?? 'localhost:50057',
  deliveryServiceAddr: process.env.DELIVERY_SERVICE_ADDR ?? 'localhost:50058',

  kafkaBrokers: (process.env.KAFKA_BROKERS ?? 'kafka:29092').split(',').map((s) => s.trim()),
  kafkaClientId: process.env.KAFKA_CLIENT_ID ?? 'ws-gateway',
  // Fan-out consumer groups — each topic uses a unique group id so every ws-gateway
  // replica is in a dedicated group and receives all events, not a partitioned subset.
  // Per-replica group ids are configured at the consumer level in kafka-consumer.ts.
  kafkaGroupIdSent: process.env.KAFKA_GROUP_ID_SENT ?? 'ws-gateway-fanout-sent',
  kafkaGroupIdDelivered: process.env.KAFKA_GROUP_ID_DELIVERED ?? 'ws-gateway-fanout-delivered',
  kafkaGroupIdRead: process.env.KAFKA_GROUP_ID_READ ?? 'ws-gateway-fanout-read',
  kafkaGroupIdPresence: process.env.KAFKA_GROUP_ID_PRESENCE ?? 'ws-gateway-fanout-presence',
  kafkaGroupIdMediaReady: process.env.KAFKA_GROUP_ID_MEDIA_READY ?? 'ws-gateway-fanout-media-ready',

  jwtSecret: required('JWT_SECRET'),
};

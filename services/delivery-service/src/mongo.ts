import { MongoClient, Db, Collection } from 'mongodb';
import { config } from './config';

// One row per (messageId, userId) recipient. Status transitions SENT → DELIVERED → READ
// are monotonic — we never move backwards.
export type DeliveryStatus = 'SENT' | 'DELIVERED' | 'READ';

export interface DeliveryDoc {
  _id: string; // `${messageId}:${userId}` composite, lets the upserts be idempotent
  messageId: string;
  userId: string;
  senderId: string;
  channelId: string | null;
  conversationId: string | null;
  status: DeliveryStatus;
  sentAt: Date;
  deliveredAt: Date | null;
  readAt: Date | null;
  updatedAt: Date;
}

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(config.mongoUrl);
  await client.connect();
  db = client.db(config.mongoDb);
  const col = db.collection<DeliveryDoc>('delivery');
  await Promise.all([
    col.createIndex({ messageId: 1 }),
    col.createIndex({ userId: 1, channelId: 1, status: 1 }),
    col.createIndex({ userId: 1, conversationId: 1, status: 1 }),
  ]);
  return db;
}

export function deliveries(): Collection<DeliveryDoc> {
  if (!db) throw new Error('Mongo not connected');
  return db.collection<DeliveryDoc>('delivery');
}

export async function disconnectMongo(): Promise<void> {
  await client?.close();
  client = null;
  db = null;
}

import * as grpc from '@grpc/grpc-js';
import { loadProto, resolveService, grpcErrorToApp } from '@messageme/shared';
import { config } from './config';

const authPkg = loadProto('auth.proto');
const groupPkg = loadProto('group.proto');
const directPkg = loadProto('direct.proto');
const messagePkg = loadProto('message.proto');
const presencePkg = loadProto('presence.proto');
const deliveryPkg = loadProto('delivery.proto');

const AuthCtor = resolveService(authPkg, 'messageme.auth.AuthService');
const GroupCtor = resolveService(groupPkg, 'messageme.group.GroupService');
const DirectCtor = resolveService(directPkg, 'messageme.direct.DirectService');
const MessageCtor = resolveService(messagePkg, 'messageme.message.MessageService');
const PresenceCtor = resolveService(presencePkg, 'messageme.presence.PresenceService');
const DeliveryCtor = resolveService(deliveryPkg, 'messageme.delivery.DeliveryService');

const authClient = new AuthCtor(config.authServiceAddr, grpc.credentials.createInsecure()) as any;
const groupClient = new GroupCtor(config.groupServiceAddr, grpc.credentials.createInsecure()) as any;
const directClient = new DirectCtor(config.directServiceAddr, grpc.credentials.createInsecure()) as any;
const messageClient = new MessageCtor(config.messageServiceAddr, grpc.credentials.createInsecure()) as any;
const presenceClient = new PresenceCtor(config.presenceServiceAddr, grpc.credentials.createInsecure()) as any;
const deliveryClient = new DeliveryCtor(config.deliveryServiceAddr, grpc.credentials.createInsecure()) as any;

function promisify<Req, Res>(client: any, method: string): (req: Req) => Promise<Res> {
  return (req: Req) =>
    new Promise<Res>((resolve, reject) => {
      client[method](req, (err: grpc.ServiceError | null, res: Res) => {
        if (err) return reject(grpcErrorToApp(err));
        resolve(res);
      });
    });
}

export const auth = {
  validateToken: promisify<{ accessToken: string }, { userId: string; valid: boolean }>(
    authClient,
    'validateToken'
  ),
};

export const group = {
  listGroupsForUser: promisify<{ userId: string }, { groups: Array<{ groupId: string }> }>(
    groupClient,
    'listGroupsForUser'
  ),
  listMembers: promisify<
    { groupId: string },
    { members: Array<{ userId: string; role: string }> }
  >(groupClient, 'listMembers'),
};

export const direct = {
  listForUser: promisify<
    { userId: string },
    { conversations: Array<{ conversationId: string }> }
  >(directClient, 'listForUser'),
};

export const message = {
  sendMessage: promisify<
    {
      senderId: string;
      type: string;
      content: string;
      fileUrl?: string;
      channelId?: string;
      conversationId?: string;
      clientMessageId?: string;
    },
    any
  >(messageClient, 'sendMessage'),
  getHistory: promisify<
    { channelId?: string; conversationId?: string; page: { cursor?: string; limit: string } },
    { messages: any[]; pageInfo: { nextCursor: string; hasMore: boolean } }
  >(messageClient, 'getHistory'),
};

export const presence = {
  setOnline: promisify<{ userId: string; sessionId: string }, { ok: boolean }>(
    presenceClient,
    'setOnline'
  ),
  setOffline: promisify<{ userId: string; sessionId: string }, { ok: boolean }>(
    presenceClient,
    'setOffline'
  ),
  heartbeat: promisify<{ userId: string; sessionId: string }, { ok: boolean }>(
    presenceClient,
    'heartbeat'
  ),
  getPresence: promisify<
    { userIds: string[] },
    { entries: Array<{ userId: string; online: boolean; lastSeen?: any }> }
  >(presenceClient, 'getPresence'),
};

export const delivery = {
  markDelivered: promisify<{ messageId: string; userId: string }, { ok: boolean; at: any }>(
    deliveryClient,
    'markDelivered'
  ),
  markRead: promisify<{ messageId: string; userId: string }, { ok: boolean; at: any }>(
    deliveryClient,
    'markRead'
  ),
  getUnreadCounts: promisify<
    { userId: string },
    {
      channels: Array<{ scopeId: string; count: number }>;
      conversations: Array<{ scopeId: string; count: number }>;
    }
  >(deliveryClient, 'getUnreadCounts'),
};

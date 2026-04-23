import * as grpc from '@grpc/grpc-js';
import { loadProto, resolveService } from '@messageme/shared';
import { config } from './config';

const authPkg = loadProto('auth.proto');
const userPkg = loadProto('user.proto');
const groupPkg = loadProto('group.proto');
const channelPkg = loadProto('channel.proto');
const directPkg = loadProto('direct.proto');
const messagePkg = loadProto('message.proto');
const presencePkg = loadProto('presence.proto');
const deliveryPkg = loadProto('delivery.proto');
const filePkg = loadProto('file.proto');

const AuthCtor = resolveService(authPkg, 'messageme.auth.AuthService');
const UserCtor = resolveService(userPkg, 'messageme.user.UserService');
const GroupCtor = resolveService(groupPkg, 'messageme.group.GroupService');
const ChannelCtor = resolveService(channelPkg, 'messageme.channel.ChannelService');
const DirectCtor = resolveService(directPkg, 'messageme.direct.DirectService');
const MessageCtor = resolveService(messagePkg, 'messageme.message.MessageService');
const PresenceCtor = resolveService(presencePkg, 'messageme.presence.PresenceService');
const DeliveryCtor = resolveService(deliveryPkg, 'messageme.delivery.DeliveryService');
const FileCtor = resolveService(filePkg, 'messageme.file.FileService');

export const authClient = new AuthCtor(config.authServiceAddr, grpc.credentials.createInsecure()) as any;
export const userClient = new UserCtor(config.userServiceAddr, grpc.credentials.createInsecure()) as any;
export const groupClient = new GroupCtor(config.groupServiceAddr, grpc.credentials.createInsecure()) as any;
export const channelClient = new ChannelCtor(
  config.channelServiceAddr,
  grpc.credentials.createInsecure()
) as any;
export const directClient = new DirectCtor(
  config.directServiceAddr,
  grpc.credentials.createInsecure()
) as any;
export const messageClient = new MessageCtor(
  config.messageServiceAddr,
  grpc.credentials.createInsecure()
) as any;
export const presenceClient = new PresenceCtor(
  config.presenceServiceAddr,
  grpc.credentials.createInsecure()
) as any;
export const deliveryClient = new DeliveryCtor(
  config.deliveryServiceAddr,
  grpc.credentials.createInsecure()
) as any;
export const fileClient = new FileCtor(
  config.fileServiceAddr,
  grpc.credentials.createInsecure()
) as any;

function promisify<Req, Res>(client: any, method: string): (req: Req) => Promise<Res> {
  return (req: Req) =>
    new Promise<Res>((resolve, reject) => {
      client[method](req, (err: grpc.ServiceError | null, res: Res) =>
        err ? reject(err) : resolve(res)
      );
    });
}

export const auth = {
  register: promisify<any, any>(authClient, 'register'),
  login: promisify<any, any>(authClient, 'login'),
  refresh: promisify<any, any>(authClient, 'refresh'),
  logout: promisify<any, any>(authClient, 'logout'),
  validateToken: promisify<any, any>(authClient, 'validateToken'),
};

export const user = {
  getProfile: promisify<any, any>(userClient, 'getProfile'),
  getProfiles: promisify<any, any>(userClient, 'getProfiles'),
  search: promisify<any, any>(userClient, 'search'),
  updateProfile: promisify<any, any>(userClient, 'updateProfile'),
};

export const group = {
  createGroup: promisify<any, any>(groupClient, 'createGroup'),
  getGroup: promisify<any, any>(groupClient, 'getGroup'),
  listGroupsForUser: promisify<any, any>(groupClient, 'listGroupsForUser'),
  updateGroup: promisify<any, any>(groupClient, 'updateGroup'),
  deleteGroup: promisify<any, any>(groupClient, 'deleteGroup'),
  addMember: promisify<any, any>(groupClient, 'addMember'),
  removeMember: promisify<any, any>(groupClient, 'removeMember'),
  listMembers: promisify<any, any>(groupClient, 'listMembers'),
  updateMemberRole: promisify<any, any>(groupClient, 'updateMemberRole'),
};

export const channel = {
  createChannel: promisify<any, any>(channelClient, 'createChannel'),
  getChannel: promisify<any, any>(channelClient, 'getChannel'),
  listChannels: promisify<any, any>(channelClient, 'listChannels'),
  updateChannel: promisify<any, any>(channelClient, 'updateChannel'),
  deleteChannel: promisify<any, any>(channelClient, 'deleteChannel'),
};

export const direct = {
  getOrCreateConversation: promisify<any, any>(directClient, 'getOrCreateConversation'),
  getConversation: promisify<any, any>(directClient, 'getConversation'),
  listForUser: promisify<any, any>(directClient, 'listForUser'),
};

export const message = {
  sendMessage: promisify<any, any>(messageClient, 'sendMessage'),
  getMessage: promisify<any, any>(messageClient, 'getMessage'),
  getHistory: promisify<any, any>(messageClient, 'getHistory'),
  editMessage: promisify<any, any>(messageClient, 'editMessage'),
  deleteMessage: promisify<any, any>(messageClient, 'deleteMessage'),
};

export const presence = {
  getPresence: promisify<any, any>(presenceClient, 'getPresence'),
};

export const delivery = {
  markDelivered: promisify<any, any>(deliveryClient, 'markDelivered'),
  markRead: promisify<any, any>(deliveryClient, 'markRead'),
  getStatuses: promisify<any, any>(deliveryClient, 'getStatuses'),
  getUnreadCounts: promisify<any, any>(deliveryClient, 'getUnreadCounts'),
};

export const file = {
  createUpload: promisify<any, any>(fileClient, 'createUpload'),
  confirmUpload: promisify<any, any>(fileClient, 'confirmUpload'),
  getDownloadUrl: promisify<any, any>(fileClient, 'getDownloadUrl'),
  getFile: promisify<any, any>(fileClient, 'getFile'),
};

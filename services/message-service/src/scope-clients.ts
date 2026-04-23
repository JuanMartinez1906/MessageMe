import * as grpc from '@grpc/grpc-js';
import { loadProto, resolveService, grpcErrorToApp } from '@messageme/shared';
import { config } from './config';

const groupPkg = loadProto('group.proto');
const channelPkg = loadProto('channel.proto');
const directPkg = loadProto('direct.proto');

const GroupCtor = resolveService(groupPkg, 'messageme.group.GroupService');
const ChannelCtor = resolveService(channelPkg, 'messageme.channel.ChannelService');
const DirectCtor = resolveService(directPkg, 'messageme.direct.DirectService');

const groupClient = new GroupCtor(config.groupServiceAddr, grpc.credentials.createInsecure()) as any;
const channelClient = new ChannelCtor(
  config.channelServiceAddr,
  grpc.credentials.createInsecure()
) as any;
const directClient = new DirectCtor(
  config.directServiceAddr,
  grpc.credentials.createInsecure()
) as any;

function promisify<Req, Res>(client: any, method: string): (req: Req) => Promise<Res> {
  return (req: Req) =>
    new Promise<Res>((resolve, reject) => {
      client[method](req, (err: grpc.ServiceError | null, res: Res) => {
        if (err) return reject(grpcErrorToApp(err));
        resolve(res);
      });
    });
}

export const groupRpc = {
  listMembers: promisify<{ groupId: string }, { members: Array<{ userId: string; role: string }> }>(
    groupClient,
    'listMembers'
  ),
};

export const channelRpc = {
  getChannel: promisify<{ channelId: string }, { channelId: string; groupId: string; name: string }>(
    channelClient,
    'getChannel'
  ),
};

export const directRpc = {
  getConversation: promisify<
    { conversationId: string; requestedBy: string },
    { conversationId: string; participantIds: string[] }
  >(directClient, 'getConversation'),
};

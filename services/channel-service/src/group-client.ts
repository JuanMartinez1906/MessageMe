import * as grpc from '@grpc/grpc-js';
import { loadProto, resolveService, grpcErrorToApp } from '@messageme/shared';
import { config } from './config';

const groupPkg = loadProto('group.proto');
const GroupCtor = resolveService(groupPkg, 'messageme.group.GroupService');

const client = new GroupCtor(config.groupServiceAddr, grpc.credentials.createInsecure()) as any;

function promisify<Req, Res>(method: string): (req: Req) => Promise<Res> {
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
    'listMembers'
  ),
};

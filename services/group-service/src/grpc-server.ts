import * as grpc from '@grpc/grpc-js';
import { loadProto, resolveService, AppError, createLogger } from '@messageme/shared';
import { config } from './config';
import { groupService, GroupDto, MemberDto, Role } from './group.service';

const log = createLogger('group-service');

const groupPkg = loadProto('group.proto');
const GroupServiceDef = (resolveService(groupPkg, 'messageme.group.GroupService') as any).service;

function toTimestamp(d: Date) {
  const ms = d.getTime();
  return { seconds: Math.floor(ms / 1000).toString(), nanos: (ms % 1000) * 1_000_000 };
}

function roleToProto(r: Role): string {
  return r === 'ADMIN' ? 'ROLE_ADMIN' : 'ROLE_MEMBER';
}

function groupToProto(g: GroupDto) {
  return {
    groupId: g.groupId,
    name: g.name,
    description: g.description ?? '',
    avatarUrl: g.avatarUrl ?? '',
    createdBy: g.createdBy,
    createdAt: toTimestamp(g.createdAt),
  };
}

function memberToProto(m: MemberDto) {
  return {
    userId: m.userId,
    groupId: m.groupId,
    role: roleToProto(m.role),
    joinedAt: toTimestamp(m.joinedAt),
  };
}

function guard<T, R>(handler: (req: T) => Promise<R>): grpc.handleUnaryCall<T, R> {
  return async (call, callback) => {
    try {
      callback(null, await handler(call.request));
    } catch (err) {
      if (err instanceof AppError) {
        log.warn({ code: err.code, msg: err.message }, 'handled error');
        callback(err.toGrpc(), null);
      } else {
        log.error({ err }, 'unhandled error');
        callback(new AppError('INTERNAL', 'Internal server error').toGrpc(), null);
      }
    }
  };
}

const impl = {
  createGroup: guard(async (req: any) =>
    groupToProto(
      await groupService.createGroup({
        name: req.name,
        description: req.description || undefined,
        createdBy: req.createdBy,
      })
    )
  ),

  getGroup: guard(async (req: any) => groupToProto(await groupService.getGroup(req.groupId))),

  listGroupsForUser: guard(async (req: any) => ({
    groups: (await groupService.listForUser(req.userId)).map(groupToProto),
  })),

  updateGroup: guard(async (req: any) =>
    groupToProto(
      await groupService.updateGroup({
        groupId: req.groupId,
        name: req.name || undefined,
        description: req.description || undefined,
        avatarUrl: req.avatarUrl || undefined,
      })
    )
  ),

  deleteGroup: guard(async (req: any) => {
    await groupService.deleteGroup(req.groupId, req.requestedBy);
    return {};
  }),

  addMember: guard(async (req: any) =>
    memberToProto(
      await groupService.addMember({
        groupId: req.groupId,
        userId: req.userId,
        role: groupService._roleFromProto(req.role),
        addedBy: req.addedBy,
      })
    )
  ),

  removeMember: guard(async (req: any) => {
    await groupService.removeMember({
      groupId: req.groupId,
      userId: req.userId,
      removedBy: req.removedBy,
    });
    return {};
  }),

  listMembers: guard(async (req: any) => ({
    members: (await groupService.listMembers(req.groupId)).map(memberToProto),
  })),

  updateMemberRole: guard(async (req: any) =>
    memberToProto(
      await groupService.updateMemberRole({
        groupId: req.groupId,
        userId: req.userId,
        newRole: groupService._roleFromProto(req.newRole),
        requestedBy: req.requestedBy,
      })
    )
  ),
};

export function startServer(): Promise<void> {
  const server = new grpc.Server();
  server.addService(GroupServiceDef, impl as any);
  return new Promise((resolve, reject) => {
    server.bindAsync(
      `${config.grpcHost}:${config.grpcPort}`,
      grpc.ServerCredentials.createInsecure(),
      (err, port) => {
        if (err) return reject(err);
        log.info({ port }, 'group-service gRPC listening');
        resolve();
      }
    );
  });
}

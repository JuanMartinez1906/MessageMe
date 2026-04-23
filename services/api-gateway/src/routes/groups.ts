import { Router } from 'express';
import { group, channel, user } from '../grpc-clients';
import { requireAuth } from '../middleware';
import { AppError } from '@messageme/shared';

export const groupsRouter = Router();

function tsToIso(ts: any): string {
  if (!ts) return new Date().toISOString();
  const seconds = Number(ts.seconds ?? 0);
  const nanos = Number(ts.nanos ?? 0);
  return new Date(seconds * 1000 + Math.floor(nanos / 1_000_000)).toISOString();
}

function roleFromProto(r: string): 'ADMIN' | 'MEMBER' {
  return r === 'ROLE_ADMIN' ? 'ADMIN' : 'MEMBER';
}

async function profileLookup(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, any>();
  const res = await user.getProfiles({ userIds });
  return new Map<string, any>(res.profiles.map((p: any) => [p.userId, p]));
}

async function expandGroup(groupId: string) {
  const [g, membersRes, channelsRes] = await Promise.all([
    group.getGroup({ groupId }),
    group.listMembers({ groupId }),
    channel.listChannels({ groupId }),
  ]);
  const profiles = await profileLookup(membersRes.members.map((m: any) => m.userId));
  return {
    id: g.groupId,
    name: g.name,
    description: g.description || null,
    avatarUrl: g.avatarUrl || null,
    createdById: g.createdBy,
    createdAt: tsToIso(g.createdAt),
    members: membersRes.members.map((m: any) => {
      const p = profiles.get(m.userId);
      return {
        id: m.userId,
        role: roleFromProto(m.role),
        joinedAt: tsToIso(m.joinedAt),
        user: p
          ? {
              id: p.userId,
              username: p.username,
              displayName: p.displayName,
              avatarUrl: p.avatarUrl || null,
              isOnline: false,
            }
          : { id: m.userId, username: '', displayName: '', avatarUrl: null, isOnline: false },
      };
    }),
    channels: channelsRes.channels.map((c: any) => ({
      id: c.channelId,
      name: c.name,
      description: c.description || null,
      createdAt: tsToIso(c.createdAt),
    })),
  };
}

groupsRouter.use(requireAuth());

groupsRouter.post('/', async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) throw new AppError('BAD_REQUEST', 'name is required');
    const g = await group.createGroup({ name, description: description ?? '', createdBy: req.userId });
    res.status(201).json(await expandGroup(g.groupId));
  } catch (err) {
    next(err);
  }
});

groupsRouter.get('/', async (req, res, next) => {
  try {
    const list = await group.listGroupsForUser({ userId: req.userId });
    const expanded = await Promise.all(list.groups.map((g: any) => expandGroup(g.groupId)));
    res.json(expanded);
  } catch (err) {
    next(err);
  }
});

groupsRouter.get('/:groupId', async (req, res, next) => {
  try {
    // Access check: must be a member
    const members = await group.listMembers({ groupId: req.params.groupId });
    if (!members.members.some((m: any) => m.userId === req.userId)) {
      throw new AppError('FORBIDDEN', 'Not a member of this group');
    }
    res.json(await expandGroup(req.params.groupId));
  } catch (err) {
    next(err);
  }
});

groupsRouter.post('/:groupId/members', async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) throw new AppError('BAD_REQUEST', 'userId is required');
    const m = await group.addMember({
      groupId: req.params.groupId,
      userId,
      role: 'ROLE_MEMBER',
      addedBy: req.userId,
    });
    const profiles = await profileLookup([m.userId]);
    const p = profiles.get(m.userId);
    res.status(201).json({
      id: m.userId,
      role: roleFromProto(m.role),
      joinedAt: tsToIso(m.joinedAt),
      user: p
        ? {
            id: p.userId,
            username: p.username,
            displayName: p.displayName,
            avatarUrl: p.avatarUrl || null,
            isOnline: false,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

groupsRouter.delete('/:groupId/members/:userId', async (req, res, next) => {
  try {
    await group.removeMember({
      groupId: req.params.groupId,
      userId: req.params.userId,
      removedBy: req.userId,
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

groupsRouter.post('/:groupId/channels', async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) throw new AppError('BAD_REQUEST', 'name is required');
    const c = await channel.createChannel({
      groupId: req.params.groupId,
      name,
      description: description ?? '',
      createdBy: req.userId,
    });
    res.status(201).json({
      id: c.channelId,
      name: c.name,
      description: c.description || null,
      createdAt: tsToIso(c.createdAt),
    });
  } catch (err) {
    next(err);
  }
});

groupsRouter.get('/:groupId/channels', async (req, res, next) => {
  try {
    const members = await group.listMembers({ groupId: req.params.groupId });
    if (!members.members.some((m: any) => m.userId === req.userId)) {
      throw new AppError('FORBIDDEN', 'Not a member of this group');
    }
    const list = await channel.listChannels({ groupId: req.params.groupId });
    res.json(
      list.channels.map((c: any) => ({
        id: c.channelId,
        name: c.name,
        description: c.description || null,
        createdAt: tsToIso(c.createdAt),
      }))
    );
  } catch (err) {
    next(err);
  }
});

groupsRouter.delete('/:groupId/channels/:channelId', async (req, res, next) => {
  try {
    await channel.deleteChannel({ channelId: req.params.channelId, requestedBy: req.userId });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

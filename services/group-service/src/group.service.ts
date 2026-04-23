import { AppError } from '@messageme/shared';
import { prisma } from './prisma';

export type Role = 'ADMIN' | 'MEMBER';

export interface GroupDto {
  groupId: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  createdBy: string;
  createdAt: Date;
}

export interface MemberDto {
  groupId: string;
  userId: string;
  role: Role;
  joinedAt: Date;
}

function roleFromProto(r: string | undefined): Role {
  // proto enum string form: ROLE_ADMIN, ROLE_MEMBER, ROLE_UNSPECIFIED
  if (r === 'ROLE_ADMIN') return 'ADMIN';
  return 'MEMBER';
}

function toGroupDto(row: {
  groupId: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  createdBy: string;
  createdAt: Date;
}): GroupDto {
  return {
    groupId: row.groupId,
    name: row.name,
    description: row.description,
    avatarUrl: row.avatarUrl,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

function toMemberDto(row: {
  groupId: string;
  userId: string;
  role: Role;
  joinedAt: Date;
}): MemberDto {
  return { ...row };
}

async function requireMember(groupId: string, userId: string) {
  const m = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!m) throw new AppError('FORBIDDEN', 'Not a member of this group');
  return m;
}

async function requireAdmin(groupId: string, userId: string) {
  const m = await requireMember(groupId, userId);
  if (m.role !== 'ADMIN') throw new AppError('FORBIDDEN', 'Only admins can perform this action');
  return m;
}

export const groupService = {
  async createGroup(args: { name: string; description?: string; createdBy: string }): Promise<GroupDto> {
    if (!args.name?.trim()) throw new AppError('BAD_REQUEST', 'name is required');
    if (!args.createdBy) throw new AppError('BAD_REQUEST', 'createdBy is required');

    const row = await prisma.group.create({
      data: {
        name: args.name,
        description: args.description ?? null,
        createdBy: args.createdBy,
        members: { create: { userId: args.createdBy, role: 'ADMIN' } },
      },
    });
    return toGroupDto(row);
  },

  async getGroup(groupId: string): Promise<GroupDto> {
    const row = await prisma.group.findUnique({ where: { groupId } });
    if (!row) throw new AppError('NOT_FOUND', 'Group not found');
    return toGroupDto(row);
  },

  async listForUser(userId: string): Promise<GroupDto[]> {
    const memberships = await prisma.groupMember.findMany({
      where: { userId },
      include: { group: true },
      orderBy: { joinedAt: 'desc' },
    });
    return memberships.map((m) => toGroupDto(m.group));
  },

  async updateGroup(args: {
    groupId: string;
    name?: string;
    description?: string;
    avatarUrl?: string;
  }): Promise<GroupDto> {
    const exists = await prisma.group.findUnique({ where: { groupId: args.groupId } });
    if (!exists) throw new AppError('NOT_FOUND', 'Group not found');
    const row = await prisma.group.update({
      where: { groupId: args.groupId },
      data: {
        name: args.name || undefined,
        description: args.description ?? undefined,
        avatarUrl: args.avatarUrl ?? undefined,
      },
    });
    return toGroupDto(row);
  },

  async deleteGroup(groupId: string, requestedBy: string): Promise<void> {
    await requireAdmin(groupId, requestedBy);
    await prisma.group.delete({ where: { groupId } });
  },

  async addMember(args: {
    groupId: string;
    userId: string;
    role: Role;
    addedBy: string;
  }): Promise<MemberDto> {
    await requireAdmin(args.groupId, args.addedBy);
    const existing = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: args.groupId, userId: args.userId } },
    });
    if (existing) throw new AppError('CONFLICT', 'User is already a member');
    const row = await prisma.groupMember.create({
      data: { groupId: args.groupId, userId: args.userId, role: args.role },
    });
    return toMemberDto(row);
  },

  async removeMember(args: {
    groupId: string;
    userId: string;
    removedBy: string;
  }): Promise<void> {
    await requireAdmin(args.groupId, args.removedBy);
    const target = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: args.groupId, userId: args.userId } },
    });
    if (!target) throw new AppError('NOT_FOUND', 'User is not a member of this group');
    await prisma.groupMember.delete({
      where: { groupId_userId: { groupId: args.groupId, userId: args.userId } },
    });
  },

  async listMembers(groupId: string): Promise<MemberDto[]> {
    const rows = await prisma.groupMember.findMany({
      where: { groupId },
      orderBy: { joinedAt: 'asc' },
    });
    return rows.map(toMemberDto);
  },

  async updateMemberRole(args: {
    groupId: string;
    userId: string;
    newRole: Role;
    requestedBy: string;
  }): Promise<MemberDto> {
    await requireAdmin(args.groupId, args.requestedBy);
    const target = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: args.groupId, userId: args.userId } },
    });
    if (!target) throw new AppError('NOT_FOUND', 'Member not found');
    const row = await prisma.groupMember.update({
      where: { groupId_userId: { groupId: args.groupId, userId: args.userId } },
      data: { role: args.newRole },
    });
    return toMemberDto(row);
  },

  // Called by message-service to enforce channel membership checks.
  async isMember(groupId: string, userId: string): Promise<boolean> {
    const m = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    return !!m;
  },

  _roleFromProto: roleFromProto,
};

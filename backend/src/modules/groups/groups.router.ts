import { Router } from 'express';
import { groupsController } from './groups.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

export const groupsRouter = Router();

groupsRouter.use(authMiddleware);

// Groups
groupsRouter.post('/', groupsController.createGroup);
groupsRouter.get('/', groupsController.getGroups);
groupsRouter.get('/:groupId', groupsController.getGroupById);
groupsRouter.post('/:groupId/members', groupsController.addMember);
groupsRouter.delete('/:groupId/members/:userId', groupsController.removeMember);

// Channels
groupsRouter.post('/:groupId/channels', groupsController.createChannel);
groupsRouter.get('/:groupId/channels', groupsController.getChannels);
groupsRouter.delete('/:groupId/channels/:channelId', groupsController.deleteChannel);

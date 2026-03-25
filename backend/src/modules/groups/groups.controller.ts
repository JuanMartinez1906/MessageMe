import { Response } from 'express';
import { groupsService } from './groups.service';
import { AuthRequest } from '../../middleware/auth.middleware';

export const groupsController = {
  async createGroup(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { name, description } = req.body;
      if (!name) { res.status(400).json({ message: 'name is required' }); return; }
      const group = await groupsService.createGroup(req.userId!, { name, description });
      res.status(201).json(group);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  },

  async getGroups(req: AuthRequest, res: Response): Promise<void> {
    try {
      const groups = await groupsService.getGroups(req.userId!);
      res.json(groups);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  },

  async getGroupById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const group = await groupsService.getGroupById(req.params.groupId, req.userId!);
      res.json(group);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  },

  async addMember(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.body;
      if (!userId) { res.status(400).json({ message: 'userId is required' }); return; }
      const member = await groupsService.addMember(req.params.groupId, req.userId!, userId);
      res.status(201).json(member);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  },

  async removeMember(req: AuthRequest, res: Response): Promise<void> {
    try {
      await groupsService.removeMember(req.params.groupId, req.userId!, req.params.userId);
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  },

  async createChannel(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { name, description } = req.body;
      if (!name) { res.status(400).json({ message: 'name is required' }); return; }
      const channel = await groupsService.createChannel(req.params.groupId, req.userId!, { name, description });
      res.status(201).json(channel);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  },

  async getChannels(req: AuthRequest, res: Response): Promise<void> {
    try {
      const channels = await groupsService.getChannels(req.params.groupId, req.userId!);
      res.json(channels);
    } catch (error: any) {
      res.status(403).json({ message: error.message });
    }
  },

  async deleteChannel(req: AuthRequest, res: Response): Promise<void> {
    try {
      await groupsService.deleteChannel(req.params.groupId, req.params.channelId, req.userId!);
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  },
};

import { Request, Response } from 'express';
import { authService } from './auth.service';
import { AuthRequest } from '../../middleware/auth.middleware';
import { RegisterDto, LoginDto, RefreshDto } from './auth.types';

export const authController = {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const dto: RegisterDto = req.body;
      if (!dto.email || !dto.username || !dto.password || !dto.displayName) {
        res.status(400).json({ message: 'email, username, password and displayName are required' });
        return;
      }
      const result = await authService.register(dto);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  },

  async login(req: Request, res: Response): Promise<void> {
    try {
      const dto: LoginDto = req.body;
      if (!dto.email || !dto.password) {
        res.status(400).json({ message: 'email and password are required' });
        return;
      }
      const result = await authService.login(dto);
      res.json(result);
    } catch (error: any) {
      res.status(401).json({ message: error.message });
    }
  },

  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken }: RefreshDto = req.body;
      if (!refreshToken) {
        res.status(400).json({ message: 'refreshToken is required' });
        return;
      }
      const result = await authService.refresh(refreshToken);
      res.json(result);
    } catch (error: any) {
      res.status(401).json({ message: error.message });
    }
  },

  async logout(req: AuthRequest, res: Response): Promise<void> {
    try {
      await authService.logout(req.userId!);
      res.json({ message: 'Logged out successfully' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  },

  async me(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = await authService.me(req.userId!);
      res.json(user);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  },
};

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { User, ActionLog } from '../models';
import { logAction } from '../middleware/loggingMiddleware';

const router = Router();

// Client Dashboard - Get user summary (for both mobile and web clients)
router.get('/dashboard', authenticateToken, logAction('view_dashboard'), async (req: any, res: Response) => {
  try {
    const userId = req.user.id;

    // Get user info with role
    const user = await User.findByPk(userId, {
      attributes: ['id', 'email', 'createdAt'],
      include: [{
        association: 'Role',
        attributes: ['name']
      }]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get recent activity (last 10 actions)
    const recentActivity = await ActionLog.findAll({
      where: { user_id: userId },
      attributes: ['action', 'createdAt', 'details'],
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    // Get user stats
    const stats = {
      totalActions: await ActionLog.count({ where: { user_id: userId } }),
      role: (user as any).Role?.name,
      memberSince: user.createdAt
    };

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: (user as any).Role?.name,
        memberSince: user.createdAt
      },
      recentActivity: recentActivity.map(activity => ({
        action: activity.action,
        timestamp: activity.createdAt,
        details: activity.details
      })),
      stats
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// Client Profile - Get detailed user profile (for both mobile and web clients)
router.get('/profile', authenticateToken, logAction('view_profile'), async (req: any, res: Response) => {
  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId, {
      attributes: ['id', 'email', 'createdAt'],
      include: [{
        association: 'Role',
        attributes: ['name']
      }]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      profile: {
        id: user.id,
        email: user.email,
        role: (user as any).Role?.name,
        memberSince: user.createdAt,
        // Add more profile fields as needed
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// Client Settings - Update user preferences (for both mobile and web clients)
router.put('/settings', authenticateToken, logAction('update_settings'), async (req: any, res: Response) => {
  try {
    // Placeholder for settings update
    // This could include notification preferences, language, etc.
    res.json({
      message: 'Settings updated successfully',
      settings: req.body
    });
  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Client Health Check - Simple endpoint for app connectivity testing (for both mobile and web clients)
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Get property names for autocomplete (public)
router.get('/properties/names', async (req: Request, res: Response) => {
  try {
    const { Property } = await import('../models');
    const properties = await Property.findAll({
      attributes: ['name', 'location'],
      order: [['name', 'ASC']]
    });
    res.json({ properties: properties.map(p => ({ name: p.name, location: p.location })) });
  } catch (error) {
    console.error('Error fetching property names:', error);
    res.status(500).json({ error: 'Failed to fetch property names' });
  }
});

export default router;
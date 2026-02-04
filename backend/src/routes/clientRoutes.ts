import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { User, ActionLog, Booking } from '../models';
import { logAction } from '../middleware/loggingMiddleware';
import { Op } from 'sequelize';

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
      role: user.role,
      memberSince: user.created_at
    };

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        memberSince: user.created_at
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
        role: user.role,
        memberSince: user.created_at,
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
    console.log('🔍 PUT /settings received:', JSON.stringify(req.body, null, 2));
    const { settings } = req.body;
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Invalid settings format' });
    }

    // Import PlatformSetting model
    const PlatformSetting = (await import('../models/PlatformSetting')).default;
    
    // Map frontend keys to database keys
    const keyMapping: Record<string, string> = {
      'commissionRate': 'marketplace_commission_rate',
      'swapFee': 'swap_fee',
      'creditConversionFee': 'credit_conversion_fee',
      'chargeSwapFeeToRequester': 'charge_swap_fee_to_requester',
      'chargeSwapFeeToResponder': 'charge_swap_fee_to_responder',
      'creditToEurRate': 'credit_to_eur_rate',
      'autoApproveGuests': 'auto_approve_guests',
      'autoApproveStaff': 'auto_approve_staff',
      'requireEmailVerification': 'require_email_verification',
      'emailNotifications': 'email_notifications',
      'bookingAlerts': 'booking_alerts',
      'systemAlerts': 'system_alerts',
      'maintenanceMode': 'maintenance_mode',
      'allowRegistrations': 'allow_registrations',
    };

    // Update or create each setting
    const promises = Object.entries(settings).map(async ([frontendKey, value]) => {
      const dbKey = keyMapping[frontendKey] || frontendKey;
      
      console.log(`💾 Saving: ${frontendKey} → ${dbKey} = ${value}`);
      
      const [setting, created] = await PlatformSetting.findOrCreate({
        where: { key: dbKey },
        defaults: {
          key: dbKey,
          value: String(value),
        },
      });

      if (!created) {
        await setting.update({ value: String(value) });
      }

      return setting;
    });

    await Promise.all(promises);
    
    console.log('✅ All settings saved successfully');
    
    // Si se incluye creditToEurRate, también actualizarlo vía el servicio para invalidar caché
    if (settings.creditToEurRate !== undefined) {
      const rate = parseFloat(settings.creditToEurRate);
      if (!isNaN(rate) && rate >= 0) {
        const { CreditCalculationService } = await import('../services/CreditCalculationService');
        await CreditCalculationService.updateCreditToEurRate(rate);
      }
    }
    
    res.json({
      message: 'Settings updated successfully',
      settings: req.body.settings
    });
  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Get user payment history
router.get('/payments', authenticateToken, logAction('view_payments'), async (req: any, res: Response) => {
  try {
    const userId = req.user.id;

    // Get user info
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all bookings with payment information for this user
    const bookings = await Booking.findAll({
      where: {
        guest_email: user.email,
        payment_intent_id: { [Op.ne]: null } // Only bookings with payment
      },
      include: [{
        association: 'Property',
        attributes: ['id', 'name', 'location', 'city', 'country']
      }],
      order: [['created_at', 'DESC']]
    });

    // Transform bookings into payment records
    const payments = bookings.map(booking => ({
      id: booking.id,
      booking_id: booking.id,
      amount: booking.total_amount || 0,
      currency: booking.currency || 'EUR',
      status: booking.payment_status === 'paid' ? 'completed' : 
              booking.payment_status === 'failed' ? 'failed' :
              booking.payment_status === 'refunded' ? 'refunded' : 'pending',
      payment_method: 'card',
      transaction_id: booking.payment_intent_id,
      created_at: booking.created_at,
      Booking: {
        id: booking.id,
        Property: booking.Property ? {
          name: booking.Property.name
        } : null
      }
    }));

    res.json({
      success: true,
      payments
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payment history' });
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
      attributes: ['name', 'city', 'country'],
      order: [['name', 'ASC']]
    });
    res.json({ properties: properties.map(p => ({ name: p.name, location: `${p.city}, ${p.country}` })) });
  } catch (error: any) {
    // If properties table doesn't exist (V1 legacy), return empty list
    if (error.name === 'SequelizeDatabaseError' && error.original?.code === 'ER_NO_SUCH_TABLE') {
      res.json({ 
        properties: [],
        message: 'Legacy properties table not available. Use V2 API: /api/admin/properties'
      });
      return;
    }
    console.error('Error fetching property names:', error);
    res.status(500).json({ error: 'Failed to fetch property names' });
  }
});

export default router;
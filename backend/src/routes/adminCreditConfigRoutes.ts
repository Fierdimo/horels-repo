import { Router, Response } from 'express';
import CreditBookingCost from '../models/CreditBookingCost';
import Property from '../models/Property';
import PlatformSettings from '../models/PlatformSettings';

interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role_id: number;
    Role?: {
      name: string;
    };
  };
}

const router = Router();

// Middleware para verificar que el usuario es admin
const requireAdminRole = (req: any, res: Response, next: any) => {
  if (req.user?.Role?.name !== 'admin' && req.user?.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Admin access required',
      debug: {
        hasUser: !!req.user,
        hasRole: !!req.user?.Role,
        roleName: req.user?.Role?.name,
        roleId: req.user?.role_id
      }
    });
  }
  next();
};

// ========================================
// PROPERTY TIER & MULTIPLIER MANAGEMENT
// ========================================

// @route   GET /admin/credit-config/properties
// @desc    Get all properties with their tier and multiplier
// @access  Admin
router.get('/properties', requireAdminRole, async (req: any, res: Response) => {
  try {
    const properties = await Property.findAll({
      attributes: ['id', 'name', 'city', 'country', 'tier', 'location_multiplier'],
      order: [['name', 'ASC']]
    });

    res.json({
      success: true,
      data: properties
    });
  } catch (error: any) {
    console.error('Error fetching properties:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching properties',
      error: error.message
    });
  }
});

// @route   PUT /admin/credit-config/properties/:id
// @desc    Update property tier and location multiplier
// @access  Admin
router.put('/properties/:id', requireAdminRole, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { tier, location_multiplier } = req.body;

    const property = await Property.findByPk(id);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Validate tier
    const validTiers = ['DIAMOND', 'GOLD', 'SILVER_PLUS', 'STANDARD'];
    if (tier && !validTiers.includes(tier)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tier. Must be one of: DIAMOND, GOLD, SILVER_PLUS, STANDARD'
      });
    }

    // Validate multiplier
    if (location_multiplier && (location_multiplier < 0.5 || location_multiplier > 3.0)) {
      return res.status(400).json({
        success: false,
        message: 'Location multiplier must be between 0.5 and 3.0'
      });
    }

    await property.update({
      tier: tier || property.tier,
      location_multiplier: location_multiplier || property.location_multiplier
    });

    res.json({
      success: true,
      message: 'Property updated successfully',
      data: property
    });
  } catch (error: any) {
    console.error('Error updating property:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating property',
      error: error.message
    });
  }
});

// ========================================
// CREDIT BOOKING COST MANAGEMENT
// ========================================

// @route   GET /admin/credit-config/costs
// @desc    Get all credit booking costs with filters
// @access  Admin
router.get('/costs', requireAdminRole, async (req: any, res: Response) => {
  try {
    const { property_id, room_type, season_type } = req.query;

    const where: any = {};
    if (property_id) where.property_id = property_id;
    if (room_type) where.room_type = room_type;
    if (season_type) where.season_type = season_type;

    const costs = await CreditBookingCost.findAll({
      where,
      include: [
        {
          model: Property,
          as: 'property',
          attributes: ['id', 'name', 'tier', 'location_multiplier']
        }
      ],
      order: [['property_id', 'ASC'], ['room_type', 'ASC'], ['season_type', 'ASC']]
    });

    res.json({
      success: true,
      count: costs.length,
      data: costs
    });
  } catch (error: any) {
    console.error('Error fetching credit costs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching credit costs',
      error: error.message
    });
  }
});

// @route   POST /admin/credit-config/costs
// @desc    Create new credit booking cost configuration
// @access  Admin
router.post('/costs', requireAdminRole, async (req: any, res: Response) => {
  try {
    const {
      property_id,
      room_type,
      season_type,
      credits_per_night,
      effective_from,
      effective_until,
      notes
    } = req.body;

    // Validation
    if (!property_id || !room_type || !season_type || !credits_per_night) {
      return res.status(400).json({
        success: false,
        message: 'property_id, room_type, season_type, and credits_per_night are required'
      });
    }

    // Validate property exists
    const property = await Property.findByPk(property_id);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Check if configuration already exists
    const existing = await CreditBookingCost.findOne({
      where: {
        property_id,
        room_type,
        season_type
      }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Active configuration already exists for this property/room/season combination. Please deactivate it first or use the update endpoint.'
      });
    }

    const cost = await CreditBookingCost.create({
      property_id,
      room_type,
      season_type,
      credits_per_night,
      effective_from: effective_from || new Date(),
      notes
    });

    res.status(201).json({
      success: true,
      message: 'Credit cost configuration created successfully',
      data: cost
    });
  } catch (error: any) {
    console.error('Error creating credit cost:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating credit cost',
      error: error.message
    });
  }
});

// @route   PUT /admin/credit-config/costs/:id
// @desc    Update credit booking cost configuration
// @access  Admin
router.put('/costs/:id', requireAdminRole, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const {
      credits_per_night,
      effective_from,
      effective_until,
      is_active,
      notes
    } = req.body;

    const cost = await CreditBookingCost.findByPk(id);
    if (!cost) {
      return res.status(404).json({
        success: false,
        message: 'Credit cost configuration not found'
      });
    }

    await cost.update({
      credits_per_night: credits_per_night !== undefined ? credits_per_night : cost.credits_per_night,
      effective_from: effective_from || cost.effective_from,
      notes: notes !== undefined ? notes : cost.notes
    });

    res.json({
      success: true,
      message: 'Credit cost configuration updated successfully',
      data: cost
    });
  } catch (error: any) {
    console.error('Error updating credit cost:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating credit cost',
      error: error.message
    });
  }
});

// @route   DELETE /admin/credit-config/costs/:id
// @desc    Delete credit booking cost configuration
// @access  Admin
router.delete('/costs/:id', requireAdminRole, async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const cost = await CreditBookingCost.findByPk(id);
    if (!cost) {
      return res.status(404).json({
        success: false,
        message: 'Credit cost configuration not found'
      });
    }

    await cost.destroy();

    res.json({
      success: true,
      message: 'Credit cost configuration deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting credit cost:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting credit cost',
      error: error.message
    });
  }
});

// @route   POST /admin/credit-config/costs/bulk-create
// @desc    Bulk create credit booking cost configurations
// @access  Admin
router.post('/costs/bulk-create', requireAdminRole, async (req: any, res: Response) => {
  try {
    const { property_id, configurations } = req.body;

    if (!property_id || !configurations || !Array.isArray(configurations)) {
      return res.status(400).json({
        success: false,
        message: 'property_id and configurations array are required'
      });
    }

    // Validate property exists
    const property = await Property.findByPk(property_id);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    const created = [];
    const errors = [];

    for (const config of configurations) {
      try {
        const cost = await CreditBookingCost.create({
          property_id,
          room_type: config.room_type,
          season_type: config.season_type,
          credits_per_night: config.credits_per_night,
          effective_from: config.effective_from || new Date(),
          notes: config.notes
        });
        created.push(cost);
      } catch (error: any) {
        errors.push({
          config,
          error: error.message
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `Created ${created.length} configurations${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
      data: {
        created,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error: any) {
    console.error('Error bulk creating credit costs:', error);
    res.status(500).json({
      success: false,
      message: 'Error bulk creating credit costs',
      error: error.message
    });
  }
});

// ========================================
// SYSTEM DEFAULTS & CONSTANTS
// ========================================

// @route   GET /admin/credit-config/defaults
// @desc    Get system default values for credit calculation
// @access  Admin
router.get('/defaults', requireAdminRole, async (req: any, res: Response) => {
  try {
    // Fetch all settings from database
    const settings = await PlatformSettings.getAllSettings();

    const defaults = {
      tiers: {
        DIAMOND: { 
          multiplier: parseFloat(settings['TIER_MULTIPLIER_DIAMOND'] || '1.5'), 
          description: 'Premium properties with highest credit value' 
        },
        GOLD: { 
          multiplier: parseFloat(settings['TIER_MULTIPLIER_GOLD'] || '1.3'), 
          description: 'High-quality properties' 
        },
        SILVER_PLUS: { 
          multiplier: parseFloat(settings['TIER_MULTIPLIER_SILVER_PLUS'] || '1.1'), 
          description: 'Good properties above standard' 
        },
        STANDARD: { 
          multiplier: parseFloat(settings['TIER_MULTIPLIER_STANDARD'] || '1.0'), 
          description: 'Standard properties' 
        }
      },
      room_types: {
        STANDARD: { 
          multiplier: parseFloat(settings['ROOM_MULTIPLIER_STANDARD'] || '1.0'), 
          description: 'Standard room' 
        },
        SUPERIOR: { 
          multiplier: parseFloat(settings['ROOM_MULTIPLIER_SUPERIOR'] || '1.2'), 
          description: 'Superior room' 
        },
        DELUXE: { 
          multiplier: parseFloat(settings['ROOM_MULTIPLIER_DELUXE'] || '1.5'), 
          description: 'Deluxe room' 
        },
        SUITE: { 
          multiplier: parseFloat(settings['ROOM_MULTIPLIER_SUITE'] || '2.0'), 
          description: 'Suite' 
        },
        PRESIDENTIAL: { 
          multiplier: parseFloat(settings['ROOM_MULTIPLIER_PRESIDENTIAL'] || '2.5'), 
          description: 'Presidential suite' 
        }
      },
      seasons: {
        RED: { 
          base_value: parseInt(settings['BASE_SEASON_RED'] || '1000'), 
          description: 'High season - peak demand' 
        },
        WHITE: { 
          base_value: parseInt(settings['BASE_SEASON_WHITE'] || '600'), 
          description: 'Medium season - moderate demand' 
        },
        BLUE: { 
          base_value: parseInt(settings['BASE_SEASON_BLUE'] || '300'), 
          description: 'Low season - low demand' 
        }
      }
    };

    res.json({
      success: true,
      data: defaults
    });
  } catch (error: any) {
    console.error('Error fetching defaults:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching defaults',
      error: error.message
    });
  }
});

// @route   PUT /admin/credit-config/defaults
// @desc    Update system default values
// @access  Admin
router.put('/defaults', requireAdminRole, async (req: any, res: Response) => {
  try {
    const { category, key, value } = req.body;
    const userId = req.user?.id;

    if (!category || !key || value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Category, key, and value are required'
      });
    }

    // Map frontend keys to database keys
    const settingKeyMap: Record<string, string> = {
      // Tiers
      'tier_DIAMOND': 'TIER_MULTIPLIER_DIAMOND',
      'tier_GOLD': 'TIER_MULTIPLIER_GOLD',
      'tier_SILVER_PLUS': 'TIER_MULTIPLIER_SILVER_PLUS',
      'tier_STANDARD': 'TIER_MULTIPLIER_STANDARD',
      // Room types
      'room_STANDARD': 'ROOM_MULTIPLIER_STANDARD',
      'room_SUPERIOR': 'ROOM_MULTIPLIER_SUPERIOR',
      'room_DELUXE': 'ROOM_MULTIPLIER_DELUXE',
      'room_SUITE': 'ROOM_MULTIPLIER_SUITE',
      'room_PRESIDENTIAL': 'ROOM_MULTIPLIER_PRESIDENTIAL',
      // Seasons
      'season_RED': 'BASE_SEASON_RED',
      'season_WHITE': 'BASE_SEASON_WHITE',
      'season_BLUE': 'BASE_SEASON_BLUE'
    };

    const settingKey = settingKeyMap[`${category}_${key}`];
    
    if (!settingKey) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category or key'
      });
    }

    await PlatformSettings.updateSetting(settingKey, String(value), userId);

    res.json({
      success: true,
      message: 'Setting updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating defaults:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating defaults',
      error: error.message
    });
  }
});

export default router;

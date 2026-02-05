import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { authenticateToken } from '../middleware/authMiddleware';
import PMSFactory from '../services/pms/PMSFactory';
import { Property } from '../models';
import { TimeshareProperty } from '../models/v2';
import { MockPMSManager } from '../services/pms/MockPMSService';

const router = Router();

/**
 * @route   GET /api/pms-search/providers
 * @desc    Get list of available PMS providers
 * @access  Public (for registration)
 */
router.get('/providers', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: [
      { value: 'mews', label: 'Mews PMS', requiresAuth: true },
      { value: 'cloudbeds', label: 'Cloudbeds', requiresAuth: true },
      { value: 'opera', label: 'Oracle Opera', requiresAuth: true },
      { value: 'resnexus', label: 'ResNexus', requiresAuth: true }
    ]
  });
});

/**
 * @route   GET /api/pms-search/search?q=hotel+name
 * @desc    Search for properties in platform only (no Mock PMS)
 * @access  Public (for staff registration)
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const searchQuery = req.query.q as string;
    
    if (!searchQuery || searchQuery.length < 2) {
      return res.json({
        success: true,
        data: []
      });
    }

    const results: Array<{
      id?: string | number;
      propertyId: string;
      name: string;
      location?: string;
      city?: string;
      country?: string;
      alreadyRegistered: boolean;
      source: 'platform' | 'mock-pms';
    }> = [];

    // Search only in registered V2 properties (platform)
    const platformProperties = await TimeshareProperty.findAll({
      where: {
        [Op.or]: [
          {
            name: {
              [Op.like]: `%${searchQuery}%`
            }
          },
          {
            city: {
              [Op.like]: `%${searchQuery}%`
            }
          }
        ]
      },
      attributes: ['id', 'name', 'city', 'country', 'address'],
      limit: 10,
      order: [['name', 'ASC']]
    });

    // Add platform results
    platformProperties.forEach(p => {
      results.push({
        id: p.id,
        propertyId: p.id.toString(),
        name: p.name,
        location: p.address || undefined,
        city: p.city,
        country: p.country,
        alreadyRegistered: true,
        source: 'platform'
      });
    });

    res.json({
      success: true,
      data: results
    });
  } catch (error: any) {
    console.error('Error searching properties:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search properties',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/pms-search/properties
 * @desc    Search properties in THE platform's PMS system (autocomplete)
 * @access  Public (for staff registration)
 * @body    { search: 'hotel name' }
 */
router.post('/properties', async (req: Request, res: Response) => {
  try {
    const { search } = req.body;

    // Use platform's PMS credentials from environment
    const provider = process.env.PMS_PROVIDER || 'mews';
    const credentials = {
      clientToken: process.env.MEWS_CLIENT_ID,
      accessToken: process.env.MEWS_CLIENT_SECRET
    };

    if (!credentials.clientToken || !credentials.accessToken) {
      return res.status(500).json({
        success: false,
        error: 'PMS credentials not configured in platform'
      });
    }

    // Create adapter with platform's credentials
    const adapter = PMSFactory.create(provider as any, credentials as any);

    // Legacy route - needs refactoring
    return res.status(501).json({
      success: false,
      error: 'This endpoint needs refactoring for new PMS adapter'
    });

    /*
    // Test connection
    const connectionTest = await adapter.testConnection();
    if (!connectionTest.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to connect to platform PMS',
        details: connectionTest.error
      });
    }

    // Get property info from PMS
    const propertyInfo = await adapter.getPropertyInfo();
    
    if (!propertyInfo.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve properties from PMS',
        details: propertyInfo.error
      });
    }

    // Check if this property is already registered
    const existingProperty = await Property.findOne({
      where: {
        pms_provider: provider,
        pms_property_id: propertyInfo.data.propertyId
      }
    });

    // TODO: In the future, implement search across multiple properties
    // For now, return the main property from the PMS account
    res.json({
      success: true,
      data: {
        propertyId: propertyInfo.data.propertyId,
        name: propertyInfo.data.name,
        address: propertyInfo.data.address,
        city: propertyInfo.data.city,
        country: propertyInfo.data.country,
        timezone: propertyInfo.data.timezone,
        alreadyRegistered: !!existingProperty,
        existingPropertyId: existingProperty?.id || null
      }
    });
    */
  } catch (error: any) {
    console.error('Error searching PMS properties:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search properties in PMS',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/pms-search/validate-property
 * @desc    Validate property exists in platform's PMS and return full details
 * @access  Public (for staff registration)
 */
router.post('/validate-property', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.body;

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        error: 'PropertyId is required'
      });
    }

    // Use platform's PMS credentials
    const provider = process.env.PMS_PROVIDER || 'mews';
    const credentials = {
      clientToken: process.env.MEWS_CLIENT_ID,
      accessToken: process.env.MEWS_CLIENT_SECRET
    };

    // Create adapter with platform credentials
    const adapter = PMSFactory.create(provider as any, credentials as any);
    
    // Legacy route - needs refactoring
    return res.status(501).json({
      success: false,
      error: 'This endpoint needs refactoring for new PMS adapter'
    });
    
    /*
    // Get detailed property info
    const propertyInfo = await adapter.getPropertyInfo();

    if (!propertyInfo.success || propertyInfo.data.propertyId !== propertyId) {
      return res.status(400).json({
        success: false,
        error: 'Property not found or ID mismatch'
      });
    }

    // Check if already registered in our system
    const existingProperty = await Property.findOne({
      where: {
        pms_provider: provider,
        pms_property_id: propertyId
      },
      attributes: ['id', 'name', 'status']
    });

    if (existingProperty) {
      return res.status(409).json({
        success: false,
        error: 'Property already registered in the system',
        propertyId: existingProperty.id,
        propertyName: existingProperty.name,
        is_active: existingProperty.is_active
      });
    }

    res.json({
      success: true,
      data: {
        propertyId: propertyInfo.data.propertyId,
        name: propertyInfo.data.name,
        address: propertyInfo.data.address,
        city: propertyInfo.data.city,
        country: propertyInfo.data.country,
        timezone: propertyInfo.data.timezone,
        description: propertyInfo.data.description || null,
        images: propertyInfo.data.images || null,
        amenities: propertyInfo.data.amenities || null,
        canRegister: true
      }
    });
    */
  } catch (error: any) {
    console.error('Error validating property:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate property',
      message: error.message
    });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { authenticateToken } from '../middleware/authMiddleware';
import PMSFactory from '../services/pms/PMSFactory';
import { Property } from '../models';

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
 * @desc    Search for properties in platform AND PMS
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
      id?: number;
      propertyId: string;
      name: string;
      location?: string;
      city?: string;
      country?: string;
      alreadyRegistered: boolean;
      source: 'platform' | 'pms';
    }> = [];

    // 1. Search in registered properties (platform)
    const platformProperties = await Property.findAll({
      where: {
        name: {
          [Op.like]: `%${searchQuery}%`
        }
      },
      attributes: ['id', 'name', 'location', 'city', 'country', 'pms_property_id', 'pms_provider'],
      limit: 10,
      order: [['name', 'ASC']]
    });

    // Add platform results
    platformProperties.forEach(p => {
      results.push({
        id: p.id,
        propertyId: p.pms_property_id || '',
        name: p.name,
        location: p.location,
        city: p.city,
        country: p.country,
        alreadyRegistered: true,
        source: 'platform'
      });
    });

    // 2. Search in PMS (if configured)
    try {
      const pms_provider = process.env.PMS_PROVIDER || 'mews';
      const pms_credentials = {
        clientToken: process.env.MEWS_CLIENT_ID,
        accessToken: process.env.MEWS_CLIENT_SECRET
      };

      if (pms_credentials.clientToken && pms_credentials.accessToken) {
        const adapter = PMSFactory.createAdapter(pms_provider, pms_credentials);
        const connectionTest = await adapter.testConnection();
        
        if (connectionTest.success) {
          const propertyInfo = await adapter.getPropertyInfo();
          
          if (propertyInfo.success && propertyInfo.data) {
            const pmsProperty = propertyInfo.data;
            
            // Check if property name matches search (case-insensitive)
            if (pmsProperty.name && pmsProperty.name.toLowerCase().includes(searchQuery.toLowerCase())) {
              // Check if already in platform results
              const existsInPlatform = results.some(r => r.propertyId === pmsProperty.propertyId);
              
              if (!existsInPlatform) {
                // Check if registered but not in search results
                const existingProperty = await Property.findOne({
                  where: {
                    pms_provider: pms_provider,
                    pms_property_id: pmsProperty.propertyId
                  }
                });

                results.push({
                  id: existingProperty?.id,
                  propertyId: pmsProperty.propertyId,
                  name: pmsProperty.name,
                  location: [pmsProperty.city, pmsProperty.country].filter(Boolean).join(', '),
                  city: pmsProperty.city,
                  country: pmsProperty.country,
                  alreadyRegistered: !!existingProperty,
                  source: 'pms'
                });
              }
            }
          }
        }
      }
    } catch (pmsError) {
      console.error('Error searching in PMS (non-fatal):', pmsError);
      // Continue with platform results even if PMS fails
    }

    res.json({
      success: true,
      data: results
    });
  } catch (error: any) {
    console.error('Error searching properties:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search properties'
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
    const adapter = PMSFactory.createAdapter(provider, credentials);

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
    const adapter = PMSFactory.createAdapter(provider, credentials);
    
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
        status: existingProperty.status
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

import { Request, Response } from 'express';
import Property from '../models/Property';
import { encryptPMSCredentials, decryptPMSCredentials } from '../utils/pmsEncryption';
import { PMSFactory } from '../services/pms/PMSFactory';
import PMSSyncLog from '../models/PMSSyncLog';
import { Op } from 'sequelize';

/**
 * PropertyController
 * Handles CRUD operations for properties and PMS configuration
 */
class PropertyController {
  /**
   * List all properties
   * Admin sees all properties, staff sees only their assigned property
   */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      
      // Build query filter
      const where: any = {};
      
      // Get role from user object (can be user.Role.name or user.role from JWT)
      const userRole = user.Role?.name || user.role;
      
      // Hotel staff can only see their property
      if (userRole === 'staff' && user.property_id) {
        where.id = user.property_id;
      }
      
      // Filter by status if provided
      if (req.query.status) {
        where.status = req.query.status;
      }

      const properties = await Property.findAll({
        where,
        attributes: {
          exclude: ['pms_credentials'] // Never expose credentials in list
        },
        order: [['name', 'ASC']]
      });

      res.json({
        success: true,
        data: properties,
        count: properties.length
      });
    } catch (error: any) {
      // If table doesn't exist (V1 legacy), return empty list
      if (error.name === 'SequelizeDatabaseError' && error.original?.code === 'ER_NO_SUCH_TABLE') {
        res.json({
          success: true,
          data: [],
          count: 0,
          message: 'Legacy properties table not available. Use V2 API: /api/admin/properties'
        });
        return;
      }
      
      console.error('Error listing properties:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list properties',
        message: error.message
      });
    }
  }

  /**
   * Get property by ID
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = (req as any).user;

      const property = await Property.findByPk(id, {
        attributes: {
          exclude: ['pms_credentials'] // Never expose raw encrypted credentials
        }
      });

      if (!property) {
        res.status(404).json({
          success: false,
          error: 'Property not found'
        });
        return;
      }

      // Return PMS connection status without credentials
      const responseData: any = property.toJSON();
      if (property.pms_provider) {
        responseData.pms_configured = true;
        responseData.pms_fields_configured = {
          provider: !!property.pms_provider,
          property_id: !!property.pms_property_id,
          credentials: !!property.pms_credentials_encrypted
        };
      }

      res.json({
        success: true,
        data: responseData
      });
    } catch (error: any) {
      console.error('Error fetching property:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch property',
        message: error.message
      });
    }
  }

  /**
   * Create a new property
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const propertyData = req.body;

      // Encrypt PMS credentials if provided
      if (propertyData.pms_credentials) {
        propertyData.pms_credentials = encryptPMSCredentials(propertyData.pms_credentials);
      }

      // Set created_by
      propertyData.created_by = user.id;

      const property = await Property.create({
        ...propertyData,
        tier: propertyData.tier || 'STANDARD',
        location_multiplier: propertyData.location_multiplier || 1.00
      });

      // Return without credentials
      const responseData: any = property.toJSON();
      delete responseData.pms_credentials;

      res.status(201).json({
        success: true,
        data: responseData,
        message: 'Property created successfully'
      });
    } catch (error: any) {
      console.error('Error creating property:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create property',
        message: error.message
      });
    }
  }

  /**
   * Update property
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const property = await Property.findByPk(id);
      if (!property) {
        res.status(404).json({
          success: false,
          error: 'Property not found'
        });
        return;
      }

      // Encrypt PMS credentials if being updated
      if (updateData.pms_credentials) {
        updateData.pms_credentials = encryptPMSCredentials(updateData.pms_credentials);
      }

      // Don't allow updating id or created_by
      delete updateData.id;
      delete updateData.created_by;

      await property.update(updateData);

      // Return without credentials
      const responseData: any = property.toJSON();
      delete responseData.pms_credentials;

      res.json({
        success: true,
        data: responseData,
        message: 'Property updated successfully'
      });
    } catch (error: any) {
      console.error('Error updating property:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update property',
        message: error.message
      });
    }
  }

  /**
   * Delete property (soft delete)
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const property = await Property.findByPk(id);
      if (!property) {
        res.status(404).json({
          success: false,
          error: 'Property not found'
        });
        return;
      }

      // Soft delete by setting is_active to false
      await property.update({ is_active: false });

      res.json({
        success: true,
        message: 'Property deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting property:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete property',
        message: error.message
      });
    }
  }

  /**
   * Test PMS connection without saving credentials
   */
  async testPMSConnection(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      // Obtener property con sus credenciales guardadas
      const property = await Property.findByPk(id);
      if (!property) {
        res.status(404).json({
          success: false,
          error: 'Property not found'
        });
        return;
      }

      if (!property.pms_provider) {
        res.status(400).json({
          success: false,
          error: 'Property has no PMS provider configured'
        });
        return;
      }

      if (!property.pms_credentials_encrypted) {
        res.status(400).json({
          success: false,
          error: 'Property has no PMS credentials configured'
        });
        return;
      }

      // Desencriptar credenciales guardadas
      const credentials = decryptPMSCredentials(property.pms_credentials_encrypted.toString('utf8'));

      // Test connection using factory
      const result = await PMSFactory.testConnection(
        property.pms_provider,
        credentials
      );

      res.json(result);
    } catch (error: any) {
      console.error('Error testing PMS connection:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test PMS connection',
        message: error.message
      });
    }
  }

  /**
   * Test new PMS credentials before saving (Phase 7: Admin Tools)
   * POST /api/admin/properties/pms/test-credentials
   */
  async testNewPMSCredentials(req: Request, res: Response): Promise<void> {
    try {
      const { provider, credentials, property_id } = req.body;

      if (!provider || !credentials) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: provider, credentials'
        });
        return;
      }

      // Validate provider
      const validProviders = ['mews', 'cloudbeds', 'opera', 'resnexus', 'other'];
      if (!validProviders.includes(provider)) {
        res.status(400).json({
          success: false,
          error: `Invalid provider. Must be one of: ${validProviders.join(', ')}`
        });
        return;
      }

      // Test connection without saving
      const result = await PMSFactory.testConnection(
        provider,
        credentials
      );

      res.json(result);
    } catch (error: any) {
      console.error('Error testing new PMS credentials:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test PMS credentials',
        message: error.message
      });
    }
  }

  /**
   * Configure PMS for a property (Phase 7: Admin Tools)
   * PUT /api/admin/properties/:id/pms
   */
  async configurePMS(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { provider, property_id, credentials, sync_enabled } = req.body;

      const property = await Property.findByPk(id);
      if (!property) {
        res.status(404).json({
          success: false,
          error: 'Property not found'
        });
        return;
      }

      // Update PMS configuration
      const updateData: any = {};
      
      if (provider !== undefined) updateData.pms_provider = provider;
      if (property_id !== undefined) updateData.pms_property_id = property_id;
      if (sync_enabled !== undefined) updateData.pms_sync_enabled = sync_enabled;
      
      // Encrypt and save credentials if provided
      if (credentials) {
        updateData.pms_credentials = encryptPMSCredentials(credentials);
      }

      await property.update(updateData);

      // Return without exposing credentials
      const responseData: any = property.toJSON();
      delete responseData.pms_credentials_encrypted;
      responseData.pms_configured = !!(property.pms_provider && property.pms_credentials_encrypted);

      res.json({
        success: true,
        data: responseData,
        message: 'PMS configuration updated successfully'
      });
    } catch (error: any) {
      console.error('Error configuring PMS:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to configure PMS',
        message: error.message
      });
    }
  }

  /**
   * Remove PMS configuration (Phase 7: Admin Tools)
   * DELETE /api/admin/properties/:id/pms
   */
  async removePMSConfiguration(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const property = await Property.findByPk(id);
      if (!property) {
        res.status(404).json({
          success: false,
          error: 'Property not found'
        });
        return;
      }

      // Clear PMS configuration
      await property.update({
        pms_provider: undefined,
        pms_property_id: undefined,
        pms_credentials_encrypted: undefined
      });

      res.json({
        success: true,
        message: 'PMS configuration removed successfully'
      });
    } catch (error: any) {
      console.error('Error removing PMS configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove PMS configuration',
        message: error.message
      });
    }
  }

  /**
   * Trigger manual PMS sync
   */
  async triggerSync(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      const { sync_type } = req.body; // 'availability', 'bookings', 'prices'

      const property = await Property.findByPk(id);
      if (!property) {
        res.status(404).json({
          success: false,
          error: 'Property not found'
        });
        return;
      }

      if (!property.pms_provider) {
        res.status(400).json({
          success: false,
          error: 'PMS sync is not enabled for this property'
        });
        return;
      }

      // Create sync log
      const syncLog = await PMSSyncLog.create({
        property_id: parseInt(id),
        sync_type: sync_type || 'manual',
        status: 'pending',
        triggered_by: user.id
      });

      // TODO: Queue sync job in worker
      // For now, just return the log
      res.json({
        success: true,
        message: 'Sync triggered successfully',
        data: {
          sync_log_id: syncLog.id,
          status: syncLog.status
        }
      });
    } catch (error: any) {
      console.error('Error triggering sync:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to trigger sync',
        message: error.message
      });
    }
  }

  /**
   * Get PMS sync logs for a property
   */
  async getSyncLogs(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const logs = await PMSSyncLog.findAll({
        where: { property_id: id },
        order: [['created_at', 'DESC']],
        limit,
        offset
      });

      const total = await PMSSyncLog.count({
        where: { property_id: id }
      });

      res.json({
        success: true,
        data: logs,
        pagination: {
          total,
          limit,
          offset,
          has_more: offset + logs.length < total
        }
      });
    } catch (error: any) {
      console.error('Error fetching sync logs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch sync logs',
        message: error.message
      });
    }
  }

  /**
   * Get room availability from PMS
   */
  async getAvailability(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const params = req.query; // dates, room_type, etc.

      const property = await Property.findByPk(id);
      if (!property) {
        res.status(404).json({
          success: false,
          error: 'Property not found'
        });
        return;
      }

      if (!property.pms_provider) {
        res.status(400).json({
          success: false,
          error: 'Property does not have PMS configured'
        });
        return;
      }

      // Get adapter and fetch availability
      const adapter = await PMSFactory.getAdapter(parseInt(id));
      const today = new Date();
      const nextMonth = new Date(today);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      
      const availability = await adapter.getAvailability({
        checkIn: today,
        checkOut: nextMonth
      });

      res.json({
        success: true,
        data: availability
      });
    } catch (error: any) {
      console.error('Error fetching availability:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch availability',
        message: error.message
      });
    }
  }
}

export default new PropertyController();

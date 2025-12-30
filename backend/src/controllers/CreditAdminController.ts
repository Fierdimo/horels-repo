import { Request, Response } from 'express';
import PropertyTier from '../models/PropertyTier';
import RoomTypeMultiplier from '../models/RoomTypeMultiplier';
import SeasonalCalendar from '../models/SeasonalCalendar';
import CreditBookingCost from '../models/CreditBookingCost';
import PlatformSetting from '../models/PlatformSetting';
import SettingChangeLog from '../models/SettingChangeLog';
import Property from '../models/Property';

/**
 * Controller for credit system administration and configuration
 */
class CreditAdminController {

  /**
   * GET /api/credits/admin/tiers
   * Get all property tiers
   */
  async getPropertyTiers(req: Request, res: Response): Promise<void> {
    try {
      const tiers = await PropertyTier.getAllOrdered();

      res.json({
        success: true,
        data: tiers.map(tier => ({
          id: tier.id,
          code: tier.tier_code,
          name: tier.tier_name,
          multiplier: Number(tier.location_multiplier),
          displayOrder: tier.display_order
        }))
      });

    } catch (error: any) {
      console.error('Error getting property tiers:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get property tiers'
      });
    }
  }

  /**
   * PUT /api/credits/admin/tiers/:id
   * Update property tier multiplier
   */
  async updatePropertyTier(req: Request, res: Response): Promise<void> {
    try {
      const tierId = parseInt(req.params.id);
      const { multiplier } = req.body;
      const adminUserId = (req as any).user?.id;

      if (!multiplier) {
        res.status(400).json({ error: 'Multiplier is required' });
        return;
      }

      const tier = await PropertyTier.findByPk(tierId);
      if (!tier) {
        res.status(404).json({ error: 'Tier not found' });
        return;
      }

      const oldMultiplier = tier.location_multiplier;
      await tier.update({ location_multiplier: multiplier });

      // Log change
      await SettingChangeLog.logChange(
        `tier_multiplier_${tier.tier_code}`,
        String(oldMultiplier),
        String(multiplier),
        adminUserId,
        `Updated ${tier.tier_name} multiplier`
      );

      res.json({
        success: true,
        data: {
          id: tier.id,
          code: tier.tier_code,
          name: tier.tier_name,
          multiplier: Number(tier.location_multiplier)
        },
        message: `Successfully updated ${tier.tier_name} multiplier to ${multiplier}`
      });

    } catch (error: any) {
      console.error('Error updating property tier:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update property tier'
      });
    }
  }

  /**
   * GET /api/credits/admin/room-multipliers
   * Get all room type multipliers
   */
  async getRoomMultipliers(req: Request, res: Response): Promise<void> {
    try {
      const multipliers = await RoomTypeMultiplier.getAllActive();

      res.json({
        success: true,
        data: multipliers.map(rm => ({
          id: rm.id,
          roomType: rm.room_type,
          multiplier: Number(rm.multiplier),
          isActive: rm.is_active,
          displayOrder: rm.display_order
        }))
      });

    } catch (error: any) {
      console.error('Error getting room multipliers:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get room multipliers'
      });
    }
  }

  /**
   * PUT /api/credits/admin/room-multipliers/:id
   * Update room type multiplier
   */
  async updateRoomMultiplier(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const { multiplier } = req.body;
      const adminUserId = (req as any).user?.id;

      if (!multiplier) {
        res.status(400).json({ error: 'Multiplier is required' });
        return;
      }

      const roomMultiplier = await RoomTypeMultiplier.findByPk(id);
      if (!roomMultiplier) {
        res.status(404).json({ error: 'Room multiplier not found' });
        return;
      }

      const oldMultiplier = roomMultiplier.multiplier;
      await roomMultiplier.update({ multiplier });

      // Log change
      await SettingChangeLog.logChange(
        `room_multiplier_${roomMultiplier.room_type}`,
        String(oldMultiplier),
        String(multiplier),
        adminUserId,
        `Updated ${roomMultiplier.room_type} room multiplier`
      );

      res.json({
        success: true,
        data: {
          id: roomMultiplier.id,
          roomType: roomMultiplier.room_type,
          multiplier: Number(roomMultiplier.multiplier)
        },
        message: `Successfully updated ${roomMultiplier.room_type} multiplier to ${multiplier}`
      });

    } catch (error: any) {
      console.error('Error updating room multiplier:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update room multiplier'
      });
    }
  }

  /**
   * GET /api/credits/admin/seasonal-calendar/:propertyId/:year
   * Get seasonal calendar for property and year
   */
  async getSeasonalCalendar(req: Request, res: Response): Promise<void> {
    try {
      const propertyId = parseInt(req.params.propertyId);
      const year = parseInt(req.params.year);

      if (isNaN(propertyId) || isNaN(year)) {
        res.status(400).json({ error: 'Invalid propertyId or year' });
        return;
      }

      let seasons = await SeasonalCalendar.getSeasonsForYear(propertyId, year);

      // If no seasons configured, return default calendar
      if (seasons.length === 0) {
        const defaultSeasons = [
          // RED SEASON (High Season) - Winter holidays and summer
          {
            id: null,
            property_id: propertyId,
            season_type: 'RED' as const,
            start_date: new Date(`${year}-12-15`),
            end_date: new Date(`${year}-12-31`),
            year,
            isDefault: true
          },
          {
            id: null,
            property_id: propertyId,
            season_type: 'RED' as const,
            start_date: new Date(`${year}-07-01`),
            end_date: new Date(`${year}-08-31`),
            year,
            isDefault: true
          },
          // WHITE SEASON (Mid Season) - Spring and fall
          {
            id: null,
            property_id: propertyId,
            season_type: 'WHITE' as const,
            start_date: new Date(`${year}-03-15`),
            end_date: new Date(`${year}-05-31`),
            year,
            isDefault: true
          },
          {
            id: null,
            property_id: propertyId,
            season_type: 'WHITE' as const,
            start_date: new Date(`${year}-09-15`),
            end_date: new Date(`${year}-11-30`),
            year,
            isDefault: true
          },
          // BLUE SEASON (Low Season) - Rest of year
          {
            id: null,
            property_id: propertyId,
            season_type: 'BLUE' as const,
            start_date: new Date(`${year}-01-01`),
            end_date: new Date(`${year}-03-14`),
            year,
            isDefault: true
          },
          {
            id: null,
            property_id: propertyId,
            season_type: 'BLUE' as const,
            start_date: new Date(`${year}-06-01`),
            end_date: new Date(`${year}-06-30`),
            year,
            isDefault: true
          },
          {
            id: null,
            property_id: propertyId,
            season_type: 'BLUE' as const,
            start_date: new Date(`${year}-09-01`),
            end_date: new Date(`${year}-09-14`),
            year,
            isDefault: true
          },
          {
            id: null,
            property_id: propertyId,
            season_type: 'BLUE' as const,
            start_date: new Date(`${year}-12-01`),
            end_date: new Date(`${year}-12-14`),
            year,
            isDefault: true
          }
        ];
        seasons = defaultSeasons as any;
      }

      res.json({
        success: true,
        data: seasons.map(season => ({
          id: season.id,
          propertyId: season.property_id,
          seasonType: season.season_type,
          startDate: season.start_date,
          endDate: season.end_date,
          year: season.year,
          isDefault: (season as any).isDefault || false
        }))
      });

    } catch (error: any) {
      console.error('Error getting seasonal calendar:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get seasonal calendar'
      });
    }
  }

  /**
   * POST /api/credits/admin/seasonal-calendar
   * Create seasonal calendar entry
   */
  async createSeasonalEntry(req: Request, res: Response): Promise<void> {
    try {
      const { propertyId, seasonType, startDate, endDate, year } = req.body;

      if (!propertyId || !seasonType || !startDate || !endDate || !year) {
        res.status(400).json({ error: 'All fields are required' });
        return;
      }

      const season = await SeasonalCalendar.create({
        property_id: propertyId,
        season_type: seasonType,
        start_date: new Date(startDate),
        end_date: new Date(endDate),
        year
      });

      res.json({
        success: true,
        data: {
          id: season.id,
          propertyId: season.property_id,
          seasonType: season.season_type,
          startDate: season.start_date,
          endDate: season.end_date,
          year: season.year
        },
        message: 'Successfully created seasonal calendar entry'
      });

    } catch (error: any) {
      console.error('Error creating seasonal entry:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create seasonal entry'
      });
    }
  }

  /**
   * DELETE /api/credits/admin/seasonal-calendar/:id
   * Delete seasonal calendar entry
   */
  async deleteSeasonalEntry(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const entry = await SeasonalCalendar.findByPk(id);
      
      if (!entry) {
        res.status(404).json({
          success: false,
          error: 'Seasonal calendar entry not found'
        });
        return;
      }

      await entry.destroy();

      res.json({
        success: true,
        message: 'Seasonal calendar entry deleted successfully'
      });

    } catch (error: any) {
      console.error('Error deleting seasonal entry:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete seasonal entry'
      });
    }
  }

  /**
   * GET /api/credits/admin/booking-costs/:propertyId
   * Get booking costs for property
   */
  async getBookingCosts(req: Request, res: Response): Promise<void> {
    try {
      const propertyId = parseInt(req.params.propertyId);

      if (isNaN(propertyId)) {
        res.status(400).json({ error: 'Invalid propertyId' });
        return;
      }

      const costs = await CreditBookingCost.getPropertyCosts(propertyId);

      res.json({
        success: true,
        data: costs.map(cost => ({
          id: cost.id,
          propertyId: cost.property_id,
          roomType: cost.room_type,
          seasonType: cost.season_type,
          creditsPerNight: Number(cost.credits_per_night),
          effectiveFrom: cost.effective_from,
          notes: cost.notes
        }))
      });

    } catch (error: any) {
      console.error('Error getting booking costs:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get booking costs'
      });
    }
  }

  /**
   * POST /api/credits/admin/booking-costs/:propertyId
   * Update booking costs for property
   */
  async updateBookingCosts(req: Request, res: Response): Promise<void> {
    try {
      const propertyId = parseInt(req.params.propertyId);
      const { prices, effectiveFrom } = req.body;

      if (!prices || !effectiveFrom) {
        res.status(400).json({ error: 'Prices and effectiveFrom are required' });
        return;
      }

      const costRecords = prices.map((price: any) => ({
        property_id: propertyId,
        room_type: price.roomType,
        season_type: price.seasonType,
        credits_per_night: price.creditsPerNight,
        effective_from: new Date(effectiveFrom)
      }));

      await CreditBookingCost.bulkCreate(costRecords);

      res.json({
        success: true,
        message: `Successfully updated booking costs for property #${propertyId}`,
        data: {
          pricesUpdated: prices.length,
          effectiveFrom
        }
      });

    } catch (error: any) {
      console.error('Error updating booking costs:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update booking costs'
      });
    }
  }

  /**
   * GET /api/credits/admin/settings
   * Get all platform settings
   */
  async getSettings(req: Request, res: Response): Promise<void> {
    try {
      const settings = await PlatformSetting.findAll({
        order: [['category', 'ASC'], ['setting_key', 'ASC']]
      });

      res.json({
        success: true,
        data: settings.map(setting => ({
          id: (setting as any).id,
          key: (setting as any).setting_key,
          value: (setting as any).setting_value,
          dataType: (setting as any).data_type,
          category: (setting as any).category,
          description: (setting as any).description,
          isEditable: (setting as any).is_editable_by_admin
        }))
      });

    } catch (error: any) {
      console.error('Error getting settings:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get settings'
      });
    }
  }

  /**
   * PUT /api/credits/admin/settings/:key
   * Update platform setting
   */
  async updateSetting(req: Request, res: Response): Promise<void> {
    try {
      const settingKey = req.params.key;
      const { value, reason } = req.body;
      const adminUserId = (req as any).user?.id;

      if (value === undefined) {
        res.status(400).json({ error: 'Value is required' });
        return;
      }

      const setting = await PlatformSetting.findOne({
        where: { setting_key: settingKey }
      });

      if (!setting) {
        res.status(404).json({ error: 'Setting not found' });
        return;
      }

      if (!(setting as any).is_editable_by_admin) {
        res.status(403).json({ error: 'This setting cannot be edited' });
        return;
      }

      const oldValue = (setting as any).setting_value;
      await setting.update({ setting_value: String(value) });

      // Log change
      await SettingChangeLog.logChange(
        settingKey,
        oldValue,
        String(value),
        adminUserId,
        reason
      );

      res.json({
        success: true,
        data: {
          key: (setting as any).setting_key,
          value: (setting as any).setting_value,
          oldValue
        },
        message: `Successfully updated setting ${settingKey}`
      });

    } catch (error: any) {
      console.error('Error updating setting:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update setting'
      });
    }
  }

  /**
   * GET /api/credits/admin/change-log
   * Get recent setting changes
   */
  async getChangeLog(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const changes = await SettingChangeLog.getRecentChanges(limit);

      res.json({
        success: true,
        data: changes.map(change => ({
          id: change.id,
          settingKey: change.setting_key,
          oldValue: change.old_value,
          newValue: change.new_value,
          changedBy: change.changed_by,
          reason: change.change_reason,
          changedAt: change.created_at
        }))
      });

    } catch (error: any) {
      console.error('Error getting change log:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get change log'
      });
    }
  }

  /**
   * PUT /api/credits/admin/properties/:id/tier
   * Assign tier to property
   */
  async assignPropertyTier(req: Request, res: Response): Promise<void> {
    try {
      const propertyId = parseInt(req.params.id);
      const { tierId } = req.body;
      const adminUserId = (req as any).user?.id;

      if (!tierId) {
        res.status(400).json({ error: 'tierId is required' });
        return;
      }

      const property = await Property.findByPk(propertyId);
      if (!property) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      const tier = await PropertyTier.findByPk(tierId);
      if (!tier) {
        res.status(404).json({ error: 'Tier not found' });
        return;
      }

      const oldTierId = (property as any).tier_id;
      await property.update({ tier_id: tierId } as any);

      // Log change
      await SettingChangeLog.logChange(
        `property_${propertyId}_tier`,
        String(oldTierId || 'none'),
        String(tierId),
        adminUserId,
        `Assigned ${(tier as any).tier_name} tier to ${property.name}`
      );

      res.json({
        success: true,
        data: {
          propertyId: property.id,
          propertyName: property.name,
          tierId: tier.id,
          tierName: tier.tier_name,
          multiplier: Number(tier.location_multiplier)
        },
        message: `Successfully assigned ${tier.tier_name} tier to ${property.name}`
      });

    } catch (error: any) {
      console.error('Error assigning property tier:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to assign property tier'
      });
    }
  }
}

export default new CreditAdminController();

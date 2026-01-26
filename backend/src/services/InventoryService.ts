import { Op, Transaction, WhereOptions } from 'sequelize';
import InventoryItem from '../models/InventoryItem';
import Week from '../models/Week';
import Property from '../models/Property';
import User from '../models/User';
import sequelize from '../config/database';

interface SearchFilters {
  propertyId?: number;
  propertyIds?: number[];
  accommodationType?: string;
  seasonType?: 'RED' | 'WHITE' | 'BLUE';
  startDate?: Date;
  endDate?: Date;
  minCredits?: number;
  maxCredits?: number;
  minNights?: number;
  maxNights?: number;
  isFloating?: boolean;
  excludeOwnerId?: number; // Don't show user's own weeks
}

interface SearchResult {
  items: InventoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ReservationResult {
  success: boolean;
  item?: InventoryItem;
  expiresAt?: Date;
  error?: string;
}

/**
 * InventoryService
 * Manages the unified pool of available weeks for booking
 */
class InventoryService {
  
  /**
   * Add a week to inventory
   * Called when owner releases a week for credits
   */
  async addToInventory(
    weekId: number,
    creditPrice: number,
    priceBreakdown: any,
    transaction?: Transaction
  ): Promise<InventoryItem> {
    const week = await Week.findByPk(weekId, {
      include: [{ model: Property, as: 'property' }],
      transaction
    });

    if (!week) {
      throw new Error(`Week ${weekId} not found`);
    }

    if (week.status !== 'available') {
      throw new Error(`Week ${weekId} is not available (status: ${week.status})`);
    }

    // Check if already in inventory
    const existing = await InventoryItem.findOne({
      where: { week_id: weekId },
      transaction
    });

    if (existing) {
      throw new Error(`Week ${weekId} is already in inventory`);
    }

    // Create inventory item
    const item = await InventoryItem.create({
      week_id: weekId,
      owner_id: week.owner_id,
      property_id: week.property_id,
      start_date: week.start_date,
      end_date: week.end_date,
      nights: week.nights,
      valid_until: week.valid_until,
      accommodation_type: week.accommodation_type,
      season_type: week.season_type,
      credit_price: creditPrice,
      credit_price_breakdown: priceBreakdown,
      status: 'available',
      released_at: new Date()
    }, { transaction });

    // Update week status to 'converted'
    await week.update({ status: 'converted' }, { transaction });

    return item;
  }

  /**
   * Search available inventory with filters
   */
  async search(
    filters: SearchFilters,
    page: number = 1,
    pageSize: number = 20
  ): Promise<SearchResult> {
    const where: WhereOptions = {
      status: 'available'
    };

    // Property filters
    if (filters.propertyId) {
      where.property_id = filters.propertyId;
    } else if (filters.propertyIds && filters.propertyIds.length > 0) {
      where.property_id = { [Op.in]: filters.propertyIds };
    }

    // Accommodation type
    if (filters.accommodationType) {
      where.accommodation_type = filters.accommodationType;
    }

    // Season type
    if (filters.seasonType) {
      where.season_type = filters.seasonType;
    }

    // Credit price range
    if (filters.minCredits !== undefined || filters.maxCredits !== undefined) {
      where.credit_price = {};
      if (filters.minCredits !== undefined) {
        (where.credit_price as any)[Op.gte] = filters.minCredits;
      }
      if (filters.maxCredits !== undefined) {
        (where.credit_price as any)[Op.lte] = filters.maxCredits;
      }
    }

    // Date filters (for fixed weeks)
    if (filters.startDate && filters.endDate) {
      (where as any)[Op.and] = [
        { start_date: { [Op.gte]: filters.startDate } },
        { end_date: { [Op.lte]: filters.endDate } }
      ];
    } else if (filters.startDate) {
      where.start_date = { [Op.gte]: filters.startDate };
    } else if (filters.endDate) {
      where.end_date = { [Op.lte]: filters.endDate };
    }

    // Nights filter (for floating weeks)
    if (filters.minNights !== undefined || filters.maxNights !== undefined) {
      where.nights = {};
      if (filters.minNights !== undefined) {
        (where.nights as any)[Op.gte] = filters.minNights;
      }
      if (filters.maxNights !== undefined) {
        (where.nights as any)[Op.lte] = filters.maxNights;
      }
    }

    // Floating vs Fixed weeks
    if (filters.isFloating === true) {
      where.start_date = null;
      where.nights = { [Op.not]: null };
    } else if (filters.isFloating === false) {
      where.start_date = { [Op.not]: null };
      where.end_date = { [Op.not]: null };
    }

    // Exclude owner's own weeks
    if (filters.excludeOwnerId) {
      where.owner_id = { [Op.ne]: filters.excludeOwnerId };
    }

    // Clean up expired reservations before search
    await this.releaseExpiredReservations();

    const offset = (page - 1) * pageSize;

    const { count, rows } = await InventoryItem.findAndCountAll({
      where,
      include: [
        {
          model: Property,
          as: 'property',
          attributes: ['id', 'name', 'location', 'city', 'country', 'tier', 'images', 'amenities']
        },
        {
          model: Week,
          as: 'week',
          attributes: ['id', 'accommodation_type', 'season_type']
        }
      ],
      order: [
        ['start_date', 'ASC'],
        ['credit_price', 'ASC']
      ],
      limit: pageSize,
      offset
    });

    return {
      items: rows,
      total: count,
      page,
      pageSize,
      totalPages: Math.ceil(count / pageSize)
    };
  }

  /**
   * Reserve an item temporarily during checkout
   */
  async reserve(
    itemId: number,
    userId: number,
    expiresInMinutes: number = 15,
    transaction?: Transaction
  ): Promise<ReservationResult> {
    const item = await InventoryItem.findByPk(itemId, {
      lock: true, // Pessimistic lock
      transaction
    });

    if (!item) {
      return { success: false, error: 'Item not found' };
    }

    // Check if already sold
    if (item.status === 'sold') {
      return { success: false, error: 'Item already sold' };
    }

    // Check if reserved by someone else
    if (item.status === 'reserved' && item.reserved_by !== userId) {
      const now = new Date();
      if (item.reservation_expires_at && item.reservation_expires_at > now) {
        return { success: false, error: 'Item temporarily reserved by another user' };
      }
    }

    // Reserve the item
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);

    await item.update({
      status: 'reserved',
      reserved_by: userId,
      reserved_at: new Date(),
      reservation_expires_at: expiresAt
    }, { transaction });

    return {
      success: true,
      item,
      expiresAt
    };
  }

  /**
   * Confirm booking and mark as sold
   */
  async confirmBooking(
    itemId: number,
    bookingId: number,
    userId: number,
    transaction?: Transaction
  ): Promise<InventoryItem> {
    const item = await InventoryItem.findByPk(itemId, {
      lock: true,
      transaction
    });

    if (!item) {
      throw new Error('Item not found');
    }

    if (item.status === 'sold') {
      throw new Error('Item already sold');
    }

    if (item.status === 'reserved' && item.reserved_by !== userId) {
      throw new Error('Item reserved by another user');
    }

    await item.update({
      status: 'sold',
      booked_by: userId,
      booking_id: bookingId,
      booked_at: new Date(),
      reserved_by: null,
      reserved_at: null,
      reservation_expires_at: null
    }, { transaction });

    return item;
  }

  /**
   * Release a reservation (cancel during checkout)
   */
  async releaseReservation(
    itemId: number,
    userId: number,
    transaction?: Transaction
  ): Promise<boolean> {
    const item = await InventoryItem.findByPk(itemId, { transaction });

    if (!item) {
      return false;
    }

    if (item.status !== 'reserved' || item.reserved_by !== userId) {
      return false;
    }

    await item.update({
      status: 'available',
      reserved_by: null,
      reserved_at: null,
      reservation_expires_at: null
    }, { transaction });

    return true;
  }

  /**
   * Clean up expired reservations
   * Should be called periodically (cron job) or before searches
   */
  async releaseExpiredReservations(): Promise<number> {
    const result = await InventoryItem.update(
      {
        status: 'available',
        reserved_by: null,
        reserved_at: null,
        reservation_expires_at: null
      },
      {
        where: {
          status: 'reserved',
          reservation_expires_at: {
            [Op.lte]: new Date()
          }
        }
      }
    );

    return result[0]; // Number of rows updated
  }

  /**
   * Withdraw a week from inventory
   * Owner can take their week back (if not sold/reserved)
   */
  async withdraw(
    itemId: number,
    ownerId: number,
    transaction?: Transaction
  ): Promise<InventoryItem> {
    const item = await InventoryItem.findByPk(itemId, {
      include: [{ model: Week, as: 'week' }],
      transaction
    });

    if (!item) {
      throw new Error('Item not found');
    }

    if (item.owner_id !== ownerId) {
      throw new Error('Not authorized to withdraw this item');
    }

    if (item.status === 'sold') {
      throw new Error('Cannot withdraw sold item');
    }

    if (item.status === 'reserved') {
      throw new Error('Cannot withdraw reserved item');
    }

    await item.update({
      status: 'withdrawn',
      withdrawn_at: new Date()
    }, { transaction });

    // Restore week to available status
    const week = await Week.findByPk(item.week_id, { transaction });
    if (week) {
      await week.update({ status: 'available' }, { transaction });
    }

    return item;
  }

  /**
   * Get inventory item by ID
   */
  async getById(itemId: number): Promise<InventoryItem | null> {
    return await InventoryItem.findByPk(itemId, {
      include: [
        {
          model: Property,
          as: 'property'
        },
        {
          model: Week,
          as: 'week'
        },
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'first_name', 'last_name', 'email']
        }
      ]
    });
  }

  /**
   * Get owner's items in inventory
   */
  async getOwnerInventory(
    ownerId: number,
    includeWithdrawn: boolean = false
  ): Promise<InventoryItem[]> {
    const where: WhereOptions = { owner_id: ownerId };

    if (!includeWithdrawn) {
      where.status = { [Op.ne]: 'withdrawn' };
    }

    return await InventoryItem.findAll({
      where,
      include: [
        {
          model: Property,
          as: 'property',
          attributes: ['id', 'name', 'location']
        },
        {
          model: Week,
          as: 'week'
        }
      ],
      order: [['released_at', 'DESC']]
    });
  }

  /**
   * Get inventory statistics
   */
  async getStats(): Promise<{
    totalAvailable: number;
    totalReserved: number;
    totalSold: number;
    byProperty: Map<number, number>;
    bySeason: Map<string, number>;
  }> {
    const all = await InventoryItem.findAll({
      where: { status: { [Op.in]: ['available', 'reserved', 'sold'] } },
      attributes: ['status', 'property_id', 'season_type']
    });

    const stats = {
      totalAvailable: 0,
      totalReserved: 0,
      totalSold: 0,
      byProperty: new Map<number, number>(),
      bySeason: new Map<string, number>()
    };

    for (const item of all) {
      // Count by status
      if (item.status === 'available') stats.totalAvailable++;
      if (item.status === 'reserved') stats.totalReserved++;
      if (item.status === 'sold') stats.totalSold++;

      // Count by property
      const propCount = stats.byProperty.get(item.property_id) || 0;
      stats.byProperty.set(item.property_id, propCount + 1);

      // Count by season
      const seasonCount = stats.bySeason.get(item.season_type) || 0;
      stats.bySeason.set(item.season_type, seasonCount + 1);
    }

    return stats;
  }
}

export default new InventoryService();

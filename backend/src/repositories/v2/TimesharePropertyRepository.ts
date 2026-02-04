/**
 * TimeshareProperty Repository (V2)
 * 
 * Data access layer for timeshare properties.
 * Handles queries specific to property management.
 */

import { FindOptions, Op } from 'sequelize';
import { BaseRepository } from './BaseRepository';
import TimeshareProperty from '../../models/v2/TimeshareProperty';
import TimeshareUnit from '../../models/v2/TimeshareUnit';

export interface PropertySearchFilters {
  city?: string;
  country?: string;
  programType?: 'FIXED_WEEK' | 'FLOATING' | 'POINTS';
  isActive?: boolean;
  pmsProvider?: string;
}

export class TimesharePropertyRepository extends BaseRepository<TimeshareProperty> {
  constructor() {
    super(TimeshareProperty);
  }
  
  /**
   * Find property by slug
   */
  async findBySlug(slug: string): Promise<TimeshareProperty | null> {
    return this.findOne({
      where: { slug },
    });
  }
  
  /**
   * Search properties with filters
   */
  async search(filters: PropertySearchFilters, options?: FindOptions): Promise<TimeshareProperty[]> {
    const where: any = {};
    
    if (filters.city) {
      where.city = { [Op.like]: `%${filters.city}%` };
    }
    
    if (filters.country) {
      where.country = filters.country;
    }
    
    if (filters.programType) {
      where.program_type = filters.programType;
    }
    
    if (filters.isActive !== undefined) {
      where.is_active = filters.isActive;
    }
    
    if (filters.pmsProvider) {
      where.pms_provider = filters.pmsProvider;
    }
    
    return this.findAll({
      where,
      ...options,
    });
  }
  
  /**
   * Find properties near coordinates (geo search)
   */
  async findNearby(
    latitude: number,
    longitude: number,
    radiusKm: number = 50
  ): Promise<TimeshareProperty[]> {
    // Simple bounding box search
    // For production, use PostGIS or similar for accurate distance calculation
    const latDelta = radiusKm / 111; // Rough approximation: 1 degree ≈ 111km
    const lonDelta = radiusKm / (111 * Math.cos(latitude * Math.PI / 180));
    
    return this.findAll({
      where: {
        latitude: {
          [Op.between]: [latitude - latDelta, latitude + latDelta],
        },
        longitude: {
          [Op.between]: [longitude - lonDelta, longitude + lonDelta],
        },
        is_active: true,
      },
    });
  }
  
  /**
   * Find property with its units
   */
  async findWithUnits(propertyId: number): Promise<TimeshareProperty | null> {
    return this.findById(propertyId, {
      include: [
        {
          model: TimeshareUnit,
          as: 'units',
          where: { is_active: true },
          required: false,
        },
      ],
    });
  }
  
  /**
   * Get all active properties grouped by country
   */
  async getActiveByCountry(): Promise<Map<string, TimeshareProperty[]>> {
    const properties = await this.findAll({
      where: { is_active: true },
      order: [['country', 'ASC'], ['city', 'ASC']],
    });
    
    const grouped = new Map<string, TimeshareProperty[]>();
    for (const property of properties) {
      const country = property.country;
      if (!grouped.has(country)) {
        grouped.set(country, []);
      }
      grouped.get(country)!.push(property);
    }
    
    return grouped;
  }
  
  /**
   * Update PMS credentials (encrypted)
   */
  async updatePMSCredentials(
    propertyId: number,
    provider: string,
    propertyIdPMS: string,
    credentials: object
  ): Promise<TimeshareProperty | null> {
    return this.update(propertyId, {
      pms_provider: provider as any,
      pms_property_id: propertyIdPMS,
      pms_credentials: credentials,
    });
  }
}

export default TimesharePropertyRepository;

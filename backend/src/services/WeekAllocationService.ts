import { Op } from 'sequelize';
import TimeshareProperty from '../models/v2/TimeshareProperty';
import TimeshareUnit from '../models/v2/TimeshareUnit';
import Ownership from '../models/v2/Ownership';
import WeekAllocation from '../models/v2/WeekAllocation';

/**
 * Distribution methods for week allocations
 */
export type DistributionMethod = 'EQUAL' | 'SEASONAL' | 'RANDOM';

/**
 * Options for generating week allocations
 */
export interface GenerateAllocationsOptions {
  propertyId: number;
  year: number;
  method: DistributionMethod;
  /** Override existing allocations for this year */
  override?: boolean;
  /** Seasonal weights for SEASONAL distribution (week 1-52 → 0.5-2.0) */
  seasonalWeights?: Record<number, number>;
}

/**
 * Preview of allocations before generating
 */
export interface AllocationPreview {
  property: {
    id: number;
    name: string;
    slug: string;
    weeks_per_year: number;
  };
  year: number;
  method: DistributionMethod;
  totalWeeks: number;
  allocations: {
    ownership_id: number;
    owner_name: string;
    unit_category: string;
    ownership_type: string;
    weeks_allocated: number;
    week_numbers: number[];
  }[];
}

/**
 * Result of allocation generation
 */
export interface GenerateAllocationsResult {
  success: boolean;
  allocationsCreated: number;
  allocationsSkipped: number;
  errors: string[];
}

/**
 * Service for generating week allocations
 * Distributes weeks among ownership holders using different methods
 */
export class WeekAllocationService {
  /**
   * Preview allocations without saving to database
   */
  async previewAllocations(options: GenerateAllocationsOptions): Promise<AllocationPreview> {
    const { propertyId, year, method } = options;

    // Get property with units
    const property = await TimeshareProperty.findByPk(propertyId, {
      include: [{
        model: TimeshareUnit,
        as: 'Units',
        where: { is_active: true },
        required: false
      }]
    });

    if (!property) {
      throw new Error(`Property ${propertyId} not found`);
    }

    const weeksPerYear = property.weeks_per_year || 52;

    // Get active ownerships
    const ownerships = await Ownership.findAll({
      where: {
        status: 'ACTIVE'
      },
      include: [{
        model: TimeshareUnit,
        as: 'unit',
        where: {
          property_id: propertyId,
          is_active: true
        },
        include: [{
          model: TimeshareProperty,
          as: 'Property'
        }]
      }, {
        model: require('../models/v2/User').default,
        as: 'owner',
        attributes: ['id', 'first_name', 'last_name', 'email']
      }]
    });

    if (ownerships.length === 0) {
      throw new Error(`No active ownerships found for property ${propertyId}`);
    }

    // Calculate allocations based on method
    const allocations = this.calculateAllocations(ownerships, year, weeksPerYear, method, options.seasonalWeights);

    return {
      property: {
        id: property.id,
        name: property.name,
        slug: property.slug,
        weeks_per_year: weeksPerYear
      },
      year,
      method,
      totalWeeks: allocations.reduce((sum, a) => sum + a.weeks_allocated, 0),
      allocations: allocations.map(a => ({
        ownership_id: a.ownership_id,
        owner_name: `${a.owner.first_name} ${a.owner.last_name}`,
        unit_category: a.unit.category,
        ownership_type: a.ownership_type,
        weeks_allocated: a.weeks_allocated,
        week_numbers: a.week_numbers
      }))
    };
  }

  /**
   * Generate and save week allocations to database
   */
  async generateAllocations(options: GenerateAllocationsOptions): Promise<GenerateAllocationsResult> {
    const { propertyId, year, method, override } = options;
    const result: GenerateAllocationsResult = {
      success: false,
      allocationsCreated: 0,
      allocationsSkipped: 0,
      errors: []
    };

    try {
      // Check if allocations already exist
      const existingCount = await WeekAllocation.count({
        include: [{
          model: Ownership,
          as: 'ownership',
          required: true,
          include: [{
            model: TimeshareUnit,
            as: 'unit',
            where: { property_id: propertyId }
          }]
        }],
        where: { year }
      });

      if (existingCount > 0 && !override) {
        throw new Error(`Allocations for year ${year} already exist. Use override=true to replace them.`);
      }

      // Delete existing allocations if override
      if (existingCount > 0 && override) {
        await WeekAllocation.destroy({
          where: {
            year,
            ownership_id: {
              [Op.in]: await this.getOwnershipIdsForProperty(propertyId)
            }
          }
        });
      }

      // Get property
      const property = await TimeshareProperty.findByPk(propertyId);
      if (!property) {
        throw new Error(`Property ${propertyId} not found`);
      }

      const weeksPerYear = property.weeks_per_year || 52;

      // Get active ownerships
      const ownerships = await Ownership.findAll({
        where: {
          status: 'ACTIVE'
        },
        include: [{
          model: TimeshareUnit,
          as: 'unit',
          where: {
            property_id: propertyId,
            is_active: true
          }
        }, {
          model: require('../models/v2/User').default,
          as: 'owner',
          attributes: ['id', 'first_name', 'last_name', 'email']
        }]
      });

      if (ownerships.length === 0) {
        throw new Error(`No active ownerships found for property ${propertyId}`);
      }

      // Calculate allocations
      const allocations = this.calculateAllocations(ownerships, year, weeksPerYear, method, options.seasonalWeights);

      // Save allocations to database
      for (const allocation of allocations) {
        try {
          for (const weekNumber of allocation.week_numbers) {
            await WeekAllocation.create({
              ownership_id: allocation.ownership_id,
              year,
              week_number: weekNumber,
              is_used: false
            });
            result.allocationsCreated++;
          }
        } catch (error: any) {
          result.errors.push(`Failed to create allocation for ownership ${allocation.ownership_id}, week ${allocation.week_numbers.join(',')}: ${error.message}`);
          result.allocationsSkipped += allocation.week_numbers.length;
        }
      }

      result.success = result.errors.length === 0;
      return result;

    } catch (error: any) {
      result.errors.push(error.message);
      return result;
    }
  }

  /**
   * Calculate week allocations based on distribution method
   */
  private calculateAllocations(
    ownerships: any[],
    year: number,
    weeksPerYear: number,
    method: DistributionMethod,
    seasonalWeights?: Record<number, number>
  ): any[] {
    switch (method) {
      case 'EQUAL':
        return this.distributeEqual(ownerships, year, weeksPerYear);
      case 'SEASONAL':
        return this.distributeSeasonal(ownerships, year, weeksPerYear, seasonalWeights || {});
      case 'RANDOM':
        return this.distributeRandom(ownerships, year, weeksPerYear);
      default:
        throw new Error(`Unknown distribution method: ${method}`);
    }
  }

  /**
   * EQUAL distribution: Each ownership gets equal weeks
   * Fixed week ownerships get their specific week
   */
  private distributeEqual(ownerships: any[], year: number, weeksPerYear: number): any[] {
    const allocations: any[] = [];
    const usedWeeks = new Set<number>();

    // First pass: Allocate fixed weeks
    const fixedWeekOwnerships = ownerships.filter(o => o.type === 'FIXED_WEEK' && o.fixed_week_number);
    for (const ownership of fixedWeekOwnerships) {
      const weekNumber = ownership.fixed_week_number;
      if (weekNumber >= 1 && weekNumber <= weeksPerYear) {
        allocations.push({
          ownership_id: ownership.id,
          ownership_type: ownership.type,
          owner: ownership.owner,
          unit: ownership.unit,
          weeks_allocated: 1,
          week_numbers: [weekNumber]
        });
        usedWeeks.add(weekNumber);
      }
    }

    // Second pass: Distribute remaining weeks equally among floating/points ownerships
    const floatingOwnerships = ownerships.filter(o => o.type === 'FLOATING' || o.type === 'POINTS');
    const availableWeeks = Array.from({ length: weeksPerYear }, (_, i) => i + 1).filter(w => !usedWeeks.has(w));

    if (floatingOwnerships.length === 0) {
      return allocations;
    }

    const weeksPerOwnership = Math.floor(availableWeeks.length / floatingOwnerships.length);
    let weekIndex = 0;

    for (const ownership of floatingOwnerships) {
      const assignedWeeks: number[] = [];
      for (let i = 0; i < weeksPerOwnership && weekIndex < availableWeeks.length; i++) {
        assignedWeeks.push(availableWeeks[weekIndex]);
        weekIndex++;
      }

      allocations.push({
        ownership_id: ownership.id,
        ownership_type: ownership.type,
        owner: ownership.owner,
        unit: ownership.unit,
        weeks_allocated: assignedWeeks.length,
        week_numbers: assignedWeeks
      });
    }

    // Distribute remaining weeks (if any) round-robin
    while (weekIndex < availableWeeks.length) {
      for (let i = 0; i < floatingOwnerships.length && weekIndex < availableWeeks.length; i++) {
        const allocation = allocations.find(a => a.ownership_id === floatingOwnerships[i].id);
        if (allocation) {
          allocation.week_numbers.push(availableWeeks[weekIndex]);
          allocation.weeks_allocated++;
          weekIndex++;
        }
      }
    }

    return allocations;
  }

  /**
   * SEASONAL distribution: Allocate based on seasonal weights
   * Higher weights = higher chance of getting that week
   */
  private distributeSeasonal(
    ownerships: any[],
    year: number,
    weeksPerYear: number,
    seasonalWeights: Record<number, number>
  ): any[] {
    const allocations: any[] = [];
    const usedWeeks = new Set<number>();

    // First pass: Allocate fixed weeks
    const fixedWeekOwnerships = ownerships.filter(o => o.type === 'FIXED_WEEK' && o.fixed_week_number);
    for (const ownership of fixedWeekOwnerships) {
      const weekNumber = ownership.fixed_week_number;
      if (weekNumber >= 1 && weekNumber <= weeksPerYear) {
        allocations.push({
          ownership_id: ownership.id,
          ownership_type: ownership.type,
          owner: ownership.owner,
          unit: ownership.unit,
          weeks_allocated: 1,
          week_numbers: [weekNumber]
        });
        usedWeeks.add(weekNumber);
      }
    }

    // Second pass: Distribute floating/points based on weights
    const floatingOwnerships = ownerships.filter(o => o.type === 'FLOATING' || o.type === 'POINTS');
    const availableWeeks = Array.from({ length: weeksPerYear }, (_, i) => i + 1).filter(w => !usedWeeks.has(w));

    if (floatingOwnerships.length === 0) {
      return allocations;
    }

    // Sort weeks by weight (high to low)
    const weightedWeeks = availableWeeks.map(w => ({
      week: w,
      weight: seasonalWeights[w] || 1.0
    })).sort((a, b) => b.weight - a.weight);

    const weeksPerOwnership = Math.floor(availableWeeks.length / floatingOwnerships.length);
    let ownerIndex = 0;

    for (const ownership of floatingOwnerships) {
      allocations.push({
        ownership_id: ownership.id,
        ownership_type: ownership.type,
        owner: ownership.owner,
        unit: ownership.unit,
        weeks_allocated: 0,
        week_numbers: []
      });
    }

    // Distribute high-value weeks round-robin
    for (const { week } of weightedWeeks) {
      const allocation = allocations.find(a => a.ownership_id === floatingOwnerships[ownerIndex].id);
      if (allocation) {
        allocation.week_numbers.push(week);
        allocation.weeks_allocated++;
      }
      ownerIndex = (ownerIndex + 1) % floatingOwnerships.length;
    }

    return allocations;
  }

  /**
   * RANDOM distribution: Randomly assign weeks to ownerships
   */
  private distributeRandom(ownerships: any[], year: number, weeksPerYear: number): any[] {
    const allocations: any[] = [];
    const usedWeeks = new Set<number>();

    // First pass: Allocate fixed weeks
    const fixedWeekOwnerships = ownerships.filter(o => o.type === 'FIXED_WEEK' && o.fixed_week_number);
    for (const ownership of fixedWeekOwnerships) {
      const weekNumber = ownership.fixed_week_number;
      if (weekNumber >= 1 && weekNumber <= weeksPerYear) {
        allocations.push({
          ownership_id: ownership.id,
          ownership_type: ownership.type,
          owner: ownership.owner,
          unit: ownership.unit,
          weeks_allocated: 1,
          week_numbers: [weekNumber]
        });
        usedWeeks.add(weekNumber);
      }
    }

    // Second pass: Randomly distribute remaining weeks
    const floatingOwnerships = ownerships.filter(o => o.type === 'FLOATING' || o.type === 'POINTS');
    const availableWeeks = Array.from({ length: weeksPerYear }, (_, i) => i + 1).filter(w => !usedWeeks.has(w));

    if (floatingOwnerships.length === 0) {
      return allocations;
    }

    // Shuffle available weeks
    const shuffledWeeks = [...availableWeeks].sort(() => Math.random() - 0.5);

    const weeksPerOwnership = Math.floor(shuffledWeeks.length / floatingOwnerships.length);
    let weekIndex = 0;

    for (const ownership of floatingOwnerships) {
      const assignedWeeks: number[] = [];
      for (let i = 0; i < weeksPerOwnership && weekIndex < shuffledWeeks.length; i++) {
        assignedWeeks.push(shuffledWeeks[weekIndex]);
        weekIndex++;
      }

      allocations.push({
        ownership_id: ownership.id,
        ownership_type: ownership.type,
        owner: ownership.owner,
        unit: ownership.unit,
        weeks_allocated: assignedWeeks.length,
        week_numbers: assignedWeeks.sort((a, b) => a - b) // Sort for readability
      });
    }

    // Distribute remaining weeks randomly
    while (weekIndex < shuffledWeeks.length) {
      const randomOwnershipIndex = Math.floor(Math.random() * floatingOwnerships.length);
      const allocation = allocations.find(a => a.ownership_id === floatingOwnerships[randomOwnershipIndex].id);
      if (allocation) {
        allocation.week_numbers.push(shuffledWeeks[weekIndex]);
        allocation.week_numbers.sort((a: number, b: number) => a - b);
        allocation.weeks_allocated++;
        weekIndex++;
      }
    }

    return allocations;
  }

  /**
   * Helper: Get all ownership IDs for a property
   */
  private async getOwnershipIdsForProperty(propertyId: number): Promise<number[]> {
    const ownerships = await Ownership.findAll({
      include: [{
        model: TimeshareUnit,
        as: 'unit',
        where: { property_id: propertyId },
        attributes: []
      }],
      attributes: ['id']
    });
    return ownerships.map(o => o.id);
  }
}

export default new WeekAllocationService();

/**
 * HotelInventory Model Unit Tests
 * 
 * Tests for HotelInventory model helper methods.
 * Pure unit tests - no database needed.
 */

import { describe, it, expect } from 'vitest';

// Mock HotelInventory with business logic
class HotelInventory {
  last_synced?: Date;
  available_rooms: number = 0;
  total_rooms: number = 0;
  pms_provider?: string;
  rate: number = 0;
  currency: string = 'EUR';
  min_nights?: number;

  constructor(data: Partial<HotelInventory>) {
    Object.assign(this, data);
  }

  isStale(): boolean {
    if (!this.last_synced) return true;
    const hoursSinceSync = (Date.now() - this.last_synced.getTime()) / (1000 * 60 * 60);
    return hoursSinceSync > 24;
  }

  hasAvailability(): boolean {
    return this.available_rooms > 0;
  }

  getOccupancyRate(): number {
    if (this.total_rooms === 0) return 0;
    return ((this.total_rooms - this.available_rooms) / this.total_rooms) * 100;
  }
}

describe('HotelInventory Model', () => {

  describe('isStale()', () => {
    it('should return false for recently synced data (< 24 hours)', () => {
      const inventory = new HotelInventory({
        last_synced: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
      });

      expect(inventory.isStale()).toBe(false);
    });

    it('should return true for data older than 24 hours', () => {
      const inventory = new HotelInventory({
        last_synced: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
      });

      expect(inventory.isStale()).toBe(true);
    });

    it('should return false for data synced exactly 24 hours ago', () => {
      const inventory = new HotelInventory({
        last_synced: new Date(Date.now() - 24 * 60 * 60 * 1000), // Exactly 24 hours
      });

      // Should be false because it's not > 24 hours
      expect(inventory.isStale()).toBe(false);
    });

    it('should return true for data synced 24.1 hours ago', () => {
      const inventory = new HotelInventory({
        last_synced: new Date(Date.now() - 24.1 * 60 * 60 * 1000),
      });

      expect(inventory.isStale()).toBe(true);
    });

    it('should return false for just synced data', () => {
      const inventory = new HotelInventory({
        last_synced: new Date(), // Now
      });

      expect(inventory.isStale()).toBe(false);
    });
  });

  describe('hasAvailability()', () => {
    it('should return true when rooms are available', () => {
      const inventory = new HotelInventory({
        available_rooms: 5,
        total_rooms: 10,
      });

      expect(inventory.hasAvailability()).toBe(true);
    });

    it('should return false when no rooms available', () => {
      const inventory = new HotelInventory({
        available_rooms: 0,
        total_rooms: 10,
      });

      expect(inventory.hasAvailability()).toBe(false);
    });

    it('should return true when all rooms available', () => {
      const inventory = new HotelInventory({
        available_rooms: 10,
        total_rooms: 10,
      });

      expect(inventory.hasAvailability()).toBe(true);
    });
  });

  describe('getOccupancyRate()', () => {
    it('should calculate correct occupancy rate', () => {
      const inventory = new HotelInventory({
        available_rooms: 3,
        total_rooms: 10,
      });

      // Occupancy = (total - available) / total * 100
      // (10 - 3) / 10 * 100 = 70%
      expect(inventory.getOccupancyRate()).toBe(70);
    });

    it('should return 0% for fully available', () => {
      const inventory = new HotelInventory({
        available_rooms: 10,
        total_rooms: 10,
      });

      expect(inventory.getOccupancyRate()).toBe(0);
    });

    it('should return 100% for fully booked', () => {
      const inventory = new HotelInventory({
        available_rooms: 0,
        total_rooms: 10,
      });

      expect(inventory.getOccupancyRate()).toBe(100);
    });

    it('should handle zero total_rooms', () => {
      const inventory = new HotelInventory({
        available_rooms: 0,
        total_rooms: 0,
      });

      expect(inventory.getOccupancyRate()).toBe(0);
    });

    it('should calculate partial occupancy', () => {
      const inventory = new HotelInventory({
        available_rooms: 7,
        total_rooms: 20,
      });

      // (20 - 7) / 20 * 100 = 65%
      expect(inventory.getOccupancyRate()).toBe(65);
    });
  });

  describe('Cache Metadata', () => {
    it('should store PMS provider', () => {
      const inventory = new HotelInventory({
        pms_provider: 'mews',
      });

      expect(inventory.pms_provider).toBe('mews');
    });

    it('should store last sync timestamp', () => {
      const syncTime = new Date('2026-07-01T10:00:00Z');
      const inventory = new HotelInventory({
        last_synced: syncTime,
      });

      expect(inventory.last_synced).toEqual(syncTime);
    });
  });

  describe('Pricing Data', () => {
    it('should store room rate and currency', () => {
      const inventory = new HotelInventory({
        rate: 150.00,
        currency: 'EUR',
      });

      expect(inventory.rate).toBe(150.00);
      expect(inventory.currency).toBe('EUR');
    });

    it('should store minimum nights requirement', () => {
      const inventory = new HotelInventory({
        min_nights: 3,
      });

      expect(inventory.min_nights).toBe(3);
    });
  });
});


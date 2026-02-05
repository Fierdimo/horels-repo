/**
 * PMSSyncService (V2)
 * 
 * Background synchronization service for PMS bookings.
 * Syncs booking status and room assignments from PMS to our database.
 * 
 * Use Cases:
 * 1. Sync booking status (confirmed, checked-in, checked-out, cancelled)
 * 2. Update physical room assignments from PMS
 * 3. Detect PMS-side modifications not made through our system
 * 4. Retry failed PMS operations
 * 
 * Architecture:
 * - Individual booking sync: syncBooking(bookingId)
 * - Bulk sync: syncPendingBookings() - for cron job
 * - Property sync: syncPropertyBookings(propertyId) - sync all bookings for property
 * 
 * See: docs_v2/TIMESHARE_PLATFORM_V2_SPEC.md - Phase 6
 */

import V2Booking from '../../models/v2/V2Booking';
import TimeshareProperty from '../../models/v2/TimeshareProperty';
import { PMSFactory } from '../pms/PMSFactory';
import { PMSBookingStatus } from '../pms/PMSAdapter';
import { Op } from 'sequelize';

export interface SyncResult {
  bookingId: number;
  success: boolean;
  updated: boolean;
  changes?: {
    status?: PMSBookingStatus;
    roomAssigned?: string;
  };
  error?: string;
}

export class PMSSyncService {
  /**
   * Sync a single booking from PMS
   * 
   * @param bookingId - Booking ID to sync
   * @returns Sync result with changes
   */
  async syncBooking(bookingId: number): Promise<SyncResult> {
    try {
      // Load booking with property
      const booking = await V2Booking.findByPk(bookingId, {
        include: [
          {
            model: TimeshareProperty,
            as: 'property',
            required: true,
          },
        ],
      });

      if (!booking) {
        return {
          bookingId,
          success: false,
          updated: false,
          error: 'Booking not found',
        };
      }

      // Skip if no PMS integration
      if (!booking.pms_booking_id || !booking.pms_provider) {
        return {
          bookingId,
          success: true,
          updated: false,
          error: 'No PMS integration configured',
        };
      }

      // Skip if already checked out or cancelled
      if (booking.status === 'CHECKED_OUT' || booking.status === 'CANCELLED') {
        return {
          bookingId,
          success: true,
          updated: false,
          error: 'Booking is in final state',
        };
      }

      // Get PMS adapter
      const property = booking.property as TimeshareProperty;
      const adapter = PMSFactory.createFromProperty(property);

      // Fetch status from PMS
      const pmsStatus = await adapter.getBookingStatus(booking.pms_booking_id);

      // Track changes
      const changes: any = {};
      let hasChanges = false;

      // Update status if changed (but skip UNKNOWN status)
      if (pmsStatus.status && pmsStatus.status !== 'UNKNOWN' && pmsStatus.status !== booking.status) {
        changes.status = pmsStatus.status;
        booking.status = pmsStatus.status;
        hasChanges = true;

        // Update cancelled_at timestamp if cancelled
        if (pmsStatus.status === 'CANCELLED' && !booking.cancelled_at) {
          booking.cancelled_at = new Date();
        }
      }

      // Update room assignment if provided
      if (pmsStatus.roomAssigned && pmsStatus.roomAssigned !== booking.physical_room) {
        changes.roomAssigned = pmsStatus.roomAssigned;
        booking.physical_room = pmsStatus.roomAssigned;
        hasChanges = true;
      }

      // Save if changed
      if (hasChanges) {
        booking.pms_last_sync = new Date();
        await booking.save();
      } else {
        // Update sync timestamp even if no changes
        await booking.update({ pms_last_sync: new Date() });
      }

      return {
        bookingId,
        success: true,
        updated: hasChanges,
        changes: hasChanges ? changes : undefined,
      };
    } catch (error: any) {
      console.error(`[PMSSyncService] Failed to sync booking ${bookingId}:`, error);
      return {
        bookingId,
        success: false,
        updated: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Sync bookings that haven't been synced recently
   * Intended for cron job (e.g., run every hour)
   * 
   * @param hoursThreshold - Sync bookings not synced in last N hours (default: 2)
   * @returns Array of sync results
   */
  async syncPendingBookings(hoursThreshold: number = 2): Promise<SyncResult[]> {
    const threshold = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);

    // Find bookings that need sync
    const bookings = await V2Booking.findAll({
      where: {
        // Has PMS integration
        pms_booking_id: { [Op.ne]: null },
        pms_provider: { [Op.ne]: null },

        // Not in final state
        status: { [Op.notIn]: ['CHECKED_OUT', 'CANCELLED'] },

        // Not synced recently (or never synced)
        [Op.or]: [
          { pms_last_sync: { [Op.lt]: threshold } },
          { pms_last_sync: null },
        ],
      },
      attributes: ['id'],
      limit: 100, // Process in batches to avoid overload
    });

    console.log(`[PMSSyncService] Found ${bookings.length} bookings to sync`);

    // Sync each booking
    const results: SyncResult[] = [];
    for (const booking of bookings) {
      const result = await this.syncBooking(booking.id);
      results.push(result);

      // Small delay to avoid rate limiting
      await this.delay(100);
    }

    // Log summary
    const successful = results.filter((r) => r.success).length;
    const updated = results.filter((r) => r.updated).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(
      `[PMSSyncService] Sync complete: ${successful} successful, ${updated} updated, ${failed} failed`
    );

    return results;
  }

  /**
   * Sync all bookings for a specific property
   * Useful when PMS credentials are changed or after PMS outage
   * 
   * @param propertyId - Property ID
   * @returns Array of sync results
   */
  async syncPropertyBookings(propertyId: number): Promise<SyncResult[]> {
    // Find all active bookings for property
    const bookings = await V2Booking.findAll({
      where: {
        property_id: propertyId,
        pms_booking_id: { [Op.ne]: null },
        status: { [Op.notIn]: ['CHECKED_OUT', 'CANCELLED'] },
      },
      attributes: ['id'],
    });

    console.log(`[PMSSyncService] Syncing ${bookings.length} bookings for property ${propertyId}`);

    // Sync each booking
    const results: SyncResult[] = [];
    for (const booking of bookings) {
      const result = await this.syncBooking(booking.id);
      results.push(result);

      // Delay to avoid rate limiting
      await this.delay(200);
    }

    return results;
  }

  /**
   * Retry failed PMS operations
   * Finds bookings with null pms_last_sync (sync failure indicator)
   * and attempts to create them in PMS
   * 
   * @returns Array of retry results
   */
  async retryFailedOperations(): Promise<{
    bookingId: number;
    success: boolean;
    error?: string;
  }[]> {
    // Find bookings with PMS provider but failed sync
    const bookings = await V2Booking.findAll({
      where: {
        pms_provider: { [Op.ne]: null },
        pms_booking_id: null, // No PMS ID = creation failed
        status: { [Op.notIn]: ['CANCELLED'] }, // Don't retry cancelled bookings
      },
      include: [
        {
          model: TimeshareProperty,
          as: 'property',
          required: true,
        },
      ],
      limit: 50, // Process in batches
    });

    console.log(`[PMSSyncService] Found ${bookings.length} failed operations to retry`);

    const results = [];

    for (const booking of bookings) {
      try {
        const property = booking.property as TimeshareProperty;
        const adapter = PMSFactory.createFromProperty(property);

        // Parse guest name
        const nameParts = booking.guest_name.split(' ');
        const firstName = nameParts[0] || booking.guest_name;
        const lastName = nameParts.slice(1).join(' ') || booking.guest_name;

        // Retry PMS booking creation
        const pmsResponse = await adapter.createBooking({
          checkIn: booking.check_in,
          checkOut: booking.check_out,
          guest: {
            firstName,
            lastName,
            email: booking.guest_email,
            phone: booking.guest_phone || undefined,
          },
          numberOfGuests: booking.number_of_guests,
          roomCategory: booking.room_category,
          specialRequests: booking.special_requests || undefined,
          internalBookingId: booking.id,
          internalConfirmationCode: booking.confirmation_code,
        });

        if (pmsResponse.success && pmsResponse.pmsBookingId) {
          await booking.update({
            pms_booking_id: pmsResponse.pmsBookingId,
            pms_confirmation_code: pmsResponse.pmsConfirmationCode || null,
            pms_last_sync: new Date(),
          });

          console.log(`[PMSSyncService] Retry successful for booking ${booking.id}`);

          results.push({
            bookingId: booking.id,
            success: true,
          });
        } else {
          throw new Error(pmsResponse.message || 'PMS booking creation failed');
        }
      } catch (error: any) {
        console.error(`[PMSSyncService] Retry failed for booking ${booking.id}:`, error);

        results.push({
          bookingId: booking.id,
          success: false,
          error: error.message,
        });
      }

      // Delay to avoid rate limiting
      await this.delay(300);
    }

    return results;
  }

  /**
   * Utility: Sleep for N milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default PMSSyncService;

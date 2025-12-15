import { PmsAdapter } from './pmsAdapterInterface';
import PmsApiService from '../pmsApiService';
import PmsMockService from '../pmsMockService';
import { PmsAvailability } from '../pmsMockService';

export default class CloudbedsAdapter implements PmsAdapter {
  private api: PmsApiService;
  private useReal: boolean;

  constructor() {
    this.api = new PmsApiService();
    this.useReal = (process.env.USE_REAL_PMS || 'false').toLowerCase() === 'true';
  }

  async checkAvailability(propertyId: number, startDate: string, endDate: string, requiredNights: number): Promise<PmsAvailability> {
    if (!this.useReal) {
      return PmsMockService.checkAvailability(propertyId, startDate, endDate, requiredNights);
    }

    // Cloudbeds might return a nested object; normalize to PmsAvailability
    const res = await this.api.checkAvailability(propertyId, startDate, endDate, requiredNights);
    return { available: Boolean(res.available), availableNights: Number(res.availableNights || 0), reason: res.reason };
  }

  async createBooking(payload: { propertyId: number; guestName: string; guestEmail: string; checkIn: string; checkOut: string; roomType?: string; nights?: number }) {
    if (!this.useReal) {
      return (PmsMockService as any).createBooking(payload);
    }

    const res = await this.api.createBooking({
      propertyId: payload.propertyId,
      guestName: payload.guestName,
      guestEmail: payload.guestEmail,
      checkIn: payload.checkIn,
      checkOut: payload.checkOut,
      roomType: payload.roomType,
      nights: payload.nights
    });

    // `res` may be different shapes depending on provider; cast to `any` when
    // checking alternate fields to avoid TypeScript errors in the common codepath.
    const r: any = res;
    return { provider: 'cloudbeds', pmsBookingId: String(r.pmsBookingId || r.bookingId || r.id), status: r.status || 'confirmed' };
  }
}

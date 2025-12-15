import { PmsAvailability } from './pmsMockService';

type PmsApiOptions = {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  maxRetries?: number;
};

export default class PmsApiService {
  private baseUrl: string;
  private apiKey?: string;
  private timeoutMs: number;
  private maxRetries: number;

  constructor(options: PmsApiOptions = {}) {
    this.baseUrl = options.baseUrl || process.env.PMS_BASE_URL || '';
    this.apiKey = options.apiKey || process.env.PMS_API_KEY;
    this.timeoutMs = options.timeoutMs ? options.timeoutMs : Number(process.env.PMS_TIMEOUT_MS) || 5000;
    this.maxRetries = options.maxRetries ? options.maxRetries : Number(process.env.PMS_MAX_RETRIES) || 2;
  }

  // Performs a simple availability check against the PMS.
  // This implementation expects the PMS to expose a REST API like:
  // GET {baseUrl}/availability?propertyId=...&start=...&end=...
  // Returns a PmsAvailability object.
  async checkAvailability(propertyId: number, startDate: string, endDate: string, requiredNights: number): Promise<PmsAvailability> {
    if (!this.baseUrl) {
      throw new Error('PMS base URL not configured (PMS_BASE_URL)');
    }

    const url = new URL('/availability', this.baseUrl);
    url.searchParams.set('propertyId', String(propertyId));
    url.searchParams.set('start', startDate);
    url.searchParams.set('end', endDate);
    url.searchParams.set('nights', String(requiredNights));

    let attempt = 0;
    while (attempt <= this.maxRetries) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        const headers: Record<string, string> = { 'Accept': 'application/json' };
        if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

        const resp = await fetch(url.toString(), { method: 'GET', headers, signal: controller.signal });
        clearTimeout(timeout);

        if (!resp.ok) {
          const txt = await resp.text().catch(() => '');
          throw new Error(`PMS responded ${resp.status}: ${txt}`);
        }

        const body = await resp.json() as any;

        // Map expected response shape into PmsAvailability.
        // Support two common shapes: { available: boolean, availableNights: number }
        // or { availability: { nights: number } }
        if (typeof body.available === 'boolean' && typeof body.availableNights === 'number') {
          return { available: body.available, availableNights: body.availableNights, reason: body.reason };
        }

        if (body && body.availability && typeof body.availability.nights === 'number') {
          const availableNights = body.availability.nights;
          return { available: availableNights >= requiredNights, availableNights, reason: body.availability.reason };
        }

        // Fallback conservative mapping
        const nights = Number(body.availableNights ?? body.nights ?? 0);
        return { available: nights >= requiredNights, availableNights: nights, reason: 'mapped' };
      } catch (err: any) {
        attempt += 1;
        if (attempt > this.maxRetries) throw err;
        // Wait a little before retrying
        await new Promise(r => setTimeout(r, 200 * attempt));
      }
    }

    // Should not reach here
    return { available: false, availableNights: 0, reason: 'unreachable' };
  }

  async createBooking(payload: { propertyId: number; guestName: string; guestEmail: string; checkIn: string; checkOut: string; roomType?: string; nights?: number }) {
    if (!this.baseUrl) throw new Error('PMS base URL not configured (PMS_BASE_URL)');

    const path = '/bookings';
    const url = new URL(path, this.baseUrl);

    const body = {
      propertyId: payload.propertyId,
      guestName: payload.guestName,
      guestEmail: payload.guestEmail,
      checkIn: payload.checkIn,
      checkOut: payload.checkOut,
      roomType: payload.roomType,
      nights: payload.nights
    };

    let attempt = 0;
    while (attempt <= this.maxRetries) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
        if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

        const resp = await fetch(url.toString(), { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
        clearTimeout(timeout);

        if (!resp.ok) {
          const txt = await resp.text().catch(() => '');
          throw new Error(`PMS create booking responded ${resp.status}: ${txt}`);
        }

        const json = await resp.json() as any;
        // Map common response
        return { provider: 'pms', pmsBookingId: String(json.id || json.bookingId || json.reference), status: json.status || 'confirmed' };
      } catch (err: any) {
        attempt += 1;
        if (attempt > this.maxRetries) throw err;
        await new Promise(r => setTimeout(r, 200 * attempt));
      }
    }

    return { provider: 'pms', pmsBookingId: '', status: 'failed' };
  }
}

export type PmsAvailability = {
  available: boolean;
  availableNights: number;
  reason?: string;
};

export default class PmsMockService {
  // Deterministic mock behavior based on propertyId to make tests predictable.
  // - propertyId % 3 === 0 => no availability
  // - propertyId % 3 === 1 => full availability
  // - propertyId % 3 === 2 => partial availability (half of requested nights)
  static async checkAvailability(
    propertyId: number,
    startDate: string,
    endDate: string,
    requiredNights: number
  ): Promise<PmsAvailability> {
    const mode = propertyId % 3;

    if (mode === 0) {
      return { available: false, availableNights: 0, reason: 'no_availability' };
    }

    if (mode === 1) {
      return { available: true, availableNights: requiredNights };
    }

    // partial
    const availableNights = Math.max(0, Math.floor(requiredNights / 2));
    return { available: availableNights >= requiredNights, availableNights, reason: 'partial' };
  }

  static async createBooking(payload: { propertyId: number; guestName: string; guestEmail: string; checkIn: string; checkOut: string; roomType?: string; nights?: number }) {
    // Create a deterministic mock booking id
    const id = `mock-booking-${payload.propertyId}-${Date.now()}`;
    return { provider: 'mock', pmsBookingId: id, status: 'confirmed' };
  }

  // Provide mock catalog/configuration endpoints used by the scanner and tests
  static async configurationGet() {
    return {
      Client: 'SW2-Connector-Mock',
      EnterpriseId: 'mock-enterprise',
      DefaultServiceId: 'mock-service-01'
    };
  }

  static async servicesGetAll() {
    // Return a small deterministic list of services for scanning/tests
    return {
      Services: [
        { Id: 'mock-service-01', ExternalIdentifier: 'Accommodation', Name: 'Mock Accommodation' },
        { Id: 'mock-service-02', ExternalIdentifier: 'ExtraNight', Name: 'Mock Extra Night' }
      ]
    };
  }

  static async ratesGetAll() {
    return {
      Rates: [
        { Id: 'mock-rate-default', ServiceId: 'mock-service-01', Name: 'Default Rate' },
        { Id: 'mock-rate-extra', ServiceId: 'mock-service-02', Name: 'Extra Rate' }
      ]
    };
  }

  static async resourcesGetAll() {
    return {
      Resources: [
        { Id: 'mock-resource-room', ServiceId: 'mock-service-01', Name: 'Room A' }
      ]
    };
  }

  // Minimal price simulation matching shapes used by controllers/tests
  static async priceReservation(payload: any) {
    const svc = payload?.Reservations?.[0]?.ServiceId || payload?.ServiceId || '';
    if (!svc || String(svc).toLowerCase().includes('invalid')) {
      return { success: false, reason: 'Invalid ServiceId' };
    }

    // Simple deterministic pricing: base 100 EUR per reservation
    const total = 100.0;
    return { success: true, total, currency: 'EUR' };
  }

  // Add reservation (connector style) - returns simplified reservation id
  static async addReservation(payload: any) {
    // Respect peak date restrictions if configured via MEWS_PEAK_DATES env
    try {
      const peakEnv = process.env.MEWS_PEAK_DATES || '';
      if (peakEnv.trim().length > 0) {
        const ranges = peakEnv.split(',').map(s => s.trim()).filter(Boolean);
        const res = payload?.Reservations?.[0] || {};
        const start = new Date(res.StartUtc || res.Start || Date.now());
        const end = new Date(res.EndUtc || res.End || Date.now());
        for (const r of ranges) {
          const [a, b] = r.split(':').map(x => x && x.trim());
          if (!a || !b) continue;
          const ra = new Date(a);
          const rb = new Date(b);
          if (start <= rb && end >= ra) {
            return { success: false, reason: 'peak_period_restriction' };
          }
        }
      }
    } catch (e) {
      // ignore parsing errors and proceed
    }

    const reservationId = 'mock-RES-' + Math.random().toString(36).slice(2, 10).toUpperCase();

    // Simulate night credit application and swap preauth metadata
    const meta = payload?.Metadata || {};
    const response: any = { success: true, reservationId };
    if (meta.NightCreditId) {
      response.appliedNightCredit = { id: meta.NightCreditId, nightsUsed: 1 };
    }
    if (meta.SwapRequestId) {
      // simulate swap fee pre-authorization id
      response.swapPreauth = { id: `preauth-${Math.random().toString(36).slice(2, 8)}`, amount: 10, currency: 'EUR' };
    }

    return response;
  }

  static async cancelReservation(reservationId: string) {
    // Always succeed in the mock
    return { success: true, reservationId };
  }

  static async getReservation(reservationId: string) {
    return { reservationId, status: 'cancelled', provider: 'mock' };
  }
}

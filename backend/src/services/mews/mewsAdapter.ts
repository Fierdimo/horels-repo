import { IPMSAdapter } from '../pms/PMSFactory';

export type PriceResult = {
  success: boolean
  total?: number
  currency?: string
  reason?: string
}

export type AddResult = {
  success: boolean
  reservationId?: string
  reason?: string
}

export interface IMewsAdapter extends IPMSAdapter {
  priceReservation(payload: any): Promise<PriceResult>
  addReservation(payload: any): Promise<AddResult>
}

// Minimal mock adapter usable in tests and dev. In real mode this should call Mews API.
export class MockMewsAdapter implements IMewsAdapter {
  private propertyId?: string;

  setPropertyId(propertyId: string): void {
    this.propertyId = propertyId;
  }

  getPropertyId(): string | undefined {
    return this.propertyId;
  }

  async testConnection(): Promise<{ success: boolean; error?: string; propertyInfo?: any }> {
    return { 
      success: true,
      propertyInfo: {
        id: this.propertyId,
        name: 'Mock Mews Property'
      }
    };
  }

  async getAvailability(params: any): Promise<any> {
    return {
      spaces: [
        {
          id: 'space-1',
          name: 'Standard Room',
          available: true,
          price: 100
        }
      ]
    };
  }

  async getBookings(params: any): Promise<any> {
    return [];
  }

  async updateBooking(bookingId: string, params: any): Promise<any> {
    return {
      id: bookingId,
      status: 'updated',
      ...params
    };
  }

  async cancelBooking(bookingId: string): Promise<any> {
    return {
      id: bookingId,
      status: 'cancelled'
    };
  }

  async getPropertyInfo(propertyId?: string): Promise<any> {
    // En Mews, la información de property viene del Enterprise
    // Por ahora retornamos info básica del demo
    return {
      success: true,
      data: {
        propertyId: propertyId || this.propertyId || 'mews-demo-property',
        name: 'Mews Demo Hotel',
        address: 'Demo Street 123',
        city: 'Prague',
        country: 'Czech Republic',
        timezone: 'Europe/Prague',
        description: 'Mews Demo Property for testing'
      }
    };
  }

  async priceReservation(payload: any): Promise<PriceResult> {
    // simple heuristics: if ServiceId contains 'invalid' -> fail
    const svc = payload?.Reservations?.[0]?.ServiceId || ''
    if (!svc || svc.toString().toLowerCase().includes('invalid')) {
      return { success: false, reason: 'Invalid ServiceId' }
    }
    // return a deterministic price
    return { success: true, total: 100.0, currency: 'EUR' }
  }

  async resourceCategoryImageAssignmentsGetAll() {
    return {
      ResourceCategoryImageAssignments: []
    };
  }

  async resourceCategoryAssignmentsGetAll() {
    return {
      ResourceCategoryAssignments: []
    };
  }

  async imagesGetUrls(imageIds: string[]) {
    return {
      ImageUrls: []
    };
  }

  async addReservation(payload: any): Promise<AddResult> {
    // simulate creation
    const reservationId = 'RES-' + Math.random().toString(36).slice(2, 10).toUpperCase()
    return { success: true, reservationId }
  }

  async createBooking(payload: any): Promise<any> {
    return this.addReservation(payload);
  }
}

// note: intentionally no default export here; export named adapters for clarity
import TokenManager from './tokenManager';

type AvailabilityResponse = any;
type BookingResponse = any;

export class MewsAdapter implements IMewsAdapter {
  private tokenManager: TokenManager;
  private propertyId?: string;
  private credentials: any;

  constructor(credentials?: any, opts?: { tokenManager?: TokenManager }) {
    this.credentials = credentials || {};
    this.tokenManager = opts?.tokenManager ?? new TokenManager({
      clientToken: credentials?.clientToken || process.env.MEWS_CLIENT_TOKEN,
      accessToken: credentials?.accessToken || process.env.MEWS_ACCESS_TOKEN
    });
  }

  setPropertyId(propertyId: string): void {
    this.propertyId = propertyId;
  }

  getPropertyId(): string | undefined {
    return this.propertyId;
  }

  async testConnection(): Promise<{ success: boolean; error?: string; propertyInfo?: any }> {
    try {
      const config = await this.configurationGet();
      return {
        success: true,
        propertyInfo: {
          id: config?.Enterprise?.Id,
          name: config?.Enterprise?.Name
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Connection failed'
      };
    }
  }

  async getAvailability(params: any): Promise<any> {
    // Get services (room types), rates, and resources (rooms)
    const [services, rates, resources] = await Promise.all([
      this.servicesGetAll(),
      this.ratesGetAll(),
      this.resourcesGetAll()
    ]);

    return {
      services: services?.Services || [],
      rates: rates?.Rates || [],
      resources: resources?.Resources || []
    };
  }

  async getBookings(params: any): Promise<any> {
    // TODO: Implement with reservations/getAll endpoint
    return [];
  }

  async updateBooking(bookingId: string, params: any): Promise<any> {
    // TODO: Implement with reservations/update endpoint
    throw new Error('Update booking not yet implemented for Mews');
  }

  async cancelBooking(bookingId: string): Promise<any> {
    return this.cancelReservation(bookingId);
  }

  async getPropertyInfo(propertyId?: string): Promise<any> {
    try {
      const config = await this.configurationGet();
      return {
        success: true,
        data: {
          propertyId: config?.Enterprise?.Id || propertyId || this.propertyId,
          name: config?.Enterprise?.Name || 'Mews Property',
          address: config?.Enterprise?.Address?.Line1 || '',
          city: config?.Enterprise?.Address?.City || '',
          country: config?.Enterprise?.Address?.CountryCode || '',
          timezone: config?.Enterprise?.TimeZoneId || 'UTC',
          description: `${config?.Enterprise?.Name || 'Property'} managed via Mews PMS`
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to get property info from Mews'
      };
    }
  }

  async priceReservation(payload: any): Promise<PriceResult> {
    const result = await this.fetchWithAuth('/api/connector/v1/reservations/price', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    return {
      success: true,
      total: result?.TotalAmount?.Value,
      currency: result?.TotalAmount?.Currency
    };
  }

  async addReservation(payload: any): Promise<AddResult> {
    const result = await this.createBooking(payload);
    return {
      success: true,
      reservationId: result?.Reservations?.[0]?.Id
    };
  }

  // fetch wrapper that merges connector tokens into JSON body when present
  private async fetchWithAuth(path: string, options: RequestInit = {}) {
    const base = process.env.MEWS_BASE_URL ?? 'https://api.mews-demo.com';
    // merge tokens into body JSON
    // Prefer getting auth headers (tests often stub `getAuthHeaders`). If
    // unavailable, fall back to raw tokens via `getTokens()`.
    let tokens: any = { ClientToken: '', AccessToken: '' };
    if (typeof (this.tokenManager as any).getAuthHeaders === 'function') {
      try {
        const headers = await (this.tokenManager as any).getAuthHeaders();
        // headers may include ClientToken/AccessToken or Authorization
        if (headers) {
          tokens.ClientToken = headers.ClientToken || '';
          if (headers.AccessToken) tokens.AccessToken = headers.AccessToken;
          else if (headers.Authorization && String(headers.Authorization).toLowerCase().startsWith('bearer ')) {
            tokens.AccessToken = String(headers.Authorization).slice(7);
          }
        }
      } catch (e) {
        // ignore and fall back
      }
    }
    if (!tokens.ClientToken && !tokens.AccessToken) {
      try {
        tokens = await this.tokenManager.getTokens();
      } catch (e) {
        tokens = { ClientToken: '', AccessToken: '' };
      }
    }
    let bodyObj: any = null
    if (options.body) {
      try {
        bodyObj = typeof options.body === 'string' ? JSON.parse(options.body as string) : options.body
      } catch (e) {
        // not JSON, ignore
        bodyObj = null
      }
    }
    if (!bodyObj) bodyObj = {}
    // only add tokens if not present already
    if (!bodyObj.ClientToken) bodyObj.ClientToken = tokens.ClientToken
    if (!bodyObj.AccessToken) bodyObj.AccessToken = tokens.AccessToken
    const headers: Record<string, string> = { ...(options.headers as Record<string, string> || {}), 'Content-Type': 'application/json' }
    const res = await fetch(`${base}${path}`, { ...options, headers, body: JSON.stringify(bodyObj) })
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { json = text; }
    if (!res.ok) {
      const err: any = new Error(`Mews API error ${res.status}`);
      err.status = res.status;
      err.body = json;
      throw err;
    }
    return json;
  }

  async configurationGet() {
    return this.fetchWithAuth('/api/connector/v1/configuration/get', { method: 'POST', body: JSON.stringify({ Client: 'SW2-Connector' }) });
  }

  async servicesGetAll() {
    return this.fetchWithAuth('/api/connector/v1/services/getAll', { method: 'POST', body: JSON.stringify({ Client: 'SW2-Connector', Limitation: { Count: 500 } }) });
  }

  async ratesGetAll() {
    return this.fetchWithAuth('/api/connector/v1/rates/getAll', { method: 'POST', body: JSON.stringify({ Client: 'SW2-Connector', Limitation: { Count: 500 } }) });
  }

  async resourcesGetAll() {
    return this.fetchWithAuth('/api/connector/v1/resources/getAll', { method: 'POST', body: JSON.stringify({ Client: 'SW2-Connector', Limitation: { Count: 500 } }) });
  }

  async resourceCategoryImageAssignmentsGetAll() {
    return this.fetchWithAuth('/api/connector/v1/resourceCategoryImageAssignments/getAll', { method: 'POST', body: JSON.stringify({ Client: 'SW2-Connector', Limitation: { Count: 500 } }) });
  }

  async resourceCategoryAssignmentsGetAll() {
    return this.fetchWithAuth('/api/connector/v1/resourceCategoryAssignments/getAll', { method: 'POST', body: JSON.stringify({ Client: 'SW2-Connector', Limitation: { Count: 500 } }) });
  }

  async imagesGetUrls(imageIds: string[], width: number = 600, height: number = 400, resizeMode: string = 'Fit') {
    if (!imageIds || imageIds.length === 0) {
      return { ImageUrls: [] };
    }
    
    const payload = {
      Client: 'SW2-Connector',
      Images: imageIds.map(id => ({
        ImageId: id,
        Width: width,
        Height: height,
        ResizeMode: resizeMode
      }))
    };
    
    try {
      return await this.fetchWithAuth('/api/connector/v1/images/getUrls', { method: 'POST', body: JSON.stringify(payload) });
    } catch (error: any) {
      console.error('Error fetching image URLs from Mews:', error.message);
      // Return empty array if images endpoint is not available
      // (some Mews setups may not have images configured)
      return { ImageUrls: [] };
    }
  }

  async createBooking(payload: any, idempotencyKey?: string): Promise<BookingResponse> {
    const headers: Record<string,string> = {};
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    return this.fetchWithAuth('/api/connector/v1/reservations/add', { method: 'POST', body: JSON.stringify(payload), headers });
  }

  async cancelReservation(reservationId: string) {
    // Attempt to cancel by reservation identifier. Try multiple payload shapes to increase compatibility.
    const tryPayloads = [
      { ReservationId: reservationId },
      { ReservationIds: [reservationId] },
      { Reservation: { Id: reservationId } },
      { Reservations: [{ Id: reservationId }] },
    ]
    let lastErr: any = null
    for (const p of tryPayloads) {
      try {
        return await this.fetchWithAuth('/api/connector/v1/reservations/cancel', { method: 'POST', body: JSON.stringify(p) })
      } catch (e) {
        lastErr = e
        // continue trying other shapes
      }
    }
    // If all attempts failed, rethrow last error
    throw lastErr
  }
}

// Provide a default export for backwards compatibility with tests/imports
export default MewsAdapter;


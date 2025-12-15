import { PmsAvailability } from '../pmsMockService';

export type PriceResult = {
  success: boolean;
  total?: number;
  currency?: string;
  reason?: string;
};

export type AddResult = {
  success: boolean;
  reservationId?: string;
  reason?: string;
};

export type PmsAdapter = {
  // low-level availability helpers
  checkAvailability: (propertyId: number, startDate: string, endDate: string, requiredNights: number) => Promise<PmsAvailability>;

  // catalog endpoints
  configurationGet?: () => Promise<any>;
  servicesGetAll?: () => Promise<any>;
  ratesGetAll?: () => Promise<any>;
  resourcesGetAll?: () => Promise<any>;

  // pricing & reservation flow used by the timeshare stories
  priceReservation?: (payload: any) => Promise<PriceResult>;
  addReservation?: (payload: any) => Promise<AddResult>;
  createBooking?: (payload: any, idempotencyKey?: string) => Promise<any>;
  cancelReservation?: (reservationId: string) => Promise<any>;

  // optional query helpers
  getReservation?: (reservationId: string) => Promise<any>;
};

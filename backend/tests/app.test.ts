import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// Mock the services before importing app
vi.mock('../src/services/pmsService', () => {
  const mockPMSService = vi.fn();
  mockPMSService.prototype = {
    getAvailability: vi.fn(),
    createBooking: vi.fn(),
    getBooking: vi.fn(),
    updateBooking: vi.fn(),
    cancelBooking: vi.fn(),
    getProperty: vi.fn(),
    getUserProperties: vi.fn(),
  };
  return { default: mockPMSService };
});

vi.mock('../src/services/stripeService', () => {
  const mockStripeService = vi.fn();
  mockStripeService.prototype = {
    createPaymentIntent: vi.fn(),
    confirmPayment: vi.fn(),
    createRefund: vi.fn(),
    cancelPayment: vi.fn(),
    constructEvent: vi.fn(),
  };
  return { default: mockStripeService };
});

import app from '../src/app';

describe('App', () => {
  it('should return welcome message on GET /', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'SW2 Backend API' });
  });
});
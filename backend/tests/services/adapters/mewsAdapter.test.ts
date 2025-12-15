import { describe, it, expect, vi, beforeEach } from 'vitest';
import MewsAdapter from '../../../src/services/adapters/mewsAdapter';

const demoReservationId = 'demo-res-id-123';
const demoPayload = {
  Client: 'SW2-Connector',
  ServiceId: 'demo-service-id',
  Reservations: [{
    Identifier: 'test-identifier',
    StartUtc: '2025-12-10T14:00:00Z',
    EndUtc: '2025-12-12T10:00:00Z',
    RequestedCategoryId: null,
    PersonCounts: []
  }]
};

describe('MewsAdapter', () => {
          it('getReservationHistory should POST to /reservations/getAll and return user booking history', async () => {
            (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ Reservations: [
              { Id: 'res-1', StartUtc: '2025-11-01T14:00:00Z', EndUtc: '2025-11-05T10:00:00Z', Status: 'completed' },
              { Id: 'res-2', StartUtc: '2025-12-10T14:00:00Z', EndUtc: '2025-12-12T10:00:00Z', Status: 'upcoming' }
            ] }) });
            const userId = 'user-abc';
            const result = await adapter.getReservationHistory(userId);
            expect(result).toBeDefined();
            expect(Array.isArray(result.Reservations)).toBe(true);
            expect(result.Reservations.length).toBe(2);
            expect(result.Reservations[0]).toMatchObject({ Id: 'res-1', Status: 'completed' });
            expect(result.Reservations[1]).toMatchObject({ Id: 'res-2', Status: 'upcoming' });
          });

            it('should allow guest-staff messaging (Mews or custom integration)', async () => {
              const adapter = new MewsAdapter();
              const bookingId = 'test-booking-id';
              const message = {
                sender: 'guest',
                content: 'Hola, ¿puedo pedir una almohada extra?',
                timestamp: new Date().toISOString(),
              };
              // Simula envío de mensaje
              const sendResult = await adapter.sendMessageToStaff(bookingId, message);
              expect(sendResult).toHaveProperty('success', true);
              expect(sendResult).toHaveProperty('messageId');
              // Simula recepción de mensajes
              const messages = await adapter.getMessagesForBooking(bookingId);
              expect(Array.isArray(messages)).toBe(true);
              expect(messages.length).toBeGreaterThanOrEqual(1);
              expect(messages[0]).toMatchObject({ sender: 'guest', content: message.content });
            });

              it('should request refund/dispute via Stripe or Mews', async () => {
                const adapter = new MewsAdapter();
                const paymentIntentId = 'pi_test_123';
                const amount = 100;
                const currency = 'eur';
                const reason = 'requested_by_customer';
                // Simula reembolso vía Stripe
                const stripeRefund = await adapter.requestRefundStripe({ paymentIntentId, amount, currency, reason });
                expect(stripeRefund).toHaveProperty('success', true);
                expect(stripeRefund).toHaveProperty('refundId');
                expect(stripeRefund).toHaveProperty('amount', amount);
                expect(stripeRefund).toHaveProperty('currency', currency);
                // Simula reembolso vía Mews
                const mewsRefund = await adapter.requestRefundMews({ reservationId: 'res_test_123', amount, currency, reason });
                expect(mewsRefund).toHaveProperty('success', true);
                expect(mewsRefund).toHaveProperty('refundId');
                expect(mewsRefund).toHaveProperty('amount', amount);
                expect(mewsRefund).toHaveProperty('currency', currency);
              });

                it('should allow purchase of upgrades, late checkout, or add-ons', async () => {
                  const adapter = new MewsAdapter();
                  const reservationId = 'res_test_456';
                  // Simula compra de upgrade
                  const upgradeResult = await adapter.purchaseUpgrade({ reservationId, upgradeType: 'suite', amount: 50, currency: 'eur' });
                  expect(upgradeResult).toHaveProperty('success', true);
                  expect(upgradeResult).toHaveProperty('upgradeId');
                  expect(upgradeResult).toHaveProperty('amount', 50);
                  expect(upgradeResult).toHaveProperty('currency', 'eur');
                  // Simula compra de late checkout
                  const lateCheckoutResult = await adapter.purchaseAddOn({ reservationId, addOnType: 'late_checkout', amount: 20, currency: 'eur' });
                  expect(lateCheckoutResult).toHaveProperty('success', true);
                  expect(lateCheckoutResult).toHaveProperty('addOnId');
                  expect(lateCheckoutResult).toHaveProperty('amount', 20);
                  expect(lateCheckoutResult).toHaveProperty('currency', 'eur');
                });
      it('startReservation should POST to /reservations/start and perform online check-in', async () => {
        (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ success: true, reservationId: demoReservationId, status: 'checked-in', checkInTime: '2025-12-10T14:00:00Z' }) });
        const result = await adapter.startReservation(demoReservationId);
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.reservationId).toBe(demoReservationId);
        expect(result.status).toBe('checked-in');
        expect(result.checkInTime).toBe('2025-12-10T14:00:00Z');
      });

      it('processReservation should POST to /reservations/process and perform online check-out', async () => {
        (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ success: true, reservationId: demoReservationId, status: 'checked-out', checkOutTime: '2025-12-12T10:00:00Z' }) });
        const result = await adapter.processReservation(demoReservationId);
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.reservationId).toBe(demoReservationId);
        expect(result.status).toBe('checked-out');
        expect(result.checkOutTime).toBe('2025-12-12T10:00:00Z');
      });
  let adapter: MewsAdapter;

  beforeEach(() => {
    adapter = new MewsAdapter();
    global.fetch = vi.fn();
  });

  it('priceReservation should POST to /reservations/price and return response', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ success: true, total: 100, currency: 'EUR' }) });
    const result = await adapter.priceReservation(demoPayload);
    expect(result).toEqual({ success: true, total: 100, currency: 'EUR' });
  });

  it('addReservation should POST to /reservations/add and return response', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ success: true, reservationId: 'abc123' }) });
    const result = await adapter.addReservation(demoPayload);
    expect(result).toEqual({ success: true, reservationId: 'abc123' });
  });

  it('cancelReservation should POST to /reservations/cancel and return response', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ success: true, reservationId: demoReservationId }) });
    const result = await adapter.cancelReservation(demoReservationId);
    expect(result).toEqual({ success: true, reservationId: demoReservationId });
  });

  it('getReservation should POST to /reservations/getAll and return response', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ Reservations: [{ Id: demoReservationId }] }) });
    const result = await adapter.getReservation(demoReservationId);
    expect(result).toEqual({ Reservations: [{ Id: demoReservationId }] });
  });

    it('updateReservation should POST to /reservations/update and update reservation details', async () => {
      (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ success: true, reservationId: demoReservationId, checkIn: '2025-12-10', checkOut: '2025-12-15', roomType: 'Suite', guest: { name: 'John Doe', email: 'john.doe@example.com', adults: 2, children: 1 } }) });
      const updates = {
        checkIn: '2025-12-10',
        checkOut: '2025-12-15',
        roomType: 'Suite',
        guest: {
          name: 'John Doe',
          email: 'john.doe@example.com',
          adults: 2,
          children: 1
        }
      };
      const result = await adapter.updateReservation(demoReservationId, updates);
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.reservationId).toBe(demoReservationId);
      expect(result.checkIn).toBe('2025-12-10');
      expect(result.checkOut).toBe('2025-12-15');
      expect(result.roomType).toBe('Suite');
      expect(result.guest).toMatchObject({
        name: 'John Doe',
        email: 'john.doe@example.com',
        adults: 2,
        children: 1
      });
    });
    it('directPayment should POST to /payments/add and process payment via Mews (no Stripe)', async () => {
      (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ success: true, paymentId: 'pay-123', amount: 200, currency: 'EUR', method: 'card', reservationId: demoReservationId }) });
      const paymentPayload = {
        reservationId: demoReservationId,
        amount: 200,
        currency: 'EUR',
        method: 'card',
        description: 'Pago directo por reserva y extras'
      };
      const result = await adapter.directPayment(paymentPayload);
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.paymentId).toBe('pay-123');
      expect(result.amount).toBe(200);
      expect(result.currency).toBe('EUR');
      expect(result.method).toBe('card');
      expect(result.reservationId).toBe(demoReservationId);
    });
  it('should throw on non-ok response', async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, text: async () => 'error' });
    await expect(adapter.priceReservation(demoPayload)).rejects.toThrow(/priceReservation error/);
  });

    it('viewInvoice should POST to /invoices/get and return invoice/receipt for completed booking', async () => {
      (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ success: true, invoiceId: 'inv-456', url: 'https://mews.com/invoice/inv-456.pdf', amount: 200, currency: 'EUR', issuedAt: '2025-12-15T10:00:00Z', reservationId: demoReservationId }) });
      const invoicePayload = {
        reservationId: demoReservationId,
        format: 'pdf'
      };
      const result = await adapter.viewInvoice(invoicePayload);
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.invoiceId).toBe('inv-456');
      expect(result.url).toMatch(/\.pdf$/);
      expect(result.amount).toBe(200);
      expect(result.currency).toBe('EUR');
      expect(result.issuedAt).toBe('2025-12-15T10:00:00Z');
      expect(result.reservationId).toBe(demoReservationId);
    });

      it('requestSpecialService should POST to /reservations/addProduct and request upgrades/amenities/packages', async () => {
        (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ success: true, reservationId: demoReservationId, productId: 'prod-789', productType: 'upgrade', name: 'Late Checkout', count: 1, startUtc: '2025-12-12T10:00:00Z', endUtc: '2025-12-12T18:00:00Z', unitAmount: 30 }) });
        const servicePayload = {
          reservationId: demoReservationId,
          productId: 'prod-789',
          productType: 'upgrade',
          name: 'Late Checkout',
          count: 1,
          startUtc: '2025-12-12T10:00:00Z',
          endUtc: '2025-12-12T18:00:00Z',
          unitAmount: 30
        };
        const result = await adapter.requestSpecialService(servicePayload);
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.reservationId).toBe(demoReservationId);
        expect(result.productId).toBe('prod-789');
        expect(result.productType).toBe('upgrade');
        expect(result.name).toBe('Late Checkout');
        expect(result.count).toBe(1);
        expect(result.startUtc).toBe('2025-12-12T10:00:00Z');
        expect(result.endUtc).toBe('2025-12-12T18:00:00Z');
        expect(result.unitAmount).toBe(30);
      });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import MewsAdapter from '../../../src/services/adapters/mewsAdapter';

describe('MewsAdapter - extended endpoints', () => {
  let adapter: MewsAdapter;
  const demoReservationId = 'demo-res-id-123';
  const demoCustomerId = 'demo-cust-id-456';
  const demoProductId = 'demo-prod-id-789';
  const demoUnitAmount = { Currency: 'EUR', GrossValue: 10, TaxCodes: ['VAT'] };
  const demoUpdates = { StartUtc: { Value: '2025-12-15T14:00:00Z' }, EndUtc: { Value: '2025-12-17T10:00:00Z' } };

  beforeEach(() => {
    adapter = new MewsAdapter();
    vi.spyOn(adapter, 'fetchToken').mockResolvedValue('demo-token');
    vi.spyOn(adapter, 'buildAuthHeaders').mockReturnValue({
      ClientToken: 'demo-client',
      AccessToken: 'demo-access',
      Accept: 'application/json',
      'Content-Type': 'application/json'
    });
    global.fetch = vi.fn();
  });

  it('confirmReservation should POST to /reservations/confirm and return response', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ ReservationIds: [demoReservationId] }) });
    const result = await adapter.confirmReservation(demoReservationId);
    expect(result).toEqual({ ReservationIds: [demoReservationId] });
  });

  it('startReservation should POST to /reservations/start and return response', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    const result = await adapter.startReservation(demoReservationId);
    expect(result).toEqual({ success: true });
  });

  it('processReservation should POST to /reservations/process and return response', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    const result = await adapter.processReservation(demoReservationId);
    expect(result).toEqual({ success: true });
  });

  it('addProductToReservation should POST to /reservations/addProduct and return response', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ ItemIds: ['item-1'] }) });
    const result = await adapter.addProductToReservation(demoReservationId, demoProductId, 1, '2025-12-15T14:00:00Z', '2025-12-16T10:00:00Z', demoUnitAmount);
    expect(result).toEqual({ ItemIds: ['item-1'] });
  });

  it('addCompanionToReservation should POST to /reservations/addCompanion and return response', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    const result = await adapter.addCompanionToReservation(demoReservationId, demoCustomerId);
    expect(result).toEqual({ success: true });
  });

  it('deleteCompanionFromReservation should POST to /reservations/deleteCompanion and return response', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    const result = await adapter.deleteCompanionFromReservation(demoReservationId, demoCustomerId);
    expect(result).toEqual({ success: true });
  });

  it('updateReservation should POST to /reservations/update and return response', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    const result = await adapter.updateReservation(demoReservationId, demoUpdates);
    expect(result).toEqual({ success: true });
  });

  it('should throw on non-ok response for confirmReservation', async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, text: async () => 'error' });
    await expect(adapter.confirmReservation(demoReservationId)).rejects.toThrow(/confirmReservation error/);
  });
});

import { describe, it, expect } from 'vitest'
import PmsMockService from '../../src/services/pmsMockService'
import MewsAdapter from '../../src/services/adapters/mewsAdapter'

describe('Swap pre-authorization behavior', () => {
  it('PmsMockService.addReservation returns swapPreauth when Metadata.SwapRequestId present', async () => {
    const payload = {
      Reservations: [ { Identifier: 'ref-swap', StartUtc: '2025-12-01', EndUtc: '2025-12-07' } ],
      ServiceId: 'mock-service-01',
      Metadata: { SwapRequestId: 'SW-123' }
    }

    const res = await PmsMockService.addReservation(payload as any)
    expect(res).toHaveProperty('swapPreauth')
    expect(res.swapPreauth).toHaveProperty('id')
    expect(res.swapPreauth.amount).toBe(10)
  })

  it('MewsAdapter.createBooking forwards swapRequestId into Metadata.SwapRequestId', async () => {
    const adapter = new MewsAdapter()
    let capturedBody: any = null
    // monkeypatch private fetchWithAuth to capture the mapped body
    ;(adapter as any).fetchWithAuth = async (path: string, options: any) => {
      try {
        capturedBody = JSON.parse(options.body)
      } catch (e) {
        capturedBody = options.body
      }
      // return a fake success response similar to connector
      return { id: 'fake-res', status: 'confirmed' }
    }

    const payload = {
      checkIn: '2025-12-01',
      checkOut: '2025-12-07',
      swapRequestId: 'SW-999'
    }

    const res = await (adapter as any).createBooking(payload)
    expect(res).toHaveProperty('pmsBookingId')
    expect(capturedBody).not.toBeNull()
    expect(capturedBody.Metadata).toBeDefined()
    expect(capturedBody.Metadata.SwapRequestId).toBe('SW-999')
  })
})

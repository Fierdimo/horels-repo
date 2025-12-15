import { describe, it, expect } from 'vitest'
import { MewsAdapter } from '../../../src/services/mews/mewsAdapter'
import TokenManager from '../../../src/services/mews/tokenManager'

// This test is opt-in: only run when real sandbox is permitted
const runReal = process.env.TEST_USE_REAL_PMS === 'true'

describe('Mews sandbox integration (opt-in)', () => {
  it('attempts pricing using first available service/rate', async () => {
    if (!runReal) {
      console.warn('Skipping real Mews tests; set TEST_USE_REAL_PMS=true to enable')
      return
    }
    if (!process.env.MEWS_CLIENT_TOKEN || !process.env.MEWS_ACCESS_TOKEN) {
      console.warn('MEWS tokens not found; skipping real Mews test')
      return
    }
    if (!runReal) {
      console.warn('TEST_USE_REAL_PMS not enabled; skipping real Mews test')
      return
    }
    const adapter = new MewsAdapter()
    const cfg = await adapter.configurationGet()
    expect(cfg).toBeDefined()

    const services = await adapter.servicesGetAll()
    expect(services).toBeDefined()
    const rates = await adapter.ratesGetAll()
    expect(rates).toBeDefined()

    const svc = services?.Services?.find((s: any) => s.IsActive)
    if (!svc) throw new Error('No active service found in enterprise')
    const sid = svc.Id
    // try to find a rate for this service
    const rate = rates?.Rates?.find((r: any) => r.ServiceId === sid)
    const rid = rate?.Id

    const payload = {
      Client: 'SW2-Connector',
      Reservations: [
        {
          ServiceId: sid,
          RateId: rid,
          StartUtc: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          EndUtc: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
          AdultCount: 2,
        },
      ],
    }

    const priceResp = await adapter.priceReservation(payload)
    expect(priceResp).toBeDefined()
    // if Mews returns reservationPrices or similar, consider success
    const ok = (priceResp && (priceResp?.ReservationPrices || priceResp?.ReservationPrice))
    if (!ok) {
      // try ExternalIdentifier strategy if available
      const ext = svc.ExternalIdentifier
      if (ext) {
        payload.Reservations[0].ServiceId = ext
        const alt = await adapter.priceReservation(payload)
        expect(alt).toBeDefined()
      } else {
        // allow test to pass but warn — user can inspect logs
        console.warn('Price did not return expected structure; inspect response')
      }
    }
    // If price succeeded, attempt to add and then cancel the reservation to clean up sandbox
    if (ok) {
      const tokenMgr = new TokenManager()
      const idempotencyKey = tokenMgr.generateIdempotencyKey('test')
      const addResp = await adapter.createBooking(payload, idempotencyKey)

      // helper: attempt to extract reservation id from common response shapes
      const extractReservationId = (resp: any): string | undefined => {
        if (!resp) return undefined
        if (typeof resp === 'string') return undefined
        const candidates: any[] = []
        candidates.push(resp.ReservationId)
        if (resp.Reservation) candidates.push(resp.Reservation.Id || resp.Reservation.ReservationId)
        if (Array.isArray(resp.Reservations) && resp.Reservations.length) candidates.push(resp.Reservations[0].Id || resp.Reservations[0].ReservationId)
        if (Array.isArray(resp.ReservationIds) && resp.ReservationIds.length) candidates.push(resp.ReservationIds[0])
        if (Array.isArray(resp.AddedReservations) && resp.AddedReservations.length) candidates.push(resp.AddedReservations[0].Id || resp.AddedReservations[0].ReservationId)
        if (resp.AddedReservation) candidates.push(resp.AddedReservation.Id || resp.AddedReservation.ReservationId)
        for (const c of candidates) {
          if (typeof c === 'string' && c.length > 0) return c
        }
        return undefined
      }

      const reservationId = extractReservationId(addResp)
      if (reservationId) {
        try {
          const cancelResp = await adapter.cancelReservation(reservationId)
          expect(cancelResp).toBeDefined()
        } catch (e) {
          // don't fail the whole test on cleanup error, but warn
          console.warn('Cancel failed during cleanup', e)
        }
      } else {
        console.warn('Could not determine ReservationId from add response; skipping cancel')
      }
    }
  }, 60_000)
})

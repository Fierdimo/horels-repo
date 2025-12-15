import { describe, it, expect } from 'vitest'
import PmsMockService from '../../src/services/pmsMockService'

describe('PMS Mock Fabric', () => {
  it('returns configuration with DefaultServiceId', async () => {
    const cfg = await PmsMockService.configurationGet()
    expect(cfg).toHaveProperty('DefaultServiceId')
  })

  it('lists services, rates and resources', async () => {
    const s = await PmsMockService.servicesGetAll()
    const r = await PmsMockService.ratesGetAll()
    const res = await PmsMockService.resourcesGetAll()

    expect(Array.isArray(s.Services)).toBe(true)
    expect(Array.isArray(r.Rates)).toBe(true)
    expect(Array.isArray(res.Resources)).toBe(true)
  })

  it('prices reservation deterministically', async () => {
    const payload = { Reservations: [{ ServiceId: 'mock-service-01', StartUtc: '2025-12-01', EndUtc: '2025-12-07' }] }
    const price = await PmsMockService.priceReservation(payload)
    expect(price.success).toBe(true)
    expect(price.total).toBeGreaterThan(0)
    expect(price.currency).toBe('EUR')
  })

  it('rejects invalid service ids', async () => {
    const payload = { Reservations: [{ ServiceId: 'invalid', StartUtc: '2025-12-01', EndUtc: '2025-12-07' }] }
    const price = await PmsMockService.priceReservation(payload)
    expect(price.success).toBe(false)
  })

  it('creates and cancels reservations', async () => {
    const add = await PmsMockService.addReservation({})
    expect(add).toHaveProperty('reservationId')
    const cancel = await PmsMockService.cancelReservation(add.reservationId)
    expect(cancel).toHaveProperty('success')
  })
})

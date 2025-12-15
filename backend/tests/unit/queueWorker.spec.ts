import { describe, it, expect, beforeEach } from 'vitest'
import queue from '../../src/queues/inMemoryQueue'
import '../../src/queues/bookingWorker' // register worker
import { db } from '../../src/models/inMemoryDb'

beforeEach(() => {
  db.bookings.clear()
})

describe('InMemory queue and booking worker', () => {
  it('processes create_booking jobs and persists booking', async () => {
    const payload = {
      Reservations: [ { Identifier: 'ref-1', StartUtc: '2025-12-01', EndUtc: '2025-12-07' } ],
      ServiceId: 'mock-service-01',
      Metadata: {}
    }

    const jobId = queue.enqueue('create_booking', payload)
    // wait briefly for job to be processed
    await new Promise((r) => setTimeout(r, 100))

    expect(db.bookings.size).toBeGreaterThanOrEqual(1)
    const b = Array.from(db.bookings.values())[0]
    expect(b).toHaveProperty('reservationId')
  })
})

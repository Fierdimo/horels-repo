import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../src/models/inMemoryDb'
import TimeshareController from '../../src/controllers/timeshareController'
import { MockMewsAdapter } from '../../src/services/mews/mewsAdapter'

describe('TimeshareController.requestSwap', () => {
  beforeEach(() => db.reset())

  it('creates an open swap request and marks matched when responder provided', async () => {
    const ctrl = new TimeshareController(new MockMewsAdapter())
    const open = await ctrl.requestSwap('W1')
    expect(open).toBeDefined()
    expect(open.status).toBe('open')

    const matched = await ctrl.requestSwap('W2', 'W3')
    expect(matched.status).toBe('matched')
  })
})

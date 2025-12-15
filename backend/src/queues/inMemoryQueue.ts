type Job = { id: string; type: string; payload: any }

export class InMemoryQueue {
  private queue: Job[] = []
  private handlers: Record<string, (payload: any) => Promise<any>> = {}
  private running = false

  enqueue(type: string, payload: any) {
    const job: Job = { id: `job-${Date.now()}-${Math.floor(Math.random() * 10000)}`, type, payload }
    this.queue.push(job)
    // try process immediately
    this.processNext().catch(() => {})
    return job.id
  }

  on(type: string, handler: (payload: any) => Promise<any>) {
    this.handlers[type] = handler
  }

  async processNext() {
    if (this.running) return
    this.running = true
    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift()!
        const h = this.handlers[job.type]
        if (h) {
          try {
            await h(job.payload)
          } catch (e) {
            // swallow handler error for in-memory queue
          }
        }
      }
    } finally {
      this.running = false
    }
  }
}

export default new InMemoryQueue()

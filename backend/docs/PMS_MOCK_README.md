# PMS Mock & Queue README

Short reference for the project's deterministic PMS mock (used for tests and local development) and the queue setup (in-memory fallback vs BullMQ + Redis).

## Purpose
- Provide a deterministic, feature-complete mock for the PMS connector so user stories (confirm, swap, convert to credits, guest flows) can be implemented and tested without relying on an external sandbox.
- Explain how the project switches between the in-memory queue used in tests and the real queue (BullMQ + Redis) used by the `worker` in Docker.

## How to choose Mock vs Real PMS
- `USE_REAL_PMS` — when `true`, the project will attempt to use a real PMS adapter (e.g. Mews) as provided by the `pmsServiceFactory`.
- `TEST_USE_REAL_PMS` — test-safety flag. By default tests use the mock unless this is explicitly set for a test run.

Default behavior: the `pmsServiceFactory` returns the mock PMS service unless `USE_REAL_PMS` (or an equivalent provider flag) is set. This keeps CI/tests deterministic.

## Mock behavior (deterministic rules)
The mock implements the main PMS endpoints used by the app. Important behaviors are:

- Catalog endpoints
  - `configurationGet()` — returns basic property/config data.
  - `servicesGetAll()`, `ratesGetAll()`, `resourcesGetAll()` — return static/deterministic lists derived from request params (propertyId, date ranges). These are deterministic and suitable for tests.

- Price/reservation flow
  - `priceReservation(payload)` — validates payload and returns a deterministic `price` response (or a structured error when payload is invalid). Useful for the Confirm/Price step.
  - `addReservation(payload)` — creates a mock reservation and returns a reservation object.

- Metadata-driven behaviors
  - `Metadata.NightCreditId`: when present in the `addReservation` payload, the mock attaches the `NightCreditId` to the reservation and will mark the booking as paid by credit (no Stripe charge simulated).
  - `Metadata.SwapRequestId`: when present, the mock will return a special swap-preauth object instead of an immediate final booking. This object simulates the behavior of a swap pre-authorization (a small €10 preauth record). The mock response will include a `swapPreauth`-like object with the following deterministic fields: `id`, `status: 'preauthorized'`, `amount` (the swap fee), and `metadata.swapRequestId`.

- Night credit rules
  - Colors → nights mapping: `Red = 6`, `Blue = 5`, `White = 4` (used by the conversion flows).
  - Expiry: Credits are created with a deterministic expiry in the future (e.g., 18 months) unless overridden.
  - Peak restrictions: The mock accepts an environment variable `MEWS_PEAK_DATES` (comma-separated date ranges or a configuration snippet) to simulate peak-date restrictions where night credits cannot be used.

## Swap pre-authorization flow (summary)
- When an Owner requests a swap, the system creates a booking attempt at the PMS with `Metadata.SwapRequestId`.
- The mock returns a `swapPreauth` response (instead of a final booking). The app records that preauth and the related swap request.
- On successful swap match, the system (or a worker) confirms the booking and charges the swap fee (through the Stripe service) and the mock resolves the preauth to a final booking record.

## Queue setup (booking queue)

- The project supports two queue modes:
  - In-memory fallback queue: used by tests and local runs when `USE_BULL` is not set or false. This keeps tests fast and deterministic.
  - BullMQ + Redis: used when `USE_BULL=true` and a `REDIS_URL` is provided. The `bookingQueue` wrapper will create a Bull `Queue`, `Worker`, and `QueueScheduler` connecting to Redis.

- Environment variables:
  - `USE_BULL=true` — enable BullMQ path.
  - `REDIS_URL=redis://redis:6379` — connection string used by BullMQ.

- Worker startup
  - The `worker` entrypoint (`src/bin/start-worker.ts`) starts both the webhook queue and the booking queue. In Docker Compose the `worker` service runs `npm run start:worker` and will connect to Redis when `USE_BULL=true`.

## Docker Compose (local real-queue demo)

1. Copy the docker env example into `.env` (root of repo):

```bash
cp .env.docker.example .env
```

2. Ensure `.env` contains the following (or equivalent):

```bash
USE_BULL=true
REDIS_URL=redis://redis:6379
```

3. Start docker compose (this will build and start `mariadb`, `redis`, and the `worker`):

```bash
docker compose up --build
```

The `worker` container will run `npm run start:worker` and will start both the webhook and booking processors (Bull when `USE_BULL=true`).

## Quick example: enqueue a booking job locally (ts-node)

Create a small script `scripts/enqueue_booking.ts` in the repo root with this content:

```ts
import bookingQueue from '../src/queues/bookingQueue';

async function main() {
  // Example booking payload — adapt fields to your app's expected shape
  const payload = {
    userId: 1,
    propertyId: 101,
    startDate: '2026-03-01',
    endDate: '2026-03-08',
    metadata: { source: 'manual-test' }
  };

  await bookingQueue.addBookingJob(payload);
  console.log('Enqueued booking job');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
```

Run it locally (from project root) with ts-node or inside the container. Example using `ts-node`:

```bash
npx ts-node scripts/enqueue_booking.ts
```

If `USE_BULL=true` and Redis is available (e.g., via Docker Compose), the job will be queued in Redis and processed by the worker. If `USE_BULL` is not set, the in-memory queue will process the job in-process.

## Troubleshooting
- If the worker can't connect to Redis, verify `REDIS_URL` and that the `redis` service is healthy in `docker compose ps`.
- Tests should continue to pass even when `USE_BULL=true` because the test configuration uses the in-memory fallback by default. If a test intentionally sets `USE_BULL=true`, ensure a test Redis instance is available or mock the queue.

## Next steps (recommended)
- Add a small API endpoint or admin script to enqueue test jobs (useful for demoing the worker in Docker).
- Add a short `docs/` entry showing how to inspect Bull queues using `bull-board` or `arena` if you want a UI.

---

File: `docs/PMS_MOCK_README.md` — add to repo for quick onboarding and reference.

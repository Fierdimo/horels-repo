# Timeshare Bulk Import — Architecture & Implementation Guide

**Date:** 2026-03-28  
**Feature:** Excel/CSV bulk import of timeshare owner registry, assignments and period calendar  
**Scope:** Staff panel (property-scoped) + Admin panel (cross-property, for support)

---

## Implementation Checklist

> This section tracks exactly what needs to be built. Check off items as you go.

### Phase 1 — Database Migration

- [ ] `backend/migrations_v2/20260328000001-create-owner-profiles.js`  
  Creates the `owner_profiles` table (see DDL in `DATABASE_DESIGN.md` → table 10).  
  Run with: `npm run migrate:v2`

### Phase 2 — Sequelize Models

- [ ] `backend/src/models/v2/OwnerProfile.ts`  
  Model for `owner_profiles`. Belongs to `User` (1:1, `user_id`).

- [ ] Register in `backend/src/models/v2/index.ts`:
  ```typescript
  import OwnerProfile from './OwnerProfile';
  // associations:
  User.hasOne(OwnerProfile, { foreignKey: 'user_id', as: 'ownerProfile' });
  OwnerProfile.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  ```

### Phase 3 — Backend: `xlsx` Dependency

- [ ] `cd backend && npm install xlsx`  
  SheetJS — needed to parse `.xlsx` / `.xls` files (`.csv` is handled natively).  
  Add `"xlsx": "^0.18.5"` (or latest) to `dependencies`.  
  Add `"@types/xlsx": "^0.0.36"` to `devDependencies` if available, else use the built-in types from the package.

### Phase 4 — Core Service

- [ ] `backend/src/services/TimeshareImportService.ts`

  **Public methods:**

  | Method | Input | Output |
  |---|---|---|
  | `parseOwnerRegistry(buffer, ext)` | File buffer + `'xlsx'\|'csv'` | `OwnerRow[]` |
  | `parsePeriodSuiteAssignments(buffer, ext)` | File buffer + ext | `AssignmentRow[]` |
  | `parseCalendar(buffer, ext)` | File buffer + ext | `Map<code, {start, end}>` |
  | `calculateEasterDate(year)` | `number` | `{ start: Date, end: Date }` |
  | `importAll(options)` | `{ ownerBuf, assignBuf, calBuf, propertyId, season }` | `ImportReport` |
  | `generateErrorCSV(errors)` | `ImportReport['errors']` | CSV string |

  **`importAll` runs inside a single DB transaction, in this order:**
  1. Upsert suites → `timeshare_units`
  2. Upsert periods → `seasonal_calendar`
  3. Upsert owners → `users` + `owner_profiles` (skip rows with no email)
  4. Upsert ownerships → `ownerships`
  5. Upsert week allocations → `week_allocations`

### Phase 5 — Controller

- [ ] `backend/src/controllers/TimeshareImportController.ts`

  | Method | Route | Description |
  |---|---|---|
  | `preview` | `POST /preview` | Parses the 3 files, returns first 20 rows each — no DB writes |
  | `execute` | `POST /execute` | Full import, returns `ImportReport` |
  | `downloadErrors` | `POST /errors.csv` | Re-parses error list from request body, streams CSV |

  **Role logic (same endpoint for staff and admin):**
  ```typescript
  const propertyId = req.user.role === 'admin'
    ? Number(req.body.property_id)   // admin supplies it
    : req.user.property_id;          // staff: from their profile
  ```

### Phase 6 — Routes

- [ ] `backend/src/routes/admin/timeshare-import.ts`

  ```typescript
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
    fileFilter: (req, file, cb) => {
      const ok = /\.(xlsx|xls|csv)$/i.test(file.originalname);
      cb(ok ? null : new Error('Only .xlsx, .xls and .csv files are accepted'), ok);
    }
  });

  const fields = upload.fields([
    { name: 'registry_file',     maxCount: 1 },
    { name: 'assignments_file',  maxCount: 1 },
    { name: 'calendar_file',     maxCount: 1 },
  ]);

  router.post('/preview',    authMiddleware, requireRole('admin','staff'), fields, controller.preview);
  router.post('/execute',    authMiddleware, requireRole('admin','staff'), fields, controller.execute);
  router.post('/errors.csv', authMiddleware, requireRole('admin','staff'),        controller.downloadErrors);
  ```

- [ ] Register in `backend/src/routes/admin/index.ts`:
  ```typescript
  import timeshareImportRouter from './timeshare-import';
  router.use('/timeshare-import', timeshareImportRouter);
  ```

### Phase 7 — Frontend

- [ ] `frontend/src/pages/admin/TimeshareImport.tsx`

  **Multi-step wizard:**

  | Step | Content |
  |---|---|
  | 1 — Upload | 3 named drop-zones: "Anagrafica (owners)", "Periodo e Suite (assignments)", "Calendario (periods)". Accept `.xlsx`, `.xls`, `.csv`. Show filename + size on selection. |
  | 2 — Options | **Admin only:** property dropdown (fetched from `/api/admin/properties`). **Staff:** property name shown, read-only. Season year input (default: current year). |
  | 3 — Preview | "Preview" button → POST `/preview`. Tabs: one per file. Table with first 20 rows each. |
  | 4 — Import | "Run Import" button → POST `/execute`. Progress indicator while pending. |
  | 5 — Report | Summary table (owners created, updated, skipped; suites; periods; ownerships; week allocations). Error count. "Download Errors CSV" button if errors > 0. "Import again" link to start over. |

- [ ] Add route and nav link to `frontend/src/components/admin/AdminLayout.tsx`:
  - Path: `/admin/timeshare-import`
  - Label: `"Timeshare Import"` (or translated equivalent)
  - Icon: upload/spreadsheet icon
  - Visible to: `admin` and `staff` roles

- [ ] Add route in the frontend router:
  ```typescript
  <Route path="/admin/timeshare-import" element={<TimeshareImport />} />
  ```

---

## Verification Checklist

After implementation, verify the following before marking complete:

- [ ] `npm run migrate:v2` — all migrations run without error
- [ ] `POST /api/admin/timeshare-import/preview` with real xlsx files → returns 20 rows per tab, no DB changes
- [ ] `POST /api/admin/timeshare-import/execute` → `ImportReport` counters match expected values; verify rows in DB
- [ ] Re-run the same files a second time → all counters show `0` new (idempotent; no duplicates)
- [ ] Anagrafica row with no email → absent from `users` table; counted in `skipped_no_email`
- [ ] Anagrafica row with `Fax = "ESONERO"` → `owner_profiles.fax = NULL`
- [ ] Period "03A" → correct `start_date`/`end_date` in `seasonal_calendar`; period "1" (Easter) dates computed correctly by Butcher's algorithm
- [ ] Staff user: `property_id` auto-used, no property dropdown visible
- [ ] Admin user: property dropdown visible and required
- [ ] Existing CSV import (`POST /api/admin/ownerships/import`) still works — not affected by this change

---

## Overview

The import system allows hotel staff (and administrators) to populate the platform database
from three source files provided by management:

| File | Content |
|------|---------|
| **Anagrafica** (owner registry) | Personal and contact details of each timeshare owner |
| **Periodo e Suite** (assignments) | Mapping of each owner to their suite(s) and period(s) |
| **Calendario** (period calendar) | Date ranges for each numbered period of the season |

The feature is intentionally designed to **populate existing tables** rather than create
parallel structures. The section below explains how each concept in the source files
maps to the platform schema.

---

## Schema Mapping

The external specification (v1.0, March 26 2026) proposed four new tables.
After reviewing the current schema, three of the four were found to already exist:

| Spec proposal | What we use | Notes |
|---|---|---|
| `owners` | `users` + `owner_profiles` | Owners are users (role=`owner`). `owner_profiles` is a new table that extends `users` with Italian fiscal fields not present in the generic user model. |
| `suites` | `timeshare_units` | Suites are unit categories — exactly what `timeshare_units` models. No structural changes needed. |
| `periods` | `seasonal_calendar` | The period calendar (week date ranges) is the same concept as `seasonal_calendar`. This table already drives credit cost calculations (RED/WHITE/BLUE season). Importing periods here keeps a single source of truth. |
| `assignments` | `ownerships` + `week_allocations` | Ownership contracts (`ownerships`) link an owner to a unit. Week allocations (`week_allocations`) represent each specific week owned per year. |

**Net database changes:**
- 1 new table: `owner_profiles`
- 0 changes to any other existing table

---

## Import Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Upload (3 files: xlsx / xls / csv)                             │
│  Staff → property auto-deduced from session                      │
│  Admin → property selected from dropdown                         │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Parse & Clean      │
                    │  (TimeshareImport   │
                    │   Service)          │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
  parseOwnerRegistry   parsePeriodSuite      parseCalendar
  (Anagrafica)         (Assignments)         (Calendario)
          │                    │                    │
          └────────────────────┴────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  DB Transaction     │
                    │  (importAll)        │
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
 1. Upsert suites       2. Upsert periods      3. Upsert owners
 (timeshare_units)      (seasonal_calendar)    (users + owner_profiles)
        │                                            │
        └──────────────────┬─────────────────────────┘
                           │
                           ▼
                  4. Upsert ownerships
                  (owner_id + unit_id)
                           │
                           ▼
                  5. Upsert week_allocations
                  (ownership_id + dates from
                   seasonal_calendar)
                           │
                           ▼
                  Import Report
```

---

## Steps in Detail

### Step 1 — Upsert Suites → `timeshare_units`

- **Key**: `(property_id, category)` — unique constraint already exists on the table.
- **On conflict**: do nothing (suite already catalogued).
- **On insert**: minimal defaults are used; staff edits capacity/bedrooms via the existing Units admin page afterwards.

| `timeshare_units` field | Value during import |
|---|---|
| `property_id` | From session / form selection |
| `category` | Suite code from assignments file (e.g. `S330`) |
| `slug` | Downcased category (e.g. `s330`) |
| `quantity` | `1` |
| `capacity_min` | `1` |
| `capacity_max` | `4` (default, edit later) |
| `bedrooms` | `1` (default, edit later) |
| `bathrooms` | `1.0` |
| `base_credit_value` | `0.00` (configure via credit admin later) |
| `is_active` | `true` |

---

### Step 2 — Upsert Periods → `seasonal_calendar`

- **Key**: `(property_id, year, start_date, end_date)`.
- The alphanumeric period code (e.g. `03A`) is only used during parsing to cross-reference the assignments file. It is stored in `notes` for human readability but is **not a primary key** — the date range is the authoritative identifier.
- **Easter handling**: Computed via Butcher's algorithm in `TimeshareImportService.calculateEasterDate(year)`. If the calendar file already contains explicit Easter dates, those are used as-is.
- `season_type` (RED/WHITE/BLUE) must be set for correct credit pricing. The import provides a mapping per period code; staff can adjust via the Seasonal Calendar admin page afterwards.

**Default season_type mapping (can vary per property):**

| Period code | Season type | Notes |
|---|---|---|
| 1 (Easter) | RED | Peak — Easter period |
| 2–4B | WHITE | Spring shoulder |
| 5–11 | WHITE | Early summer |
| 12–22 | RED | Peak summer (Jul–Oct) |
| 23A–23B | WHITE | Autumn shoulder |

> If the calendar file does not include season_type, the above defaults are applied automatically.
> Staff can override per-period via the existing Seasonal Calendar admin page.

---

### Step 3 — Upsert Owners → `users` + `owner_profiles`

- **Skip rule**: rows with no email address are **not imported**. Without an email, a platform account cannot be created.
- **Upsert key for `users`**: `email` (case-insensitive, trimmed).
- **On conflict**: update name and phone only; do not overwrite `password_hash` or `role`.
- **On insert**: `role = 'owner'`, `status = 'approved'`, `must_change_password = true`.
- `full_name` from the registry is stored verbatim in `owner_profiles.full_name`. For display purposes, it is also set as `users.last_name` (first_name left null for companies).

**Cleaning rules applied during parsing:**

| Field | Rule |
|---|---|
| All fields | Trim leading/trailing whitespace |
| `email` | Split on `;` — use first address for `users.email`, store full string in `owner_profiles` notes if multiple |
| `fax` | If value contains `"ESONERO"` (case-insensitive) → store `NULL` |
| `phone_1/2/3` | Strip non-numeric text notes (e.g. `"madre"`, `"Padre"`) — keep digits, `+`, `-`, spaces only |
| `province = 'EE'` | Accept without validating Italian postal code format |

---

### Step 4 — Upsert Ownerships → `ownerships`

- **Key**: `(owner_id, unit_id)`.
- **On conflict**: do nothing (ownership already registered).
- **On insert**: `type = 'FIXED_WEEK'`, `contract_start_year = season`, `annual_fee = 0.00` (update later), `status = 'ACTIVE'`.
- One `ownerships` row is created per unique `(owner, suite)` pair found in the assignments file.

---

### Step 5 — Upsert Week Allocations → `week_allocations`

- **Key**: `(ownership_id, year, start_date)` — unique enough given the 7-day CHECK constraint.
- **On conflict**: do nothing.
- **On insert**: `status = 'ASSIGNED'`, `start_date` and `end_date` resolved from `seasonal_calendar` using the period code look-up built during Step 2.
- `week_number` is left NULL (the table allows this for date-specific allocations).

---

## Import Report Structure

```typescript
interface ImportReport {
  owners: {
    created: number;
    updated: number;
    skipped_no_email: number;
  };
  suites: {
    created: number;
    already_existed: number;
  };
  periods: {
    created: number;
    updated: number;
  };
  ownerships: {
    created: number;
    already_existed: number;
  };
  week_allocations: {
    created: number;
    already_existed: number;
  };
  errors: Array<{
    file: 'anagrafica' | 'assignments' | 'calendar';
    row: number;
    raw_data: Record<string, string>;
    reason: string;
  }>;
}
```

The error list is available for download as a CSV from the UI after the import completes.

---

## File Formats Accepted

All three files accept `.xlsx`, `.xls`, and `.csv`. The parser auto-detects format by file extension.

---

### File 1 — Owner Registry (Anagrafica)

Maps to: `users` + `owner_profiles`

| Column header (Excel) | DB field | Table | Notes |
|---|---|---|---|
| `Multiproprietari` | `full_name` | `owner_profiles` | Legal name — may be a company name |
| `Indirizzo` | `address` | `owner_profiles` | Street address |
| `CAP` | `postal_code` | `owner_profiles` | Postal/ZIP code |
| `Città` | `city` | `owner_profiles` | City |
| `Prov` | `province` | `owner_profiles` | 2-letter province code; `EE` = foreign resident |
| `Nazione` | `country` | `owner_profiles` | Country name; default `Italy` |
| `CodFisc` | `tax_code` | `owner_profiles` | Italian fiscal code (individuals) |
| `Partita IVA` | `vat_number` | `owner_profiles` | VAT number (companies) |
| `Tel1` | `phone` | `users` | Primary phone — strip text notes like `"madre"` |
| `Tel2` | `phone_2` | `owner_profiles` | Secondary phone |
| `Tel3` | `phone_3` | `owner_profiles` | Tertiary phone |
| `Fax` | `fax` | `owner_profiles` | If value is `"ESONERO"` → store `NULL` |
| `Email` | `email` | `users` | **Required** — rows without email are skipped. Multiple addresses separated by `;` → use first for `users.email` |
| `Pec` | `pec` | `owner_profiles` | Italian certified email (PEC) |

**Skip rule:** rows where `Email` is empty or missing are not imported.

---

### File 2 — Period & Suite Assignments (Periodo e Suite)

Maps to: `timeshare_units` + `ownerships` + `week_allocations`

| Column | Content | Notes |
|---|---|---|
| A | Owner name | Must match `Multiproprietari` from File 1 exactly (case-insensitive, trimmed) |
| B | Period/suite code | Format `"NN/SNNN"` — e.g. `"05/S330"`. Split on `/`: left = period code, right = suite code |

**Format examples:**

| Raw value | Period code | Suite code |
|---|---|---|
| `05/S330` | `05` | `S330` |
| `03A/S222` | `03A` | `S222` |
| `14/S317` | `14` | `S317` |

Each owner may appear on multiple rows — one row per week/suite owned. Each row generates one `week_allocations` record.

---

### File 3 — Period Calendar (Calendario)

Maps to: `seasonal_calendar`

| Column | Content | Notes |
|---|---|---|
| A | Period code | e.g. `03A`, `12`, `23B`, `1` (Easter) |
| B | Start date | Date of period start — any parseable date format |
| C | End date | Date of period end |

**Period code reference:**

| Code | Approx. dates | Season type |
|---|---|---|
| `1` | Easter + 10 days | RED |
| `2` | Apr 25 – May 02 | WHITE |
| `3A` | May 02 – May 09 | WHITE |
| `3B` | May 09 – May 16 | WHITE |
| `4A` | May 16 – May 23 | WHITE |
| `4B` | May 23 – May 30 | WHITE |
| `5`–`11` | May 30 – Jul 18 (7 consecutive weeks) | WHITE |
| `12`–`22` | Jul 18 – Oct 03 (11 weeks, peak season) | RED |
| `23A` | Oct 03 – Oct 10 | WHITE |
| `23B` | Oct 10 – Oct 17 | WHITE |

If the calendar file does not include period `1` (Easter), the import service calculates the dates automatically using Butcher's algorithm for the selected season year.

The period code from column A is used **only during import** to cross-reference File 2. It is not persisted to the database — the date range is the authoritative identifier in `seasonal_calendar`.

---

## Access Control

| Role | Access | Property scope |
|---|---|---|
| `staff` | Full access to import | Automatically scoped to `req.user.property_id` |
| `admin` | Full access to import | Property selected via dropdown in UI |

The same backend endpoints serve both roles. The controller detects the role:
```typescript
const propertyId = req.user.role === 'admin'
  ? req.body.property_id   // must be supplied in request
  : req.user.property_id;  // from staff's own profile
```

---

## Backend Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/admin/sporting-import/preview` | Upload 3 files → returns first 20 rows of each |
| `POST` | `/api/admin/sporting-import/execute` | Upload 3 files + propertyId + season → full import + report |

Both endpoints use `multer` middleware accepting `multipart/form-data` with fields:
`registry_file`, `assignments_file`, `calendar_file`, `property_id` (admin only), `season` (year integer).

---

## Related Files

| File | Purpose |
|---|---|
| `backend/src/services/TimeshareImportService.ts` | Core parsing and DB upsert logic |
| `backend/src/controllers/TimeshareImportController.ts` | HTTP layer |
| `backend/src/routes/admin/timeshare-import.ts` | Route definitions + multer config |
| `backend/migrations_v2/20260328000001-create-owner-profiles.js` | DB migration |
| `backend/src/models/v2/OwnerProfile.ts` | Sequelize model |
| `frontend/src/pages/admin/TimeshareImport.tsx` | Multi-step import UI |

---

## Easter Date Calculation (Butcher's Algorithm)

No external library is required. The algorithm is implemented directly in `SportingImportService`:

```typescript
function calculateEasterDate(year: number): { start: Date; end: Date } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March, 4=April
  const day   = ((h + l - 7 * m + 114) % 31) + 1;

  const easter = new Date(year, month - 1, day);
  const end    = new Date(easter);
  end.setDate(end.getDate() + 10); // Period 1 = Easter + 10 days

  return { start: easter, end };
}
```

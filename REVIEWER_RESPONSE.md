# Response: Technical Specification — Timeshare Owner Database Import v1.0

**To:** Sporting Management / External Reviewer  
**From:** Development Team  
**Date:** March 28, 2026  
**Re:** Technical Specification v1.0 — March 26, 2026

---

Thank you for the detailed specification. We have reviewed it against the current platform
architecture and want to share our analysis before proceeding with implementation, as several
proposed additions overlap with functionality that is already in place.

## What Already Exists in the Platform

The platform has a fully modelled timeshare data layer, implemented and running since
February 2026. The key tables relevant to this feature are:

| Table | Purpose |
|---|---|
| `users` | Owner accounts with authentication, email, phone, role (`owner`) |
| `timeshare_units` | Suite/apartment categories per property — quantity, capacity, credit pricing |
| `ownerships` | Contracts linking owners to their units, including contract dates and annual fee |
| `week_allocations` | One row per week owned per year, with `start_date`, `end_date`, and a full status lifecycle (ASSIGNED → RESERVED → RELEASED → BOOKED → USED) |
| `seasonal_calendar` | Period calendar per property: `start_date`, `end_date`, `season_type` (RED/WHITE/BLUE). **This table directly drives credit cost calculations.** |

The platform also has an existing import feature (CSV-based) and a full admin panel with
property management, unit management, user management, and allocation assignment.

## Our Analysis of the Proposed Schema

The specification proposes four new tables: `owners`, `suites`, `periods`, and `assignments`.
After mapping them against the schema above:

| Proposed table | Assessment | What we use instead |
|---|---|---|
| `owners` | Duplicate of `users` | Keep `users`; add a new `owner_profiles` table only for the Italian-specific fields not in `users` (tax code, PEC, VAT, province) |
| `suites` | Duplicate of `timeshare_units` | Use `timeshare_units` directly — identical concept |
| `periods` | Duplicate of `seasonal_calendar` | Use `seasonal_calendar` directly — **identical** structure and purpose |
| `assignments` | Duplicate of `ownerships` + `week_allocations` | Already models owner → unit → week with full date tracking |

Implementing the proposed schema in parallel with the existing one would:

1. **Break the credit system** — credit cost calculations read `seasonal_calendar`. A separate `periods` table would not be read by this system, causing pricing to become incorrect from the moment of import.
2. **Create dual maintenance** — any update to an owner or period would need to be made in two places.
3. **Introduce data drift** — the two schemas would diverge over time.

## What We Are Implementing

The import feature will deliver everything described in the specification — file upload,
parsing, cleaning, upsert logic, preview, season selection, and import report — but mapped
to the correct existing tables.

**Net database changes (minimal):**

- 1 new table: `owner_profiles` (Italian fiscal fields: `tax_code`, `vat_number`, `province`, `pec`, `fax`, additional phones)
- No other structural changes

**Import flow:**
1. Parse Anagrafica → upsert `users` + `owner_profiles` (skip owners without email)
2. Parse Calendario → upsert `seasonal_calendar` (period date ranges)
3. Parse Periodo e Suite → upsert `timeshare_units` (suites) + `ownerships` + `week_allocations`

All upsert logic (no duplicates on re-import), the import report with counters and error CSV,
and the multi-file upload UI for the staff panel are included as specified.

## Access

We would like to provide you with access to:

- The current codebase, or at minimum the database schema documentation
  (`docs_v2/DATABASE_DESIGN.md` in the repository)
- The architecture decision document for this feature
  (`docs_v2/TIMESHARE_BULK_IMPORT.md`)

This will enable future specifications to build on the existing architecture rather than
around it. Please let us know the best way to share access.

---

We are proceeding with implementation as described above.
Please reach out if you have questions or concerns before the next review.

**Development Team**  
Timeshare Platform 

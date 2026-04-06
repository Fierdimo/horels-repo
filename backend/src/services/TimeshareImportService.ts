/**
 * TimeshareImportService
 *
 * Parses three source files (owner registry, period/suite assignments, period calendar)
 * and upserts the data into the platform's existing tables in a single DB transaction.
 *
 * See: docs_v2/TIMESHARE_BULK_IMPORT.md
 */

import * as XLSX from 'xlsx';
import crypto from 'crypto';
import { Transaction, Op } from 'sequelize';
import sequelize from '../config/database';

import TimeshareUnit from '../models/v2/TimeshareUnit';
import Ownership from '../models/v2/Ownership';
import WeekAllocation from '../models/v2/WeekAllocation';
import User from '../models/v2/User';
import OwnerProfile from '../models/v2/OwnerProfile';
import SeasonalCalendar from '../models/SeasonalCalendar';
import TimeshareProperty from '../models/v2/TimeshareProperty';
import emailService from './emailService';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface OwnerRow {
  rowIndex: number;
  full_name: string;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  tax_code: string | null;
  vat_number: string | null;
  phone: string | null;      // → users.phone
  phone_2: string | null;
  phone_3: string | null;
  fax: string | null;
  email: string;             // primary email (first when multiple)
  pec: string | null;
}

export interface AssignmentRow {
  rowIndex: number;
  owner_name: string;        // must match OwnerRow.full_name (case-insensitive)
  period_code: string;       // e.g. "05", "03A"
  suite_code: string;        // e.g. "S330"
}

export interface CalendarEntry {
  period_code: string;
  start_date: Date;
  end_date: Date;
}

export interface ImportOptions {
  property_id: number;
  season_year: number;
  /** Anagrafica (owner registry). Optional — omit to skip owner creation/update. */
  registry_buffer?:    Buffer;
  registry_ext?:       string;
  /** Periodo e Suite (assignments). Optional — omit to skip ownership/week-allocation steps. */
  assignments_buffer?: Buffer;
  assignments_ext?:    string;
  /** Calendario (period dates). Optional — omit to use existing DB periods. */
  calendar_buffer?:    Buffer;
  calendar_ext?:       string;
}

export interface ImportError {
  file: 'anagrafica' | 'assignments' | 'calendar';
  row: number;
  raw_data: Record<string, string>;
  reason: string;
}

export interface ImportReport {
  owners: { created: number; updated: number; skipped_no_email: number; emails_sent: number };
  suites: { created: number; already_existed: number };
  periods: { created: number; updated: number };
  ownerships: { created: number; already_existed: number };
  week_allocations: { created: number; already_existed: number };
  errors: ImportError[];
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Parse any buffer into a 2-D array of strings based on file extension */
function parseSheetToRows(buffer: Buffer, ext: string): string[][] {
  const normalizedExt = ext.toLowerCase().replace('.', '');

  if (normalizedExt === 'csv') {
    // For CSV: parse as plain text to avoid XLSX's automatic MM/DD/YYYY
    // date detection which would corrupt Italian DD/MM/YYYY date strings.
    return parseCSVBuffer(buffer);
  }

  // For Excel files (.xlsx, .xls) use XLSX
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  return raw.map(row => row.map((cell: any) => {
    // XLSX with cellDates:true converts Excel date serials to Date objects.
    // Serialise them as unambiguous YYYY-MM-DD strings.
    if (cell instanceof Date && !isNaN(cell.getTime())) {
      const y = cell.getFullYear();
      const m = String(cell.getMonth() + 1).padStart(2, '0');
      const d = String(cell.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return String(cell ?? '').trim();
  }));
}

/** RFC-4180-compatible CSV parser — preserves raw string values without type coercion */
function parseCSVBuffer(buffer: Buffer): string[][] {
  const text = buffer.toString('utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    rows.push(parseCSVLine(line));
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let pos = 0;
  while (pos <= line.length) {
    if (line[pos] === '"') {
      let field = '';
      pos++; // skip opening quote
      while (pos < line.length) {
        if (line[pos] === '"' && line[pos + 1] === '"') {
          field += '"'; pos += 2;
        } else if (line[pos] === '"') {
          pos++; break; // closing quote
        } else {
          field += line[pos++];
        }
      }
      fields.push(field.trim());
      if (pos < line.length && line[pos] === ',') pos++;
    } else {
      const commaIdx = line.indexOf(',', pos);
      if (commaIdx === -1) {
        fields.push(line.slice(pos).trim());
        break;
      }
      fields.push(line.slice(pos, commaIdx).trim());
      pos = commaIdx + 1;
    }
  }
  return fields;
}

/** Strip non-numeric characters that are clearly not part of a phone number */
function cleanPhone(raw: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9+\-.()\s]/g, '').trim();
  return cleaned || null;
}

/** If raw value contains "ESONERO" (case-insensitive) return null; else trim */
function cleanFax(raw: string | null): string | null {
  if (!raw) return null;
  if (/ESONERO/i.test(raw)) return null;
  const cleaned = raw.replace(/[^0-9+\-.()\s]/g, '').trim();
  return cleaned || null;
}

/**
 * Butcher's algorithm — Gregorian Easter for a given year
 * Returns { start: Saturday before Easter (check-in), end: Saturday after (check-out) }
 */
export function calculateEasterDate(year: number): { start: Date; end: Date } {
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
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 1-based
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  const easter = new Date(year, month - 1, day);

  // Period 1 = 10 days starting from Easter Saturday (day before Easter Sunday)
  const easterSunday = new Date(easter);
  const start = new Date(easterSunday);
  start.setDate(easterSunday.getDate() - 1); // Saturday before Easter
  const end = new Date(start);
  end.setDate(start.getDate() + 10);

  return { start, end };
}

/** Default season_type for a period code */
function defaultSeasonType(periodCode: string): 'RED' | 'WHITE' | 'BLUE' {
  const code = periodCode.trim().toUpperCase();
  // Codes 12–22 = peak summer → RED
  // Code 1 = Easter → RED
  const numericPart = parseInt(code);
  if (!isNaN(numericPart)) {
    if (numericPart === 1) return 'RED';
    if (numericPart >= 12 && numericPart <= 22) return 'RED';
  }
  return 'WHITE';
}

// ────────────────────────────────────────────────────────────────────────────
// Parsers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Parse owner registry (Anagrafica) file.
 * Expected columns (row 1 = header):
 * Multiproprietari | Indirizzo | CAP | Città | Prov | Nazione | CodFisc |
 * Partita IVA | Tel1 | Tel2 | Tel3 | Fax | Email | Pec
 */
export function parseOwnerRegistry(
  buffer: Buffer,
  ext: string
): { rows: OwnerRow[]; skipped: number } {
  const allRows = parseSheetToRows(buffer, ext);
  if (allRows.length < 2) return { rows: [], skipped: 0 };

  // Build header index (case-insensitive)
  const headerRow = allRows[0].map(h => h.toLowerCase().replace(/\s+/g, ''));
  const col = (name: string) => headerRow.findIndex(h => h.includes(name.toLowerCase()));

  const colMap = {
    full_name:   col('multiproprietari'),
    address:     col('indirizzo'),
    postal_code: col('cap'),
    city:        col('citt'),       // Città
    province:    col('prov'),
    country:     col('nazione'),
    tax_code:    col('codfisc'),
    vat_number:  col('partitaiva'),
    phone:       col('tel1'),
    phone_2:     col('tel2'),
    phone_3:     col('tel3'),
    fax:         col('fax'),
    email:       col('email'),
    pec:         col('pec'),
  };

  const getCell = (row: string[], key: keyof typeof colMap): string | null => {
    const idx = colMap[key];
    if (idx < 0) return null;
    const val = (row[idx] ?? '').trim();
    return val || null;
  };

  const rows: OwnerRow[] = [];
  let skipped = 0;

  for (let i = 1; i < allRows.length; i++) {
    const row = allRows[i];
    // Skip blank rows
    if (row.every(c => !c)) continue;

    const rawEmail = getCell(row, 'email') ?? '';
    if (!rawEmail) {
      skipped++;
      continue;
    }

    // Use first email if multiple separated by semicolons
    const primaryEmail = rawEmail.split(';')[0].trim().toLowerCase();
    if (!primaryEmail) {
      skipped++;
      continue;
    }

    rows.push({
      rowIndex: i + 1, // 1-based for error reporting
      full_name:   getCell(row, 'full_name') ?? '',
      address:     getCell(row, 'address'),
      postal_code: getCell(row, 'postal_code'),
      city:        getCell(row, 'city'),
      province:    getCell(row, 'province'),
      country:     getCell(row, 'country') ?? 'Italy',
      tax_code:    getCell(row, 'tax_code'),
      vat_number:  getCell(row, 'vat_number'),
      phone:       cleanPhone(getCell(row, 'phone')),
      phone_2:     cleanPhone(getCell(row, 'phone_2')),
      phone_3:     cleanPhone(getCell(row, 'phone_3')),
      fax:         cleanFax(getCell(row, 'fax')),
      email:       primaryEmail,
      pec:         getCell(row, 'pec'),
    });
  }

  return { rows, skipped };
}

/**
 * Parse period & suite assignments (Periodo e Suite) file.
 * Column A = owner name, Column B = "NN/SNNN"
 */
export function parsePeriodSuiteAssignments(
  buffer: Buffer,
  ext: string
): { rows: AssignmentRow[]; errors: ImportError[] } {
  const allRows = parseSheetToRows(buffer, ext);
  const errors: ImportError[] = [];
  const rows: AssignmentRow[] = [];

  // Skip header row if first cell looks like a header
  const startRow = /name|owner|proprietar/i.test(allRows[0]?.[0] ?? '') ? 1 : 0;

  for (let i = startRow; i < allRows.length; i++) {
    const row = allRows[i];
    if (row.every(c => !c)) continue;

    const ownerName = (row[0] ?? '').trim();
    const rawCode   = (row[1] ?? '').trim();

    if (!ownerName || !rawCode) continue;

    const slashIdx = rawCode.indexOf('/');
    if (slashIdx < 0) {
      errors.push({
        file: 'assignments',
        row: i + 1,
        raw_data: { col_a: ownerName, col_b: rawCode },
        reason: `Invalid format in column B: "${rawCode}". Expected "PERIOD/SUITE" (e.g. "05/S330")`,
      });
      continue;
    }

    const periodCode = rawCode.slice(0, slashIdx).trim();
    const suiteCode  = rawCode.slice(slashIdx + 1).trim();

    if (!periodCode || !suiteCode) {
      errors.push({
        file: 'assignments',
        row: i + 1,
        raw_data: { col_a: ownerName, col_b: rawCode },
        reason: `Could not extract period/suite from "${rawCode}"`,
      });
      continue;
    }

    rows.push({
      rowIndex: i + 1,
      owner_name: ownerName,
      period_code: periodCode,
      suite_code: suiteCode,
    });
  }

  return { rows, errors };
}

/**
 * Parse period calendar (Calendario) file.
 * Column A = period code, B = start_date, C = end_date
 * Returns a Map from period_code → { start_date, end_date }
 */
export function parseCalendar(
  buffer: Buffer,
  ext: string,
  year: number
): { map: Map<string, CalendarEntry>; errors: ImportError[] } {
  const allRows = parseSheetToRows(buffer, ext);
  const errors: ImportError[] = [];
  const map = new Map<string, CalendarEntry>();

  const startRow = /period|code|codice|settimana/i.test(allRows[0]?.[0] ?? '') ? 1 : 0;

  for (let i = startRow; i < allRows.length; i++) {
    const row = allRows[i];
    if (row.every(c => !c)) continue;

    const periodCode = (row[0] ?? '').trim();
    const rawStart   = (row[1] ?? '').trim();
    const rawEnd     = (row[2] ?? '').trim();

    if (!periodCode) continue;

    if (!rawStart || !rawEnd) {
      errors.push({
        file: 'calendar',
        row: i + 1,
        raw_data: { period_code: periodCode, start: rawStart, end: rawEnd },
        reason: `Missing start or end date for period "${periodCode}"`,
      });
      continue;
    }

    // XLSX parses dates as JS Date objects; sheet_to_json with defval:'' may give numeric serial or string
    const start = parseExcelDate(rawStart, year);
    const end   = parseExcelDate(rawEnd, year);

    if (!start || !end) {
      errors.push({
        file: 'calendar',
        row: i + 1,
        raw_data: { period_code: periodCode, start: rawStart, end: rawEnd },
        reason: `Cannot parse dates for period "${periodCode}": start="${rawStart}", end="${rawEnd}"`,
      });
      continue;
    }

    map.set(periodCode.toUpperCase(), { period_code: periodCode, start_date: start, end_date: end });
  }

  return { map, errors };
}

/** Try to parse a cell value as a date */
function parseExcelDate(raw: string, fallbackYear: number): Date | null {
  if (!raw) return null;

  // Numeric: Excel date serial
  const num = Number(raw);
  if (!isNaN(num) && num > 0) {
    const jsDate = XLSX.SSF.parse_date_code(num);
    if (jsDate) {
      return new Date(jsDate.y, jsDate.m - 1, jsDate.d);
    }
  }

  // Try DD/MM/YYYY or DD-MM-YYYY BEFORE Date constructor
  // (new Date("02/08/2025") would wrongly parse as February 8 in MM/DD/YYYY)
  const ddmm = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (ddmm) {
    const d = parseInt(ddmm[1]);
    const m = parseInt(ddmm[2]);
    let y = parseInt(ddmm[3]);
    if (y < 100) y += 2000;
    return new Date(y, m - 1, d);
  }

  // Fall back to ISO / other formats parseable by Date constructor
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) return parsed;

  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Main import orchestrator
// ────────────────────────────────────────────────────────────────────────────

export async function importAll(opts: ImportOptions): Promise<ImportReport> {
  const report: ImportReport = {
    owners:         { created: 0, updated: 0, skipped_no_email: 0, emails_sent: 0 },
    suites:         { created: 0, already_existed: 0 },
    periods:        { created: 0, updated: 0 },
    ownerships:     { created: 0, already_existed: 0 },
    week_allocations: { created: 0, already_existed: 0 },
    errors:         [],
  };

  // ── Parse only the files that were provided ──────────────────────────────

  let ownerRows: OwnerRow[] = [];
  if (opts.registry_buffer) {
    const { rows, skipped } = parseOwnerRegistry(opts.registry_buffer, opts.registry_ext!);
    ownerRows = rows;
    report.owners.skipped_no_email = skipped;
  }

  let assignmentRows: AssignmentRow[] = [];
  if (opts.assignments_buffer) {
    const { rows, errors: asgErrors } = parsePeriodSuiteAssignments(
      opts.assignments_buffer, opts.assignments_ext!
    );
    assignmentRows = rows;
    report.errors.push(...asgErrors);
  }

  let calendarMap = new Map<string, CalendarEntry>();
  if (opts.calendar_buffer) {
    const { map, errors: calErrors } = parseCalendar(
      opts.calendar_buffer, opts.calendar_ext!, opts.season_year
    );
    calendarMap = map;
    report.errors.push(...calErrors);

    // Ensure Easter period (code "1") is in an uploaded calendar
    if (!calendarMap.has('1')) {
      const { start, end } = calculateEasterDate(opts.season_year);
      calendarMap.set('1', { period_code: '1', start_date: start, end_date: end });
    }
  }

  // Pre-build name→email index from parsed registry rows
  const ownerNameIndex = new Map<string, string>(); // lower(full_name) → email
  for (const o of ownerRows) {
    ownerNameIndex.set(o.full_name.toLowerCase().trim(), o.email);
  }

  // ── DB transaction ────────────────────────────────────────────────────────
  // Collect newly created user IDs so we can send welcome emails after commit
  const newlyCreatedUsers: Array<{ id: number; email: string; full_name: string }> = [];

  const tx: Transaction = await sequelize.transaction();
  try {
    // ── Step 1: Upsert suites (only if assignments provided) ──────────────
    if (assignmentRows.length > 0) {
      const suiteCodes = [...new Set(assignmentRows.map(r => r.suite_code.toUpperCase()))];
      for (const suiteCode of suiteCodes) {
        const [, created] = await TimeshareUnit.findOrCreate({
          where: { property_id: opts.property_id, category: suiteCode },
          defaults: {
            property_id: opts.property_id,
            category: suiteCode,
            slug: suiteCode.toLowerCase(),
            quantity: 1,
            capacity_min: 1,
            capacity_max: 4,
            bedrooms: 1,
            bathrooms: 1.0,
            base_credit_value: 0,
            seasonal_factors: '{}',
            is_active: true,
          } as any,
          transaction: tx,
        });
        if (created) report.suites.created++;
        else report.suites.already_existed++;
      }
    }

    // ── Step 2: Upsert seasonal calendar periods (only if calendar provided) ─
    if (calendarMap.size > 0) {
      for (const [codeKey, entry] of calendarMap.entries()) {
        const seasonType = defaultSeasonType(codeKey);
        const existing = await SeasonalCalendar.findOne({
          where: {
            property_id: opts.property_id,
            year: opts.season_year,
            start_date: entry.start_date,
            end_date:   entry.end_date,
          },
          transaction: tx,
        });

        if (existing) {
          await existing.update(
            { notes: `Period ${entry.period_code}` },
            { transaction: tx }
          );
          report.periods.updated++;
        } else {
          await SeasonalCalendar.create(
            {
              property_id: opts.property_id,
              season_type: seasonType,
              start_date:  entry.start_date,
              end_date:    entry.end_date,
              year:        opts.season_year,
              notes:       `Period ${entry.period_code}`,
            },
            { transaction: tx }
          );
          report.periods.created++;
        }
      }
    }

    // ── Step 3: Upsert owners (only if registry provided) ─────────────────
    const emailToUserId = new Map<string, number>();

    if (ownerRows.length > 0) {
      for (const ownerRow of ownerRows) {
        try {
          const [user, userCreated] = await User.findOrCreate({
            where: { email: ownerRow.email },
            defaults: {
              email: ownerRow.email,
              last_name: ownerRow.full_name,
              first_name: '',
              password_hash: 'IMPORT_PLACEHOLDER',
              role: 'owner',
              status: 'approved',
              must_change_password: true,
              phone: ownerRow.phone,
            } as any,
            transaction: tx,
          });

          if (userCreated) {
            report.owners.created++;
          } else {
            await user.update(
              {
                last_name: ownerRow.full_name,
                phone: ownerRow.phone ?? user.phone,
              },
              { transaction: tx }
            );
            report.owners.updated++;
          }

          // Queue welcome email for any user that has never completed their first login,
          // regardless of whether the account was just created or already existed.
          if (!user.last_login_at) {
            newlyCreatedUsers.push({ id: user.id, email: ownerRow.email, full_name: ownerRow.full_name });
          }

          emailToUserId.set(ownerRow.email, user.id);

          await OwnerProfile.upsert(
            {
              user_id:     user.id,
              full_name:   ownerRow.full_name,
              address:     ownerRow.address,
              postal_code: ownerRow.postal_code,
              city:        ownerRow.city,
              province:    ownerRow.province,
              country:     ownerRow.country,
              tax_code:    ownerRow.tax_code,
              vat_number:  ownerRow.vat_number,
              phone_2:     ownerRow.phone_2,
              phone_3:     ownerRow.phone_3,
              fax:         ownerRow.fax,
              pec:         ownerRow.pec,
            },
            { transaction: tx }
          );
        } catch (err: any) {
          report.errors.push({
            file: 'anagrafica',
            row: ownerRow.rowIndex,
            raw_data: { email: ownerRow.email, full_name: ownerRow.full_name },
            reason: err.message,
          });
        }
      }
    }

    // ── Build nameToUserId for assignment resolution ───────────────────────
    // If the registry was uploaded, derive from parsed rows + emailToUserId.
    // If not, look up existing OwnerProfiles from the DB.
    const nameToUserId = new Map<string, number>();

    if (ownerRows.length > 0) {
      for (const o of ownerRows) {
        const uid = emailToUserId.get(o.email);
        if (uid) nameToUserId.set(o.full_name.toLowerCase().trim(), uid);
      }
    } else if (assignmentRows.length > 0) {
      // No registry file — look up owners already in the database
      const profiles = await OwnerProfile.findAll({
        include: [{ model: User, as: 'user', attributes: ['id'] }],
        transaction: tx,
      });
      for (const p of profiles) {
        const user = (p as any).user;
        if (user?.id && p.full_name) nameToUserId.set(p.full_name.toLowerCase().trim(), user.id);
      }
    }

    // ── Steps 4 & 5: Ownerships + week_allocations ────────────────────────
    if (assignmentRows.length > 0) {
      const unitsByCode = new Map<string, TimeshareUnit>();
      const units = await TimeshareUnit.findAll({
        where: { property_id: opts.property_id },
        transaction: tx,
      });
      for (const u of units) {
        unitsByCode.set(u.category.toUpperCase(), u);
      }

      for (const asgn of assignmentRows) {
        const userId = nameToUserId.get(asgn.owner_name.toLowerCase().trim());
        if (!userId) {
          // Owner not found in registry or DB (likely skipped due to no email)
          continue;
        }

        const unit = unitsByCode.get(asgn.suite_code.toUpperCase());
        if (!unit) {
          report.errors.push({
            file: 'assignments',
            row: asgn.rowIndex,
            raw_data: { owner: asgn.owner_name, code: `${asgn.period_code}/${asgn.suite_code}` },
            reason: `Suite "${asgn.suite_code}" not found for property ${opts.property_id}`,
          });
          continue;
        }

        // Step 4: Upsert ownership
        const [ownership, ownershipCreated] = await Ownership.findOrCreate({
          where: { owner_id: userId, unit_id: unit.id },
          defaults: {
            owner_id:            userId,
            unit_id:             unit.id,
            type:                'FIXED_WEEK',
            contract_start_year: opts.season_year,
            annual_fee:          0,
            currency:            'EUR',
            status:              'ACTIVE',
          } as any,
          transaction: tx,
        });

        if (ownershipCreated) report.ownerships.created++;
        else report.ownerships.already_existed++;

        // Step 5: Upsert week_allocation
        // Try calendarMap first; fall back to the existing DB calendar when no
        // calendar file was uploaded in this run.
        let periodEntry: CalendarEntry | undefined = calendarMap.get(asgn.period_code.toUpperCase());

        if (!periodEntry && !opts.calendar_buffer) {
          const dbPeriod = await SeasonalCalendar.findOne({
            where: {
              property_id: opts.property_id,
              year: opts.season_year,
              notes: `Period ${asgn.period_code}`,
            },
            transaction: tx,
          });
          if (dbPeriod) {
            periodEntry = {
              period_code: asgn.period_code,
              start_date:  dbPeriod.start_date as Date,
              end_date:    dbPeriod.end_date as Date,
            };
          }
        }

        if (!periodEntry) {
          const noCalMsg = !opts.calendar_buffer
            ? ' No Calendario file was uploaded and no matching period exists in the database. Upload the Calendario file together with the assignments file.'
            : ' The period code was not found in the uploaded Calendario file. Check that the period codes match between the two files.';
          report.errors.push({
            file: 'assignments',
            row: asgn.rowIndex,
            raw_data: { owner: asgn.owner_name, period: asgn.period_code, suite: asgn.suite_code },
            reason: `Period code "${asgn.period_code}" not found —${noCalMsg}`,
          });
          continue;
        }

        const existingAlloc = await WeekAllocation.findOne({
          where: {
            ownership_id: ownership.id,
            year:         opts.season_year,
            start_date:   periodEntry.start_date,
          },
          transaction: tx,
        });

        if (existingAlloc) {
          report.week_allocations.already_existed++;
        } else {
          await WeekAllocation.create(
            {
              ownership_id: ownership.id,
              year:         opts.season_year,
              week_number:  null,
              start_date:   periodEntry.start_date,
              end_date:     periodEntry.end_date,
              status:       'ASSIGNED',
            } as any,
            { transaction: tx }
          );
          report.week_allocations.created++;
        }
      }
    }

    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }

  // ── Send welcome emails to newly created owners (outside transaction) ────
  if (newlyCreatedUsers.length > 0) {
    const property = await TimeshareProperty.findByPk(opts.property_id, { attributes: ['name'] });
    const propertyName = (property as any)?.name ?? 'the hotel';
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';

    for (const u of newlyCreatedUsers) {
      try {
        // Generate a 48-hour set-password token (reuses the reset-password flow)
        const rawToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
        await User.update(
          {
            password_reset_token:   hashedToken,
            password_reset_expires: new Date(Date.now() + 48 * 60 * 60 * 1000),
          },
          { where: { id: u.id } }
        );
        const setPasswordUrl = `${frontendUrl}/reset-password?token=${rawToken}`;
        const sent = await emailService.sendWelcomeOwner(u.email, u.full_name, propertyName, setPasswordUrl);
        if (sent) report.owners.emails_sent++;
      } catch (emailErr) {
        console.error(`[TimeshareImport] Failed to send welcome email to ${u.email}:`, emailErr);
      }
    }
  }

  return report;
}

// ────────────────────────────────────────────────────────────────────────────
// Error CSV generator
// ────────────────────────────────────────────────────────────────────────────

export function generateErrorCSV(errors: ImportError[]): string {
  if (!errors.length) return 'file,row,reason,raw_data\n';
  const header = 'file,row,reason,raw_data';
  const lines = errors.map(e => {
    const raw = Object.entries(e.raw_data)
      .map(([k, v]) => `${k}=${v}`)
      .join(' | ');
    return [e.file, e.row, e.reason, raw]
      .map(val => `"${String(val).replace(/"/g, '""')}"`)
      .join(',');
  });
  return [header, ...lines].join('\n');
}

const TimeshareImportService = {
  parseOwnerRegistry,
  parsePeriodSuiteAssignments,
  parseCalendar,
  calculateEasterDate,
  importAll,
  generateErrorCSV,
};

export default TimeshareImportService;

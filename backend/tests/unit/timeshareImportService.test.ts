/**
 * TimeshareImportService — Unit Tests
 *
 * Tests all parser functions and the calculateEasterDate utility
 * using the sample CSV fixtures in tests/fixtures/timeshare-import/.
 *
 * Does NOT touch the database — all DB calls are mocked.
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';

import {
  parseOwnerRegistry,
  parsePeriodSuiteAssignments,
  parseCalendar,
  calculateEasterDate,
} from '../../src/services/TimeshareImportService';

// ── Fixture helpers ───────────────────────────────────────────────────────────

const FIXTURES = path.join(__dirname, '../fixtures/timeshare-import');

function fixture(name: string): Buffer {
  return fs.readFileSync(path.join(FIXTURES, name));
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateEasterDate
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateEasterDate', () => {
  it('computes Easter 2025 as April 20', () => {
    const { start } = calculateEasterDate(2025);
    // Period 1 starts the Saturday before Easter (April 19)
    expect(start.getFullYear()).toBe(2025);
    expect(start.getMonth()).toBe(3);   // April = month 3 (0-based)
    expect(start.getDate()).toBe(19);
  });

  it('computes Easter 2026 as April 5', () => {
    const { start } = calculateEasterDate(2026);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(3);
    expect(start.getDate()).toBe(4);    // Saturday before April 5 = April 4
  });

  it('computes Easter 2024 as March 31', () => {
    const { start } = calculateEasterDate(2024);
    expect(start.getFullYear()).toBe(2024);
    expect(start.getMonth()).toBe(2);  // March = 2
    expect(start.getDate()).toBe(30);  // Saturday before March 31 = March 30
  });

  it('end date is 10 days after start', () => {
    const { start, end } = calculateEasterDate(2025);
    const diffMs   = end.getTime() - start.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseOwnerRegistry
// ─────────────────────────────────────────────────────────────────────────────

describe('parseOwnerRegistry — anagrafica_sample.csv', () => {
  const buf = fixture('anagrafica_sample.csv');
  const { rows, skipped } = parseOwnerRegistry(buf, 'csv');

  it('imports 8 owners and skips 1 (no email)', () => {
    expect(rows).toHaveLength(8);
    expect(skipped).toBe(1);
  });

  it('trims and lower-cases email', () => {
    const marco = rows.find(r => r.full_name === 'ROSSI MARCO ANTONIO');
    expect(marco).toBeDefined();
    expect(marco!.email).toBe('marco.rossi@gmail.com');
  });

  it('uses first email when multiple are separated by ;', () => {
    const moretti = rows.find(r => r.full_name === 'MORETTI FAMIGLIA');
    expect(moretti).toBeDefined();
    expect(moretti!.email).toBe('moretti.mario@email.it');
  });

  it('stores NULL for fax when value is ESONERO', () => {
    const conti = rows.find(r => r.full_name === 'CONTI ELENA MARIA');
    expect(conti).toBeDefined();
    expect(conti!.fax).toBeNull();
  });

  it('strips non-numeric text from phone fields', () => {
    const lombardi = rows.find(r => r.full_name === 'LOMBARDI ROBERTO');
    expect(lombardi).toBeDefined();
    // "366 2345678 padre" → only digits, + - spaces kept
    expect(lombardi!.phone_2).not.toContain('padre');
  });

  it('accepts EE province without error', () => {
    const deluca = rows.find(r => r.full_name === 'DE LUCA GIANNI');
    expect(deluca).toBeDefined();
    expect(deluca!.province).toBe('EE');
    expect(deluca!.country).toBe('France');
  });

  it('parses company with VAT number and no personal tax code', () => {
    const bianchi = rows.find(r => r.full_name === 'BIANCHI & ASSOCIATI S.R.L.');
    expect(bianchi).toBeDefined();
    expect(bianchi!.vat_number).toBe('12345678901');
    expect(bianchi!.tax_code).toBeNull();
  });

  it('assigns default country Italy when Nazione is "Italy"', () => {
    const ferrari = rows.find(r => r.full_name === 'FERRARI GIULIA');
    expect(ferrari!.country).toBe('Italy');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parsePeriodSuiteAssignments
// ─────────────────────────────────────────────────────────────────────────────

describe('parsePeriodSuiteAssignments — periodo_suite_sample.csv', () => {
  const buf = fixture('periodo_suite_sample.csv');
  const { rows, errors } = parsePeriodSuiteAssignments(buf, 'csv');

  it('parses valid rows correctly', () => {
    const marco14 = rows.find(r => r.owner_name === 'ROSSI MARCO ANTONIO' && r.period_code === '14');
    expect(marco14).toBeDefined();
    expect(marco14!.suite_code).toBe('S330');
  });

  it('produces an error for row with missing / separator (last row)', () => {
    // "FERRARI GIULIA,S220" has no slash
    expect(errors.length).toBeGreaterThanOrEqual(1);
    const badRow = errors.find(e => e.reason.includes('Expected "PERIOD/SUITE"'));
    expect(badRow).toBeDefined();
  });

  it('keeps period codes with letters (03A, 23A)', () => {
    const conti3a = rows.find(r => r.owner_name === 'CONTI ELENA MARIA');
    expect(conti3a).toBeDefined();
    expect(conti3a!.period_code).toBe('03A');
  });

  it('includes RICCI PAOLA assignment (owner will be skipped at DB step, not here)', () => {
    const ricci = rows.find(r => r.owner_name === 'RICCI PAOLA');
    expect(ricci).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseCalendar
// ─────────────────────────────────────────────────────────────────────────────

describe('parseCalendar — calendario_sample.csv', () => {
  const buf = fixture('calendario_sample.csv');
  const { map, errors } = parseCalendar(buf, 'csv', 2025);

  it('parses all 26 periods with no errors', () => {
    expect(errors).toHaveLength(0);
    expect(map.size).toBe(26);
  });

  it('period 1 (Easter) has correct 2025 dates', () => {
    const p1 = map.get('1');
    expect(p1).toBeDefined();
    expect(p1!.start_date.getFullYear()).toBe(2025);
    expect(p1!.start_date.getMonth()).toBe(3);  // April
    expect(p1!.start_date.getDate()).toBe(19);
  });

  it('period 03A is stored with upper-cased key "03A"', () => {
    expect(map.has('03A')).toBe(true);
  });

  it('period 14 (peak summer) starts on 2025-08-02', () => {
    const p14 = map.get('14');
    expect(p14).toBeDefined();
    expect(p14!.start_date.getMonth()).toBe(7); // August = 7
    expect(p14!.start_date.getDate()).toBe(2);
  });

  it('each period end_date is 7 days after start_date', () => {
    for (const [, entry] of map) {
      const diffDays =
        (entry.end_date.getTime() - entry.start_date.getTime()) /
        (1000 * 60 * 60 * 24);
      expect(diffDays).toBe(7);
    }
  });
});

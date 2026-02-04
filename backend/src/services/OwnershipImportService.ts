/**
 * OwnershipImportService
 * Handles CSV import of ownership data
 * Phase 7: Admin Tools
 */

import { Parser } from 'json2csv';
import Ownership from '../models/v2/Ownership';
import TimeshareUnit from '../models/v2/TimeshareUnit';
import TimeshareProperty from '../models/v2/TimeshareProperty';
import { User } from '../models';

interface CSVRow {
  owner_email: string;
  owner_first_name?: string;
  owner_last_name?: string;
  property_name: string;
  unit_category: string;
  ownership_type: 'FIXED_WEEK' | 'FLOATING' | 'POINTS';
  fixed_week_number?: number;
  annual_points?: number;
  purchase_date?: string;
  contract_reference?: string;
  contract_start_year: number;
  contract_end_year?: number;
  annual_fee?: number;
  currency?: string;
  notes?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  row: CSVRow;
  rowNumber: number;
}

interface ImportResult {
  success: boolean;
  created: number;
  failed: number;
  errors: Array<{
    row: number;
    data: CSVRow;
    error: string;
  }>;
}

class OwnershipImportService {
  /**
   * Parse CSV content
   */
  parseCSV(csvContent: string): CSVRow[] {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV file is empty or has no data rows');
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const rows: CSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: any = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || null;
      });

      rows.push(row as CSVRow);
    }

    return rows;
  }

  /**
   * Validate CSV row
   */
  async validateRow(row: CSVRow, rowNumber: number): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!row.owner_email) errors.push('owner_email is required');
    if (!row.property_name) errors.push('property_name is required');
    if (!row.unit_category) errors.push('unit_category is required');
    if (!row.ownership_type) errors.push('ownership_type is required');
    if (!row.contract_start_year) errors.push('contract_start_year is required');

    // Validate email format
    if (row.owner_email && !this.isValidEmail(row.owner_email)) {
      errors.push('Invalid email format');
    }

    // Validate ownership type
    if (row.ownership_type && !['FIXED_WEEK', 'FLOATING', 'POINTS'].includes(row.ownership_type)) {
      errors.push('ownership_type must be FIXED_WEEK, FLOATING, or POINTS');
    }

    // Type-specific validation
    if (row.ownership_type === 'FIXED_WEEK') {
      if (!row.fixed_week_number) {
        errors.push('fixed_week_number is required for FIXED_WEEK ownership');
      } else if (row.fixed_week_number < 1 || row.fixed_week_number > 52) {
        errors.push('fixed_week_number must be between 1 and 52');
      }
    }

    if (row.ownership_type === 'POINTS') {
      if (!row.annual_points) {
        errors.push('annual_points is required for POINTS ownership');
      } else if (row.annual_points < 1) {
        errors.push('annual_points must be greater than 0');
      }
    }

    // Check if property exists
    if (row.property_name) {
      const property = await TimeshareProperty.findOne({
        where: { name: row.property_name }
      });
      if (!property) {
        errors.push(`Property "${row.property_name}" not found`);
      }
    }

    // Check if unit exists
    if (row.property_name && row.unit_category) {
      const property = await TimeshareProperty.findOne({
        where: { name: row.property_name }
      });
      if (property) {
        const unit = await TimeshareUnit.findOne({
          where: {
            property_id: property.id,
            category: row.unit_category
          }
        });
        if (!unit) {
          errors.push(`Unit category "${row.unit_category}" not found in property "${row.property_name}"`);
        }
      }
    }

    // Check if owner exists
    if (row.owner_email) {
      const user = await User.findOne({
        where: { email: row.owner_email }
      });
      if (!user) {
        warnings.push(`Owner with email "${row.owner_email}" not found - will be created`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      row,
      rowNumber
    };
  }

  /**
   * Validate entire CSV
   */
  async validateCSV(csvContent: string): Promise<{
    valid: boolean;
    totalRows: number;
    validRows: number;
    invalidRows: number;
    results: ValidationResult[];
  }> {
    const rows = this.parseCSV(csvContent);
    const results: ValidationResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const result = await this.validateRow(rows[i], i + 2); // +2 because row 1 is headers and we're 0-indexed
      results.push(result);
    }

    const validRows = results.filter(r => r.valid).length;

    return {
      valid: validRows === rows.length,
      totalRows: rows.length,
      validRows,
      invalidRows: rows.length - validRows,
      results
    };
  }

  /**
   * Import ownerships from CSV
   */
  async importCSV(
    csvContent: string,
    options: {
      createUsers?: boolean;
      skipInvalid?: boolean;
    } = {}
  ): Promise<ImportResult> {
    const { createUsers = false, skipInvalid = false } = options;

    // First validate
    const validation = await this.validateCSV(csvContent);
    
    if (!validation.valid && !skipInvalid) {
      throw new Error(`CSV validation failed. ${validation.invalidRows} invalid rows found.`);
    }

    const result: ImportResult = {
      success: true,
      created: 0,
      failed: 0,
      errors: []
    };

    // Process each valid row
    for (const validationResult of validation.results) {
      if (!validationResult.valid && !skipInvalid) {
        continue; // Skip invalid rows
      }

      try {
        await this.importRow(validationResult.row, createUsers);
        result.created++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          row: validationResult.rowNumber,
          data: validationResult.row,
          error: error.message
        });
      }
    }

    result.success = result.failed === 0;
    return result;
  }

  /**
   * Import single row
   */
  private async importRow(row: CSVRow, createUsers: boolean): Promise<void> {
    // Find or create user
    let user = await User.findOne({
      where: { email: row.owner_email }
    });

    if (!user && createUsers) {
      // Create user
      user = await User.create({
        email: row.owner_email,
        first_name: row.owner_first_name || row.owner_email.split('@')[0],
        last_name: row.owner_last_name || 'Owner',
        password_hash: this.generateRandomPassword(),
        role: 'owner', // V2: direct role field
        status: 'active' // V2: 'active' instead of 'approved'
      });
    } else if (!user) {
      throw new Error(`User with email "${row.owner_email}" not found and createUsers is false`);
    }

    // Find property
    const property = await TimeshareProperty.findOne({
      where: { name: row.property_name }
    });
    if (!property) {
      throw new Error(`Property "${row.property_name}" not found`);
    }

    // Find unit
    const unit = await TimeshareUnit.findOne({
      where: {
        property_id: property.id,
        category: row.unit_category
      }
    });
    if (!unit) {
      throw new Error(`Unit "${row.unit_category}" not found in property "${row.property_name}"`);
    }

    // Create ownership
    await Ownership.create({
      owner_id: user.id,
      unit_id: unit.id,
      type: row.ownership_type,
      fixed_week_number: row.fixed_week_number || null,
      annual_points: row.annual_points || null,
      purchase_date: row.purchase_date || null,
      contract_reference: row.contract_reference || null,
      contract_start_year: row.contract_start_year,
      contract_end_year: row.contract_end_year || null,
      annual_fee: row.annual_fee || null,
      currency: row.currency || 'EUR',
      status: 'ACTIVE'
    });
  }

  /**
   * Generate CSV template
   */
  generateTemplate(): string {
    const template: CSVRow[] = [
      {
        owner_email: 'john.doe@example.com',
        owner_first_name: 'John',
        owner_last_name: 'Doe',
        property_name: 'Beach Resort Marbella',
        unit_category: '2-Bedroom Ocean View',
        ownership_type: 'FIXED_WEEK',
        fixed_week_number: 25,
        contract_start_year: 2020,
        contract_end_year: 2050,
        annual_fee: 1200,
        currency: 'EUR',
        notes: 'Original owner'
      },
      {
        owner_email: 'jane.smith@example.com',
        owner_first_name: 'Jane',
        owner_last_name: 'Smith',
        property_name: 'Mountain Lodge',
        unit_category: 'Studio Garden View',
        ownership_type: 'FLOATING',
        contract_start_year: 2021,
        annual_fee: 800,
        currency: 'EUR'
      },
      {
        owner_email: 'bob.wilson@example.com',
        property_name: 'City Apartments',
        unit_category: '1-Bedroom City View',
        ownership_type: 'POINTS',
        annual_points: 5000,
        contract_start_year: 2022,
        annual_fee: 1500,
        currency: 'EUR'
      }
    ];

    const fields = [
      'owner_email',
      'owner_first_name',
      'owner_last_name',
      'property_name',
      'unit_category',
      'ownership_type',
      'fixed_week_number',
      'annual_points',
      'purchase_date',
      'contract_reference',
      'contract_start_year',
      'contract_end_year',
      'annual_fee',
      'currency',
      'notes'
    ];

    const parser = new Parser({ fields });
    return parser.parse(template);
  }

  /**
   * Helper: Validate email
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Helper: Generate random password
   */
  private generateRandomPassword(): string {
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }
}

export default new OwnershipImportService();

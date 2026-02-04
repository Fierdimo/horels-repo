# Phase 7: Admin Tools - Implementation Plan

## Overview

**Phase:** 7 - Advanced Admin Tools  
**Duration:** Week 12 (5-7 days)  
**Status:** 🚧 Planning  

**Goal:** Build comprehensive admin tools for property management, unit configuration, ownership import, and PMS integration testing.

---

## Objectives

1. ✅ **Property Management UI** - Configure properties with PMS integration
2. ✅ **Unit/Room Management** - CRUD operations for property units
3. ✅ **Ownership Import** - CSV upload for bulk ownership creation
4. ✅ **Week Allocation Generator** - Automated allocation generation tool
5. ✅ **PMS Connection Tester** - Test PMS credentials before saving

---

## Architecture

### Backend Components

```
backend/src/
├── controllers/
│   ├── PropertyController.ts (✅ Exists - enhance for PMS)
│   ├── UnitController.ts (NEW - CRUD for units)
│   ├── OwnershipImportController.ts (NEW - CSV import)
│   └── WeekAllocationController.ts (NEW - allocation generator)
├── services/
│   ├── PropertyService.ts (NEW - business logic)
│   ├── UnitService.ts (NEW - unit operations)
│   ├── OwnershipImportService.ts (NEW - CSV parsing & validation)
│   └── AllocationGeneratorService.ts (NEW - week generation logic)
├── models/
│   ├── Unit.ts (NEW - property units/rooms)
│   ├── UnitOwnership.ts (NEW - ownership records)
│   └── WeekAllocation.ts (✅ Exists - use existing model)
└── routes/
    ├── propertyRoutes.ts (✅ Exists - add PMS endpoints)
    ├── unitRoutes.ts (NEW)
    ├── ownershipImportRoutes.ts (NEW)
    └── allocationRoutes.ts (NEW)
```

### Frontend Components

```
frontend/src/
├── pages/admin/
│   ├── PropertyManagement.tsx (NEW - main property admin page)
│   ├── UnitManagement.tsx (NEW - unit configuration)
│   ├── OwnershipImport.tsx (NEW - CSV import wizard)
│   └── AllocationGenerator.tsx (NEW - allocation tool)
├── components/admin/
│   ├── PMSConfigModal.tsx (NEW - PMS setup dialog)
│   ├── PMSConnectionTest.tsx (NEW - test connection UI)
│   ├── UnitForm.tsx (NEW - unit CRUD form)
│   ├── CSVUploader.tsx (NEW - drag & drop CSV)
│   ├── OwnershipPreview.tsx (NEW - import preview table)
│   └── AllocationForm.tsx (NEW - generation parameters)
└── api/
    ├── properties.ts (enhance for PMS)
    ├── units.ts (NEW)
    ├── ownershipImport.ts (NEW)
    └── allocations.ts (NEW)
```

---

## Database Schema

### 1. Units Table (NEW)

```sql
CREATE TABLE units (
  id INT PRIMARY KEY AUTO_INCREMENT,
  property_id INT NOT NULL,
  unit_number VARCHAR(50) NOT NULL,
  unit_type ENUM('studio', 'one_bedroom', 'two_bedroom', 'three_bedroom', 'penthouse') NOT NULL,
  floor INT,
  capacity INT NOT NULL DEFAULT 2,
  square_meters INT,
  amenities JSON,  -- ['wifi', 'kitchen', 'balcony', 'pool_view']
  status ENUM('active', 'maintenance', 'inactive') DEFAULT 'active',
  base_value DECIMAL(10,2),  -- For credit calculations
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  UNIQUE KEY unique_unit (property_id, unit_number)
);

CREATE INDEX idx_units_property ON units(property_id);
CREATE INDEX idx_units_type ON units(unit_type);
CREATE INDEX idx_units_status ON units(status);
```

### 2. Unit Ownership Table (NEW)

```sql
CREATE TABLE unit_ownerships (
  id INT PRIMARY KEY AUTO_INCREMENT,
  unit_id INT NOT NULL,
  user_id INT NOT NULL,
  ownership_type ENUM('full', 'fractional', 'points') DEFAULT 'fractional',
  share_percentage DECIMAL(5,2),  -- 12.50 = 1/8 ownership
  weeks_per_year INT,  -- Number of weeks entitled
  start_date DATE NOT NULL,
  end_date DATE,  -- NULL for perpetual
  purchase_price DECIMAL(10,2),
  purchase_date DATE,
  notes TEXT,
  status ENUM('active', 'suspended', 'terminated') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  
  INDEX idx_ownership_unit (unit_id),
  INDEX idx_ownership_user (user_id),
  INDEX idx_ownership_status (status)
);
```

### 3. Week Allocations Enhancement (Existing)

```sql
-- Enhance existing week_allocations table
ALTER TABLE week_allocations
  ADD COLUMN unit_id INT AFTER property_id,
  ADD COLUMN allocation_method ENUM('manual', 'generated', 'imported') DEFAULT 'manual',
  ADD COLUMN generation_params JSON,  -- Parameters used for generation
  ADD FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL;

CREATE INDEX idx_allocations_unit ON week_allocations(unit_id);
CREATE INDEX idx_allocations_method ON week_allocations(allocation_method);
```

---

## Implementation Plan

### Part 1: Property Management with PMS (Day 1-2)

#### Backend Tasks

1. **Enhance PropertyController.ts**
   ```typescript
   // Add PMS-specific endpoints
   POST   /api/admin/properties/:id/pms/test      // Test PMS connection
   PUT    /api/admin/properties/:id/pms/config    // Save PMS credentials
   DELETE /api/admin/properties/:id/pms/config    // Remove PMS config
   GET    /api/admin/properties/:id/pms/status    // Check PMS status
   ```

2. **Create PropertyService.ts**
   ```typescript
   class PropertyService {
     async testPMSConnection(propertyId, credentials)
     async savePMSConfig(propertyId, config)
     async removePMSConfig(propertyId)
     async getPMSStatus(propertyId)
     async syncWithPMS(propertyId)
   }
   ```

#### Frontend Tasks

1. **Create PropertyManagement.tsx**
   - List all properties with PMS status indicators
   - Quick actions: Edit, Configure PMS, View Units
   - Filters: Has PMS, PMS Provider, Location
   - Search by name/location

2. **Create PMSConfigModal.tsx**
   - Form for PMS credentials (provider-specific fields)
   - Real-time validation
   - Test connection button (async)
   - Save/Cancel actions

3. **Create PMSConnectionTest.tsx**
   - Connection status indicator
   - Test results display (success/error)
   - Retry mechanism
   - Error details for debugging

### Part 2: Unit Management (Day 2-3)

#### Backend Tasks

1. **Create Unit Model**
   ```typescript
   // models/Unit.ts
   class Unit extends Model {
     id: number;
     property_id: number;
     unit_number: string;
     unit_type: string;
     capacity: number;
     amenities: string[];
     status: 'active' | 'maintenance' | 'inactive';
   }
   ```

2. **Create UnitController.ts**
   ```typescript
   GET    /api/admin/units                    // List all units
   GET    /api/admin/units/:id                // Get unit by ID
   GET    /api/admin/properties/:id/units     // Get units by property
   POST   /api/admin/units                    // Create unit
   PUT    /api/admin/units/:id                // Update unit
   DELETE /api/admin/units/:id                // Delete unit
   POST   /api/admin/units/bulk               // Bulk create units
   ```

3. **Create UnitService.ts**
   ```typescript
   class UnitService {
     async createUnit(data)
     async updateUnit(id, data)
     async deleteUnit(id)
     async bulkCreateUnits(units[])
     async getUnitsByProperty(propertyId)
     async validateUnitNumber(propertyId, unitNumber)
   }
   ```

#### Frontend Tasks

1. **Create UnitManagement.tsx**
   - Table view of units by property
   - Columns: Unit #, Type, Capacity, Floor, Status, Amenities
   - Filters: Property, Type, Status
   - Actions: Add, Edit, Delete, Bulk Import

2. **Create UnitForm.tsx**
   - Create/Edit unit form
   - Fields: Unit number, Type, Capacity, Floor, Amenities (checkboxes)
   - Validation: Unique unit number per property
   - Image upload (optional)

3. **Create api/units.ts**
   ```typescript
   export const unitsApi = {
     list: () => get('/admin/units'),
     getById: (id) => get(`/admin/units/${id}`),
     getByProperty: (propertyId) => get(`/admin/properties/${propertyId}/units`),
     create: (data) => post('/admin/units', data),
     update: (id, data) => put(`/admin/units/${id}`, data),
     delete: (id) => del(`/admin/units/${id}`),
     bulkCreate: (units) => post('/admin/units/bulk', { units }),
   };
   ```

### Part 3: Ownership Import (Day 3-4)

#### Backend Tasks

1. **Create UnitOwnership Model**
   ```typescript
   // models/UnitOwnership.ts
   class UnitOwnership extends Model {
     id: number;
     unit_id: number;
     user_id: number;
     ownership_type: string;
     share_percentage: number;
     weeks_per_year: number;
     start_date: Date;
   }
   ```

2. **Create OwnershipImportController.ts**
   ```typescript
   POST   /api/admin/ownership/import/validate  // Validate CSV
   POST   /api/admin/ownership/import/execute   // Execute import
   GET    /api/admin/ownership/import/history   // Import history
   GET    /api/admin/ownership/template         // Download CSV template
   ```

3. **Create OwnershipImportService.ts**
   ```typescript
   class OwnershipImportService {
     async validateCSV(file): Promise<ValidationResult>
     async executeImport(data, options): Promise<ImportResult>
     async createUsersIfNeeded(emails[]): Promise<User[]>
     async createOwnerships(ownerships[]): Promise<void>
     async generateImportReport(result): Promise<Report>
   }
   ```

   **CSV Format:**
   ```csv
   email,unit_number,property_name,ownership_type,share_percentage,weeks_per_year,start_date,end_date
   john@example.com,101,Beach Resort,fractional,12.50,6,2024-01-01,
   jane@example.com,102,Beach Resort,fractional,25.00,13,2024-01-01,2029-12-31
   ```

#### Frontend Tasks

1. **Create OwnershipImport.tsx**
   - Step 1: Upload CSV (drag & drop)
   - Step 2: Preview & Validate
   - Step 3: Review Errors (if any)
   - Step 4: Execute Import
   - Step 5: Results & Report

2. **Create CSVUploader.tsx**
   - Drag & drop zone
   - File type validation (.csv only)
   - File size limit (10MB)
   - Parse CSV on client side (preview)
   - Download template link

3. **Create OwnershipPreview.tsx**
   - Table showing parsed data
   - Validation status per row (✅ valid, ⚠️ warning, ❌ error)
   - Error messages inline
   - Summary: X valid, Y warnings, Z errors
   - Checkbox: "Skip invalid rows" or "Abort on error"

### Part 4: Week Allocation Generator (Day 4-5)

#### Backend Tasks

1. **Create WeekAllocationController.ts**
   ```typescript
   POST   /api/admin/allocations/generate        // Generate allocations
   GET    /api/admin/allocations/preview         // Preview before generating
   DELETE /api/admin/allocations/bulk            // Delete allocations (by property/year)
   POST   /api/admin/allocations/regenerate      // Regenerate (delete + generate)
   ```

2. **Create AllocationGeneratorService.ts**
   ```typescript
   class AllocationGeneratorService {
     async generateAllocations(params): Promise<WeekAllocation[]>
     async previewAllocations(params): Promise<PreviewData>
     async validateGenerationParams(params): Promise<ValidationResult>
     async distributeWeeksAmongOwners(owners[], weeks[]): WeekAllocation[]
   }
   ```

   **Generation Logic:**
   - For each unit with ownerships
   - Calculate weeks per owner based on share_percentage
   - Distribute weeks throughout the year
   - Consider seasonal preferences (optional)
   - Handle conflicts (multiple owners wanting same week)

#### Frontend Tasks

1. **Create AllocationGenerator.tsx**
   - Form: Select Property, Year, Distribution Method
   - Distribution Methods:
     - "Equal Distribution" - Spread evenly
     - "Seasonal Preference" - Consider owner preferences
     - "Random" - Random assignment
   - Preview button (shows allocation plan)
   - Generate button (creates allocations)

2. **Create AllocationPreview.tsx**
   - Calendar view of allocations
   - Color-coded by owner
   - Summary stats:
     - Total weeks: 52
     - Assigned: X
     - Unassigned: Y
     - Conflicts: Z (if any)

---

## API Specifications

### Property PMS Endpoints

```typescript
// POST /api/admin/properties/:id/pms/test
Request:
{
  provider: 'mews',
  credentials: {
    propertyId: string,
    clientToken: string,
    accessToken: string,
    serviceId: string,
    environment: 'sandbox' | 'production'
  }
}

Response:
{
  success: boolean,
  connected: boolean,
  message: string,
  details?: {
    enterpriseName?: string,
    apiVersion?: string,
    responseTime?: number
  }
}

// PUT /api/admin/properties/:id/pms/config
Request:
{
  provider: 'mews',
  credentials: { ... },  // Will be encrypted
  pmsPropertyId: string,
  autoSync: boolean
}

Response:
{
  success: boolean,
  property: Property  // Updated property with PMS config
}
```

### Unit Endpoints

```typescript
// POST /api/admin/units
Request:
{
  property_id: number,
  unit_number: string,
  unit_type: 'studio' | 'one_bedroom' | 'two_bedroom' | 'three_bedroom',
  capacity: number,
  floor?: number,
  square_meters?: number,
  amenities?: string[],
  base_value?: number,
  notes?: string
}

Response:
{
  success: boolean,
  unit: Unit
}

// POST /api/admin/units/bulk
Request:
{
  property_id: number,
  units: [
    { unit_number: '101', unit_type: 'studio', capacity: 2 },
    { unit_number: '102', unit_type: 'one_bedroom', capacity: 4 },
    ...
  ]
}

Response:
{
  success: boolean,
  created: number,
  failed: number,
  errors?: Array<{ unit_number: string, error: string }>
}
```

### Ownership Import Endpoints

```typescript
// POST /api/admin/ownership/import/validate
Request: FormData with CSV file

Response:
{
  success: boolean,
  valid: boolean,
  rows: number,
  validRows: number,
  invalidRows: number,
  warnings: number,
  data: Array<{
    row: number,
    email: string,
    unit_number: string,
    property_name: string,
    ownership_type: string,
    share_percentage: number,
    weeks_per_year: number,
    valid: boolean,
    errors?: string[],
    warnings?: string[]
  }>
}

// POST /api/admin/ownership/import/execute
Request:
{
  data: Array<ValidatedRow>,
  options: {
    createUsers: boolean,       // Create users if they don't exist
    skipInvalid: boolean,       // Skip invalid rows
    sendEmails: boolean,        // Send welcome emails to new users
    overwriteExisting: boolean  // Overwrite existing ownerships
  }
}

Response:
{
  success: boolean,
  results: {
    usersCreated: number,
    ownershipsCreated: number,
    ownershipsUpdated: number,
    emailsSent: number,
    errors: Array<{ row: number, error: string }>
  }
}
```

### Allocation Generator Endpoints

```typescript
// POST /api/admin/allocations/preview
Request:
{
  property_id: number,
  year: number,
  method: 'equal' | 'seasonal' | 'random',
  preferences?: {
    [userId: number]: {
      preferredSeasons: string[],  // ['summer', 'winter']
      avoidMonths: number[]         // [1, 2, 12]
    }
  }
}

Response:
{
  success: boolean,
  preview: {
    totalWeeks: 52,
    assigned: number,
    unassigned: number,
    allocations: Array<{
      user_id: number,
      user_name: string,
      unit_id: number,
      unit_number: string,
      week_number: number,
      start_date: string,
      end_date: string
    }>
  }
}

// POST /api/admin/allocations/generate
Request: Same as preview

Response:
{
  success: boolean,
  created: number,
  allocations: WeekAllocation[]
}
```

---

## Testing Strategy

### Backend Tests

```typescript
// tests/controllers/UnitController.test.ts
describe('UnitController', () => {
  test('should create unit with valid data')
  test('should reject duplicate unit numbers')
  test('should validate unit type enum')
  test('should bulk create units')
  test('should list units by property')
});

// tests/services/OwnershipImportService.test.ts
describe('OwnershipImportService', () => {
  test('should validate CSV format')
  test('should detect missing required fields')
  test('should handle invalid emails')
  test('should create users if not exist')
  test('should create ownerships')
  test('should handle duplicate ownerships')
});

// tests/services/AllocationGeneratorService.test.ts
describe('AllocationGeneratorService', () => {
  test('should generate 52 weeks per year')
  test('should distribute weeks by ownership percentage')
  test('should handle multiple owners per unit')
  test('should avoid conflicts')
  test('should apply seasonal preferences')
});
```

### Frontend Tests

```typescript
// Unit tests for components
describe('PMSConfigModal', () => {
  test('renders PMS provider selector')
  test('shows provider-specific fields')
  test('validates credentials format')
  test('tests connection on button click')
});

describe('CSVUploader', () => {
  test('accepts CSV files only')
  test('rejects files over 10MB')
  test('parses CSV correctly')
  test('displays preview table')
});

// E2E tests
describe('Property Management Flow', () => {
  test('admin can create property')
  test('admin can configure PMS')
  test('admin can test PMS connection')
  test('admin can save PMS credentials')
});

describe('Ownership Import Flow', () => {
  test('admin can upload CSV')
  test('admin sees validation results')
  test('admin can execute import')
  test('admin receives import report')
});
```

---

## Security Considerations

1. **PMS Credentials**
   - Encrypt before saving to database
   - Use environment-specific encryption keys
   - Never log credentials in plain text
   - Mask credentials in API responses

2. **CSV Upload**
   - Validate file type and size
   - Sanitize all input data
   - Prevent CSV injection attacks
   - Limit concurrent uploads

3. **Authorization**
   - Only admins can access these endpoints
   - Validate admin role on every request
   - Log all admin actions (audit trail)

4. **Rate Limiting**
   - Limit PMS connection tests (5 per minute)
   - Limit CSV imports (1 per 5 minutes)
   - Limit allocation generation (1 per property per hour)

---

## Success Criteria

### Backend
- ✅ All endpoints documented and implemented
- ✅ 90%+ test coverage
- ✅ 0 TypeScript errors
- ✅ All migrations run cleanly
- ✅ PMS integration working with Mews

### Frontend
- ✅ All admin pages responsive
- ✅ Forms validated client-side
- ✅ Error messages clear and helpful
- ✅ Loading states for async operations
- ✅ Success/error toasts for all actions

### Integration
- ✅ Property can be created with PMS config
- ✅ PMS connection test works
- ✅ Units can be bulk created
- ✅ CSV import creates ownerships correctly
- ✅ Allocation generator produces valid allocations

---

## Timeline

| Day | Tasks | Deliverables |
|-----|-------|--------------|
| 1 | Property PMS backend + frontend | PMS config working |
| 2 | Unit management backend | Unit CRUD API complete |
| 3 | Unit management frontend + Ownership models | Unit UI + models ready |
| 4 | Ownership import backend | CSV import working |
| 5 | Ownership import frontend | Full import flow complete |
| 6 | Allocation generator backend + frontend | Allocation tool working |
| 7 | Testing + bug fixes | All tests passing |

**Total:** 7 days (1.5 weeks)

---

## Next Steps

1. Review and approve this plan
2. Create database migrations
3. Start with Part 1 (Property Management + PMS)
4. Proceed sequentially through parts 2-4
5. Integration testing
6. Deploy to staging

**Ready to begin implementation? Let's start with Part 1!** 🚀

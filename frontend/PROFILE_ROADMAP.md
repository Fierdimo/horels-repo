# Owner Profile API Integration - Roadmap & Future Enhancements

## Current Implementation Status

### ✅ Completed Features

1. **useProfile Hook**
   - ✅ Fetch user profile from `/auth/me`
   - ✅ Update basic profile fields via `PUT /auth/profile`
   - ✅ React Query integration with caching
   - ✅ Auth store synchronization
   - ✅ Toast notifications (success/error)
   - ✅ Loading and error states
   - ✅ Mutation handling with optimistic updates

2. **Profile Page UI**
   - ✅ Personal Information section (firstName, lastName, phone, address)
   - ✅ Email display (read-only)
   - ✅ Banking Information section (with data masking)
   - ✅ Property Information section (placeholders)
   - ✅ Account Information card (read-only summary)
   - ✅ Edit mode toggle with Save/Cancel
   - ✅ Loading spinner during fetch
   - ✅ Responsive design (mobile, tablet, desktop)
   - ✅ i18n support (5 languages)

3. **State Management**
   - ✅ Form state with controlled inputs
   - ✅ Edit mode toggle
   - ✅ Disabled buttons during update
   - ✅ Error boundaries

## Planned Enhancements (Phase 2)

### 1. Banking Information Management

#### Backend Requirements
```typescript
// Endpoint 1: Get banking info (with encryption)
GET /auth/profile/banking
Response: {
  success: boolean;
  data: {
    bankAccount: string (encrypted);
    bankRoutingNumber: string (encrypted);
    accountHolder: string;
    lastUpdated: string;
  }
}

// Endpoint 2: Update banking info
PUT /auth/profile/banking
Request: {
  bankAccount: string;
  bankRoutingNumber: string;
  accountHolder?: string;
}
Response: {
  success: boolean;
  message: "Banking information updated successfully"
}

// Endpoint 3: Verify banking info
POST /auth/profile/banking/verify
Request: {
  bankAccount: string;
  amount: number (for verification)
}
Response: {
  success: boolean;
  verificationStatus: 'pending' | 'verified';
}
```

#### Frontend Implementation
```typescript
// Extend useProfile hook
interface UseProfileExtended extends UseProfileReturn {
  bankingInfo: BankingInfo | null;
  updateBankingInfo: (data: BankingData) => Promise<void>;
  verifyBankingInfo: (data: BankingVerification) => Promise<void>;
  isVerifyingBanking: boolean;
}

// New component
export function BankingInfoSection() {
  const { bankingInfo, updateBankingInfo, isVerifyingBanking } = useProfile();
  // Implementation with:
  // - IBAN/SWIFT validation
  // - Secure input masking
  // - Verification workflow
  // - Update confirmation
}
```

### 2. Property Information Management

#### Backend Requirements
```typescript
// Endpoint 1: List owner properties
GET /owners/{userId}/properties
Response: {
  success: boolean;
  data: Array<{
    id: number;
    name: string;
    location: string;
    description: string;
    type: string;
    rooms: number;
    status: 'active' | 'inactive';
    images: string[];
    amenities: string[];
    pricePerNight: number;
  }>
}

// Endpoint 2: Get property details
GET /owners/{userId}/properties/{propertyId}
Response: { ... property details ... }

// Endpoint 3: Update property
PUT /owners/{userId}/properties/{propertyId}
Request: {
  name?: string;
  location?: string;
  description?: string;
  amenities?: string[];
  pricePerNight?: number;
  // ... other fields
}

// Endpoint 4: Add images
POST /owners/{userId}/properties/{propertyId}/images
Request: FormData with image files
Response: {
  success: boolean;
  images: string[]; // URLs
}
```

#### Frontend Implementation
```typescript
// Property management page
export function PropertyManagement() {
  const { properties, updateProperty, uploadImages, isUpdating } = useProfile();

  return (
    <div>
      {properties?.map(property => (
        <PropertyCard key={property.id} property={property} />
      ))}
    </div>
  );
}

// Image gallery with upload
export function PropertyImageGallery() {
  const { uploadImages } = useProfile();
  // Drag & drop, preview, organize, delete
}
```

### 3. Advanced Profile Features

#### A. Profile Verification
```typescript
interface VerificationStatus {
  email: 'verified' | 'pending' | 'unverified';
  phone: 'verified' | 'pending' | 'unverified';
  banking: 'verified' | 'pending' | 'unverified';
  identity: 'verified' | 'pending' | 'unverified';
}

// Endpoint
GET /auth/profile/verification-status
Response: VerificationStatus

// UI Component
export function VerificationBadges() {
  const { verificationStatus } = useProfile();
  // Show verification status with action buttons
}
```

#### B. Profile Audit Log
```typescript
interface ProfileAuditLog {
  id: number;
  action: string;
  field: string;
  oldValue: string;
  newValue: string;
  timestamp: string;
  ipAddress: string;
}

// Endpoint
GET /auth/profile/audit-log?limit=50
Response: Array<ProfileAuditLog>

// UI Component
export function AuditLog() {
  // Show profile change history
  // Track who changed what and when
}
```

#### C. Security Settings
```typescript
interface SecuritySettings {
  twoFactorEnabled: boolean;
  passwordLastChanged: string;
  loginHistory: Array<{ timestamp: string; ipAddress: string; }>;
  activeSessions: number;
}

// Endpoints
GET /auth/profile/security
PUT /auth/profile/security
POST /auth/profile/two-factor/enable
POST /auth/profile/two-factor/disable
```

### 4. Profile Completion Progress

```typescript
interface ProfileCompletion {
  completed: number; // 0-100
  sections: {
    personalInfo: { completed: boolean; percentage: number };
    bankingInfo: { completed: boolean; percentage: number };
    propertyInfo: { completed: boolean; percentage: number };
    verification: { completed: boolean; percentage: number };
  };
  nextSteps: string[];
}

// UI Component
export function ProfileCompletionBar() {
  const { profileCompletion } = useProfile();
  return (
    <div>
      <ProgressBar value={profileCompletion.completed} />
      <NextStepsList steps={profileCompletion.nextSteps} />
    </div>
  );
}
```

## Implementation Timeline

### Phase 2 (Q1 2024)
- [ ] Banking Information Management
- [ ] IBAN/SWIFT validation
- [ ] Banking verification workflow
- [ ] Backend endpoints for banking

### Phase 3 (Q2 2024)
- [ ] Property Management
- [ ] Image upload and gallery
- [ ] Property details editing
- [ ] Multi-property support

### Phase 4 (Q3 2024)
- [ ] Profile verification system
- [ ] Audit logging
- [ ] Security settings dashboard
- [ ] Two-factor authentication

### Phase 5 (Q4 2024)
- [ ] Profile completion scoring
- [ ] Guided profile setup
- [ ] Advanced analytics
- [ ] Profile recommendations

## Database Schema Extensions

### For Banking Information
```sql
CREATE TABLE banking_information (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL UNIQUE,
  bank_account VARCHAR(255) ENCRYPTED,
  routing_number VARCHAR(255) ENCRYPTED,
  account_holder VARCHAR(255),
  verification_status ENUM('verified', 'pending', 'unverified'),
  verified_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### For Property Information
```sql
CREATE TABLE properties (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  name VARCHAR(255),
  location VARCHAR(255),
  description LONGTEXT,
  property_type VARCHAR(50),
  rooms INT,
  status ENUM('active', 'inactive'),
  price_per_night DECIMAL(10,2),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE property_images (
  id INT PRIMARY KEY AUTO_INCREMENT,
  property_id INT NOT NULL,
  image_url VARCHAR(500),
  display_order INT,
  created_at TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id)
);

CREATE TABLE property_amenities (
  id INT PRIMARY KEY AUTO_INCREMENT,
  property_id INT NOT NULL,
  amenity VARCHAR(100),
  FOREIGN KEY (property_id) REFERENCES properties(id)
);
```

### For Verification
```sql
CREATE TABLE verification_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  type ENUM('email', 'phone', 'banking', 'identity'),
  status ENUM('verified', 'pending', 'failed'),
  verified_at TIMESTAMP,
  expires_at TIMESTAMP,
  metadata JSON,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE profile_audit_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  action VARCHAR(100),
  field VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## API Integration Examples

### Banking Information Integration
```typescript
// In useProfile hook
const updateBankingInfo = useMutation({
  mutationFn: async (data: BankingData) => {
    // Encrypt on client side before sending (optional)
    const encrypted = encryptSensitiveData(data);
    const response = await apiClient.put(
      '/auth/profile/banking',
      encrypted
    );
    return response.data;
  },
  onSuccess: () => {
    // Revalidate and notify
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    toast.success('Banking information updated');
  }
});
```

### Property Management Integration
```typescript
// Hook for property operations
export function useProperties() {
  const queryClient = useQueryClient();

  const { data: properties, isLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const { data } = await apiClient.get('/owners/properties');
      return data.data;
    }
  });

  const updatePropertyMutation = useMutation({
    mutationFn: (property: Property) =>
      apiClient.put(`/owners/properties/${property.id}`, property),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    }
  });

  return { properties, isLoading, updateProperty: updatePropertyMutation.mutate };
}
```

## Validation Rules

### For Banking Information
```typescript
const bankingValidation = {
  iban: /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/,
  swift: /^[A-Z0-9]{6}[A-Z2-9][A-NP-Z0-9]([A-Z0-9]{3})?$/,
  accountNumber: (value: string) => /^\d{8,17}$/.test(value)
};

// Frontend validation before submit
function validateBankingInfo(data: BankingData): ValidationErrors {
  const errors: ValidationErrors = {};
  
  if (!bankingValidation.iban.test(data.bankAccount)) {
    errors.bankAccount = 'Invalid IBAN format';
  }
  
  return errors;
}
```

## Security Considerations

1. **Data Encryption**
   - Encrypt banking info in transit (HTTPS)
   - Encrypt banking info at rest (database)
   - Use field-level encryption for sensitive data

2. **Access Control**
   - Only owner can view own profile
   - Admin can view profiles for support
   - Implement audit logging

3. **Rate Limiting**
   - Limit profile update attempts
   - Limit verification attempts
   - Implement exponential backoff for failed attempts

4. **Data Validation**
   - Server-side validation required
   - IBAN/SWIFT validation
   - Phone number validation
   - Address validation

## Testing Strategy

### Unit Tests
```typescript
describe('Banking Info Updates', () => {
  it('should encrypt sensitive data before sending', async () => {
    // Test encryption
  });

  it('should validate IBAN format', () => {
    // Test validation
  });

  it('should mask banking info in display', () => {
    // Test masking
  });
});
```

### Integration Tests
```typescript
describe('Profile Management Flow', () => {
  it('should complete full property setup flow', async () => {
    // Test: create property → upload images → set amenities
  });

  it('should verify banking information', async () => {
    // Test: submit banking → receive verification code → verify
  });
});
```

## Performance Optimization

1. **Lazy Loading**
   - Load banking info only when needed
   - Load property images progressively
   - Load verification status on demand

2. **Pagination**
   - Paginate audit logs
   - Paginate properties list
   - Paginate login history

3. **Caching Strategy**
   - Cache profile for 5 minutes
   - Cache properties for 10 minutes
   - Cache verification status for 1 hour

## Monitoring & Analytics

### Metrics to Track
- Profile completion rates
- Update frequency
- Banking info verification success rate
- Property listing conversion
- User drop-off points

### Error Tracking
- Failed update attempts
- Validation errors
- API timeout errors
- Authentication failures

## Documentation

- [ ] API endpoint documentation
- [ ] Frontend component documentation
- [ ] Database schema documentation
- [ ] Security guidelines
- [ ] Testing guide
- [ ] Deployment checklist

## Conclusion

The current implementation provides a solid foundation for profile management. The planned enhancements will expand the functionality to include banking information, property management, and advanced security features, making it a comprehensive user profile system.

**Current Status**: ✅ Phase 1 Complete, Ready for Phase 2 Planning

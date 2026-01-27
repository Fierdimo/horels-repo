# Platform User Guide

## Overview
This platform is a **hospitality swap/conversion system** that allows property owners to manage their accommodations, convert stays into credits, and exchange stays with other properties. The system supports multiple languages (Spanish, English, French, German, Italian).

---

## User Types & Roles

### 1. **Admin**
- Full system access
- Manages all users, properties, and platform settings
- Approves/rejects hotel staff registrations
- Configures platform fees and credit costs

### 2. **Hotel Staff**
- Manages property rooms and availability
- Invites property owners
- Views bookings and swap requests
- Syncs with PMS (Mews)

### 3. **Property Owner**
- Accepts invitations (as booking or credits)
- Uses credits in the marketplace
- Swaps stays with other owners
- Manages their credit wallet

### 4. **Guest**
- Books available rooms in the marketplace
- Makes payments via Stripe
- Views booking history

---

## Complete User Flows

### 🏨 **Hotel Staff Flow**

#### **Step 1: Registration**
1. Navigate to `/register`
2. Select **"Hotel Staff"** account type
3. Fill in:
   - Name and email
   - Hotel name (auto-complete from PMS if available)
   - Password
4. Submit registration
5. **Wait for admin approval** (account status: "pending approval")

#### **Step 2: After Approval**
1. Login at `/login` with approved credentials
2. Access **Staff Dashboard** at `/staff/dashboard`

#### **Step 3: Managing Rooms**
1. In dashboard, view:
   - **Total Rooms**: All rooms in your property
   - **Available Rooms**: Rooms enabled for marketplace
   - **Marketplace Rooms**: Currently listed rooms
2. Rooms are synced automatically from PMS (Mews)

#### **Step 4: Inviting Property Owners**
1. Click **"Manage Invitations"** in dashboard
2. Click **"Create New Invitation"**
3. Fill in invitation details:
   - Owner's email, first name, last name
   - Select room(s) to assign
   - Choose dates (check-in/check-out)
   - System calculates estimated credits automatically
4. Click **"Send Invitation"**
5. Owner receives email with invitation link

#### **Step 5: Monitoring Invitations**
- Dashboard shows invitation statistics:
  - **Pending**: Sent but not accepted
  - **Accepted**: Owner confirmed
  - **Expired**: Past expiration date
  - **Rejected**: Owner declined
- View recent invitations with status tracking

---

### 👤 **Property Owner Flow**

#### **Step 1: Receiving Invitation**
1. Receive invitation email from hotel staff
2. Email contains unique registration link: `/register-owner?token=xxx`
3. Click link to start registration

#### **Step 2: Registration & Decision**
1. Page displays invitation details:
   - Property name and location
   - Room type and nights
   - Check-in and check-out dates
   - Total estimated credits
2. **Choose one option**:

**Option A: Accept as Booking**
   - Guarantees specific dates
   - Confirmed room reservation
   - Direct booking without conversion
   - Requires staff approval

**Option B: Convert to Credits**
   - Adds credits to your wallet immediately
   - Use credits anytime on any available date
   - More flexibility
   - Exchange with other owners

3. Complete registration form:
   - Email (pre-filled from invitation)
   - Name (pre-filled from invitation)
   - Password (min 6 characters)
   - Phone (optional)
   - Address (optional)
   - Accept terms and conditions

4. Click **"Create my account and confirm [booking/credits]"**

#### **Step 3: After Registration**
1. Automatically logged in
2. Redirected to **Owner Dashboard**
3. View your credit balance (if selected credits option)

#### **Step 4: Using Credits in Marketplace**
1. Navigate to `/marketplace`
2. Browse available properties
3. Filter by:
   - Location
   - Dates
   - Room type
   - Price range
4. View property details:
   - Images
   - Room types
   - Amenities
   - Credit cost per night
5. Select dates and room
6. **Payment options**:
   - **Pay with Credits**: Use wallet balance
   - **Pay with Card**: Stripe payment
   - **Mixed Payment**: Credits + Card for remaining amount

#### **Step 5: Managing Your Account**
- View credit balance
- Check transaction history
- View upcoming bookings
- Request swaps with other owners

---

### 🔧 **Admin Flow**

#### **Step 1: Login**
1. Login at `/login` with admin credentials
2. Access **Admin Dashboard** at `/admin`

#### **Step 2: Approving Staff Registrations**
1. Dashboard shows **"Pending Approvals"** count
2. Click **"Review Now"**
3. View pending staff registrations:
   - Name and email
   - Requested hotel
   - PMS provider
   - Registration date
4. For each request:
   - **Approve**: Activates account, user can login
   - **Reject**: Denies access, sends notification email

#### **Step 3: Platform Configuration**
1. Navigate to **Settings**
2. Configure:
   - **Platform Fee**: Percentage charged on bookings
   - **Credit Costs**: Base cost per credit
   - **Season Multipliers**: High/Mid/Low season adjustments
   - **Property Tier Multipliers**: Luxury/Premium/Standard rates

#### **Step 4: User Management**
1. View all users by role
2. Edit user permissions
3. Deactivate/reactivate accounts
4. View user activity logs

---

### 🌍 **Guest Flow**

#### **Step 1: Registration**
1. Navigate to `/register`
2. Select **"Guest"** account type
3. Fill in personal information
4. Create password
5. Submit (instant activation)

#### **Step 2: Browsing Marketplace**
1. Navigate to `/marketplace`
2. View available properties
3. Use filters to narrow search
4. Click property card to view details

#### **Step 3: Booking a Room**
1. Select desired dates
2. Choose room type
3. Review booking summary:
   - Total nights
   - Price per night
   - Platform fee
   - Total amount
4. Click **"Book Now"**
5. **Payment via Stripe**:
   - Enter card details
   - Confirm payment
   - Receive booking confirmation email

#### **Step 4: Managing Bookings**
1. View booking history in dashboard
2. Check booking status:
   - **Confirmed**: Approved by property
   - **Pending**: Awaiting approval
   - **Cancelled**: Booking cancelled
3. Download booking confirmation (future feature)

---

## Key Features

### 🌐 **Multi-language Support**
- Switch language anytime using language selector
- Supported languages: ES, EN, FR, DE, IT
- All pages fully translated including:
  - Staff dashboard
  - Owner registration
  - Marketplace
  - Forms and errors

### 💳 **Payment System**
- **Stripe Integration**: Secure card payments
- **Credit System**: Internal currency for owners
- **Platform Fees**: Configurable percentage on bookings
- **Mixed Payments**: Combine credits + card

### 🔄 **PMS Integration (Mews)**
- Automatic room synchronization
- Real-time availability updates
- Booking push to PMS
- Webhook support for live updates

### 📊 **Dashboard Analytics**
- **Staff Dashboard**:
  - Room statistics (total, available, marketplace)
  - Invitation overview (pending, accepted)
  - Recent activity
- **Owner Dashboard**:
  - Credit balance
  - Transaction history
  - Upcoming stays

### 🔐 **Security Features**
- JWT authentication
- Password hashing (bcrypt)
- Role-based access control
- API rate limiting
- CORS protection

---

## Technical Details

### **System Architecture**
- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React + TypeScript + Vite
- **Database**: MySQL (MariaDB 10.11)
- **Cache**: Redis
- **Translations**: i18next
- **Payments**: Stripe
- **PMS**: Mews Connector API

### **Deployment**
- **Backend**: Docker container (port 3000)
- **Frontend**: Docker container + Nginx
- **Database**: Docker container (persistent volume)
- **Redis**: Docker container (persistent volume)
- **Reverse Proxy**: Nginx (port 80)

### **Environment Configuration**
- Production: `NODE_ENV=production`
- Database: `sw2_hotels`
- Redis: Queue management and caching
- Stripe: Live keys required for production

---

## Common Workflows

### **Owner Invitation → Credit Conversion**
```
1. Staff creates invitation with room + dates
2. System calculates estimated credits
3. Owner receives email with unique token link
4. Owner registers and selects "Convert to Credits"
5. Credits added to owner's wallet immediately
6. Owner can use credits in marketplace anytime
```

### **Owner Invitation → Direct Booking**
```
1. Staff creates invitation with room + dates
2. Owner receives email with unique token link
3. Owner registers and selects "Accept as Booking"
4. Booking created with status "pending"
5. Staff reviews and approves booking
6. Owner receives confirmation for specific dates
```

### **Guest Marketplace Booking**
```
1. Guest browses marketplace properties
2. Selects dates and room type
3. Reviews total cost (room + platform fee)
4. Pays via Stripe
5. Booking confirmed automatically
6. Property receives notification
7. Booking synced to PMS (Mews)
```

### **Owner Credit Usage**
```
1. Owner has credits in wallet
2. Browses marketplace for available rooms
3. Selects property and dates
4. Chooses "Pay with Credits"
5. Credits deducted from wallet
6. Booking confirmed instantly
7. Owner can check-in on selected dates
```

---

## Troubleshooting

### **Staff Registration Stuck on Pending**
- **Issue**: Account not approved by admin
- **Solution**: Contact admin or check approval status in admin dashboard

### **Owner Invitation Link Not Working**
- **Issue**: Token expired or invalid
- **Solution**: Ask staff to resend invitation

### **Payment Failed**
- **Issue**: Stripe payment declined
- **Solution**: Check card details, try different card, or contact support

### **Rooms Not Showing in Marketplace**
- **Issue**: Rooms not enabled for marketplace
- **Solution**: Staff needs to enable rooms in PMS or dashboard settings

### **Language Not Changing**
- **Issue**: Browser cache or missing translations
- **Solution**: Clear browser cache, refresh page

---

## Support & Contact

For technical support or questions:
- **Platform URL**: http://78.111.67.191
- **Admin Email**: Contact system administrator
- **Documentation**: Refer to README.md and technical docs

---

## Version Information

- **Last Updated**: January 27, 2026
- **Platform Version**: 1.0
- **API Version**: v1
- **Supported Browsers**: Chrome, Firefox, Safari, Edge (latest versions)


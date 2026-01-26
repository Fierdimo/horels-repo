# Complete Guide: From Staff Invitation to Owner Credit Purchase

**Document Purpose:** Step-by-step guide showing the complete flow from staff creating an owner invitation through to an owner purchasing marketplace rooms using credits.

**Date:** January 12, 2026  
**Version:** 1.0

---

## Overview

This guide demonstrates the complete owner onboarding and credit-based booking flow:

1. **Staff** creates an invitation with assigned rooms
2. **Owner** receives invitation link/email
3. **Owner** registers and accepts invitation  
4. **Owner** converts rooms to credits OR confirms as bookings
5. **Owner** uses credits to book marketplace rooms
6. **Staff** approves the credit booking request
7. **Booking** is confirmed and credits are deducted

---

## Phase 1: Staff Creates Owner Invitation

### Step 1.1: Login as Staff

**URL:** `http://localhost:5173/login` (or your frontend URL)

**Credentials:**
- Email: `staff@example.com`
- Password: (your staff password)

### Step 1.2: Navigate to Create Invitation

**Navigation:**
- Click **"Invitar Propietario"** in the sidebar
- Or go directly to: `http://localhost:5173/staff/create-owner-invitation`

### Step 1.3: Fill Invitation Form

**Owner Information:**
```
Email: newowner@example.com
First Name: John (optional)
Last Name: Doe (optional)
```

**Assigned Rooms:**
For each room assignment:
1. Click **"+ Add Room"** 
2. Select **Room** from dropdown (only rooms from your property appear)
3. Enter **Check-in Date** (e.g., 2026-02-01)
4. Enter **Check-out Date** (e.g., 2026-02-08)
5. Select **Room Type**: 
   - STANDARD
   - SUPERIOR
   - DELUXE
   - SUITE
   - PRESIDENTIAL

**Example Room Assignment:**
```json
{
  "room_id": 5,
  "start_date": "2026-02-01",
  "end_date": "2026-02-08",
  "room_type": "DELUXE"
}
```

**Expiration:**
- Set expiration days (default: 30 days)

### Step 1.4: Create Invitation

1. Click **"Create Invitation"** button
2. System validates and creates invitation
3. Generates unique invitation link
4. **Automatically sends email** to the owner (if email service is configured)

**Success Response:**
```json
{
  "success": true,
  "data": {
    "invitation": {
      "id": 123,
      "token": "abc123xyz789...",
      "email": "newowner@example.com",
      "property_id": 1,
      "rooms_count": 1,
      "expires_at": "2026-02-12T00:00:00.000Z",
      "invitation_link": "http://localhost:5173/staff/invitation/abc123xyz789",
      "email_sent": true
    }
  }
}
```

### Step 1.5: Share Invitation Link

**Copy Link:**
- Click the **copy button** next to the invitation link
- Share via email, WhatsApp, or other channels

**Or Send Email:**
- Click **"Send Email"** button
- Opens default email client with pre-filled template

---

## Phase 2: Owner Receives and Accepts Invitation

### Step 2.1: Owner Opens Invitation Link

**URL Format:**
```
http://localhost:5173/staff/invitation/{token}
```

**Example:**
```
http://localhost:5173/staff/invitation/abc123xyz789
```

### Step 2.2: Review Invitation Details

**Invitation Preview Page Shows:**
- Property name and location
- Number of rooms included
- List of room assignments with dates
- Estimated credits (calculated automatically)
- Expiration date

**Example Preview:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Welcome to Secret World Hotels!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Property: Maldives Resort
Location: Maldives

Assigned Rooms:
┌────────────────────────────────────┐
│ Room 205 - Deluxe Ocean View       │
│ Check-in:  Feb 1, 2026             │
│ Check-out: Feb 8, 2026             │
│ Duration:  7 nights                │
│ Est. Credits: ~700 credits         │
└────────────────────────────────────┘

Total Estimated Credits: 700 credits
(Based on property tier, season, and room type)

Expires: Feb 12, 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 2.3: Register Account

**Click "Accept Invitation" → Registration Form**

**Required Fields:**
- Email: (pre-filled from invitation)
- Password: (minimum 8 characters)
- Confirm Password
- First Name: (may be pre-filled)
- Last Name: (may be pre-filled)
- Phone: (optional)

**Terms:**
- ☑️ Accept Terms & Conditions

**Click "Register" Button**

### Step 2.4: Choose Acceptance Type

**After registration, owner must choose:**

#### Option A: Accept as Bookings
```
┌─────────────────────────────────────────┐
│  📅 ACCEPT AS BOOKINGS                  │
├─────────────────────────────────────────┤
│ • Creates pending reservations          │
│ • You can confirm each booking later    │
│ • Or convert individual bookings to     │
│   credits later                         │
│                                         │
│ Use this if: You plan to stay at       │
│              these specific dates       │
└─────────────────────────────────────────┘
```

#### Option B: Convert to Credits (Recommended)
```
┌─────────────────────────────────────────┐
│  💳 CONVERT TO CREDITS                  │
├─────────────────────────────────────────┤
│ • Immediate credit deposit              │
│ • Maximum flexibility                   │
│ • Use credits at any property           │
│ • Book any available dates              │
│                                         │
│ Use this if: You want maximum          │
│              flexibility                │
└─────────────────────────────────────────┘
```

**For this guide, we'll choose: "Convert to Credits"**

### Step 2.5: Credits Are Deposited

**System Actions:**
1. Creates Week records (7 nights each)
2. Detects season type (RED/BLUE/WHITE) from calendar
3. Calculates credits using Master Formula:
   ```
   Credits = Base_Season_Value × Tier_Multiplier × Location_Multiplier × Room_Type_Multiplier
   ```
4. Creates NightCredit records with 18-month expiry
5. Updates owner role and permissions

**Success Screen:**
```
✅ Credits Successfully Deposited!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your Credit Balance: 700 credits

Breakdown:
• Room 205 (Feb 1-8): 700 credits
  - Season: RED (high season)
  - Property Tier: Premium
  - Room Type: Deluxe

Expiration: August 1, 2027
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Phase 3: Owner Navigates to Dashboard

### Step 3.1: Owner Dashboard Overview

**Automatic Redirect:** After accepting invitation, owner is redirected to dashboard

**URL:** `http://localhost:5173/owner/dashboard`

**Dashboard Shows:**
```
┌─────────────────────────────────────────────┐
│  Welcome back, John!                        │
├─────────────────────────────────────────────┤
│                                             │
│  💳 Credit Balance                          │
│  ┌───────────────────────────────────────┐ │
│  │  Available: 700 credits                │ │
│  │  Expiring in 30 days: 0                │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  📊 Quick Stats                             │
│  • Weeks: 1                                 │
│  • Active Swaps: 0                          │
│  • Upcoming Bookings: 0                     │
│                                             │
│  🎯 Quick Actions                           │
│  [View Credits] [Browse Marketplace]        │
│  [My Weeks]     [Swap Requests]             │
└─────────────────────────────────────────────┘
```

---

## Phase 4: Owner Views Credit Wallet

### Step 4.1: Navigate to Credits Page

**Navigation:**
- Click **"Credits"** in sidebar
- Or go to: `http://localhost:5173/owner/credits`

### Step 4.2: Credits Overview

**Credits Page Shows:**

**Wallet Summary:**
```
┌─────────────────────────────────────────────┐
│  💰 Your Credit Wallet                      │
├─────────────────────────────────────────────┤
│  Total Balance:     700 credits             │
│  Total Earned:      700 credits             │
│  Total Spent:       0 credits               │
│  Expiring in 30d:   0 credits               │
└─────────────────────────────────────────────┘
```

**Active Credits:**
```
┌─────────────────────────────────────────────┐
│  📦 Active Credit Packages                  │
├─────────────────────────────────────────────┤
│  Credit #1: 700 credits                     │
│  • From: Room 205 (Maldives Resort)         │
│  • Deposited: Jan 12, 2026                  │
│  • Expires: July 12, 2027                   │
│  • Status: ACTIVE                           │
└─────────────────────────────────────────────┘
```

**Transaction History:**
```
┌─────────────────────────────────────────────┐
│  📋 Recent Transactions                     │
├─────────────────────────────────────────────┤
│  Jan 12, 2026                               │
│  + 700 credits - Week deposit               │
│    Room 205, 7 nights (Deluxe, RED season)  │
└─────────────────────────────────────────────┘
```

**Action Buttons:**
```
[Create Night Credit Request] [View My Requests]
```

---

## Phase 5: Owner Browses Marketplace

### Step 5.1: Navigate to Marketplace

**Navigation:**
- Click **"Marketplace"** in sidebar  
- Or go to: `http://localhost:5173/marketplace`

### Step 5.2: Search for Rooms

**Search Filters:**
```
┌─────────────────────────────────────────────┐
│  🔍 Search Available Rooms                  │
├─────────────────────────────────────────────┤
│  Location: [All Locations ▼]                │
│  Check-in:  [March 1, 2026]                 │
│  Check-out: [March 5, 2026]                 │
│  Guests:    [2 ▼]                           │
│                                             │
│  [Search Rooms]                             │
└─────────────────────────────────────────────┘
```

### Step 5.3: View Search Results

**Example Results:**
```
┌─────────────────────────────────────────────┐
│  🏨 Available Rooms (4 nights)              │
├─────────────────────────────────────────────┤
│                                             │
│  Barcelona Beach Resort                     │
│  ┌─────────────────────────────────────┐   │
│  │ 🛏️ Standard Ocean View               │   │
│  │ €120/night × 4 nights = €480        │   │
│  │ OR: 320 credits                     │   │
│  │                                     │   │
│  │ [Book with Card] [Book with Credits]│   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ 🛏️ Deluxe Suite                      │   │
│  │ €200/night × 4 nights = €800        │   │
│  │ OR: 520 credits                     │   │
│  │                                     │   │
│  │ [Book with Card] [Book with Credits]│   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

**Note:** Credit cost is calculated dynamically based on:
- Property tier
- Season (RED/BLUE/WHITE)
- Room type
- Duration (4 nights)

---

## Phase 6: Owner Books with Credits

### Step 6.1: Click "Book with Credits"

**Navigates to:** Booking form with credit payment pre-selected

### Step 6.2: Review Booking Details

**Booking Summary:**
```
┌─────────────────────────────────────────────┐
│  📝 Booking Summary                         │
├─────────────────────────────────────────────┤
│  Property: Barcelona Beach Resort           │
│  Room: Standard Ocean View                  │
│  Check-in: March 1, 2026                    │
│  Check-out: March 5, 2026                   │
│  Duration: 4 nights                         │
│                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Payment Method: Credits                    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                             │
│  Credit Cost Breakdown:                     │
│  • Base rate: 80 credits/night              │
│  • Season multiplier: ×1.0 (WHITE)          │
│  • Room multiplier: ×1.0 (Standard)         │
│  • Total: 320 credits (4 nights)            │
│                                             │
│  Your Balance: 700 credits                  │
│  After Booking: 380 credits remaining       │
└─────────────────────────────────────────────┘
```

### Step 6.3: Enter Guest Information

**Guest Details Form:**
```
Full Name: [John Doe]
Email: [newowner@example.com] (pre-filled)
Phone: [+1234567890]

Special Requests: [Optional text area]
```

### Step 6.4: Accept Terms and Submit

**Terms:**
```
☑️ I accept the booking terms and conditions
☑️ I understand this booking requires staff approval
```

**Click:** `[Confirm Booking with Credits]`

### Step 6.5: Booking Request Created

**Success Message:**
```
✅ Booking Request Submitted!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your booking request has been created and
is awaiting staff approval.

Request ID: #1234
Status: PENDING APPROVAL

What happens next:
1. Staff will review availability
2. Staff will approve or reject within 24h
3. You'll receive email notification
4. Credits will be deducted upon approval

Your credits are temporarily reserved.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[View My Bookings] [Back to Marketplace]
```

**System Actions:**
1. Creates Booking record with `status: 'pending_approval'`
2. Creates `payment_method: 'CREDITS'` entry
3. Reserves 320 credits (temporary hold)
4. Sends notification to property staff
5. Sends confirmation email to owner

---

## Phase 7: Owner Tracks Booking Status

### Step 7.1: Navigate to My Bookings

**URL:** `http://localhost:5173/owner/bookings`

### Step 7.2: View Pending Bookings

**Bookings List:**
```
┌─────────────────────────────────────────────┐
│  📅 My Bookings                             │
├─────────────────────────────────────────────┤
│                                             │
│  🟡 PENDING APPROVAL                        │
│  ┌─────────────────────────────────────┐   │
│  │ Barcelona Beach Resort              │   │
│  │ Standard Ocean View                 │   │
│  │ March 1-5, 2026 (4 nights)         │   │
│  │                                     │   │
│  │ Payment: 320 credits (reserved)     │   │
│  │ Status: Awaiting staff approval     │   │
│  │                                     │   │
│  │ Submitted: Jan 12, 2026 10:30 AM   │   │
│  │                                     │   │
│  │ [View Details] [Cancel Request]     │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### Step 7.3: Check Credit Wallet

**Navigate to:** `http://localhost:5173/owner/credits`

**Wallet Shows:**
```
┌─────────────────────────────────────────────┐
│  💰 Your Credit Wallet                      │
├─────────────────────────────────────────────┤
│  Total Balance:     700 credits             │
│  Available:         380 credits             │
│  Reserved:          320 credits (pending)   │
└─────────────────────────────────────────────┘

Recent Transactions:
• Jan 12, 10:30 AM - Reserved 320 credits
  Booking #1234 (Barcelona - pending)
```

---

## Phase 8: Staff Approves Booking

### Step 8.1: Staff Login

**Staff User:** `staff@barcelona-beach.com`

**Navigate to:** `http://localhost:5173/staff/bookings`

### Step 8.2: View Pending Requests

**Pending Credit Bookings Tab:**
```
┌─────────────────────────────────────────────┐
│  ⚠️ Pending Credit Booking Requests (1)     │
├─────────────────────────────────────────────┤
│                                             │
│  Request #1234                              │
│  ┌─────────────────────────────────────┐   │
│  │ Guest: John Doe                     │   │
│  │ Room: Standard Ocean View           │   │
│  │ Check-in: March 1, 2026             │   │
│  │ Check-out: March 5, 2026            │   │
│  │ Duration: 4 nights                  │   │
│  │                                     │   │
│  │ Payment: 320 credits                │   │
│  │ Owner Balance: 700 credits          │   │
│  │                                     │   │
│  │ Conflicts: ✅ None                  │   │
│  │ Availability: ✅ Room available     │   │
│  │                                     │   │
│  │ [✅ Approve] [❌ Reject]             │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### Step 8.3: Review and Approve

**Staff Clicks:** `[✅ Approve]`

**Approval Modal:**
```
┌─────────────────────────────────────────────┐
│  Approve Booking Request #1234              │
├─────────────────────────────────────────────┤
│                                             │
│  Guest: John Doe (newowner@example.com)     │
│  Dates: March 1-5, 2026                     │
│  Cost: 320 credits                          │
│                                             │
│  Notes (optional):                          │
│  ┌───────────────────────────────────────┐ │
│  │ Room confirmed. Breakfast included.   │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  [Cancel] [Confirm Approval]                │
└─────────────────────────────────────────────┘
```

**Staff Clicks:** `[Confirm Approval]`

### Step 8.4: System Processing

**Automated Actions:**
1. ✅ Updates booking `status: 'confirmed'`
2. ✅ Deducts 320 credits from owner wallet
3. ✅ Creates credit transaction record
4. ✅ Updates room availability calendar
5. ✅ Sends confirmation email to owner
6. ✅ Updates staff dashboard
7. ✅ Syncs with PMS (if integrated)

**Success Message (Staff):**
```
✅ Booking Approved Successfully!

Booking #1234 confirmed
Owner credits deducted: 320
Owner remaining balance: 380 credits
Confirmation email sent to owner
```

---

## Phase 9: Owner Receives Confirmation

### Step 9.1: Email Notification

**Owner Receives:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🎉 Booking Confirmed!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Dear John,

Your booking has been approved!

Booking Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Property: Barcelona Beach Resort
Room: Standard Ocean View
Check-in: March 1, 2026 (3:00 PM)
Check-out: March 5, 2026 (11:00 AM)
Confirmation: #BCN-1234-2026

Payment Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Paid with Credits: 320 credits
Remaining Balance: 380 credits

Staff Notes:
Room confirmed. Breakfast included.

[View Booking Details]
[Contact Property]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 9.2: Updated Dashboard

**Owner Portal Updates:**

**My Bookings:**
```
🟢 CONFIRMED
┌─────────────────────────────────────┐
│ Barcelona Beach Resort              │
│ Standard Ocean View                 │
│ March 1-5, 2026 (4 nights)         │
│                                     │
│ Confirmation: #BCN-1234-2026        │
│ Paid: 320 credits                   │
│ Status: ✅ Confirmed                │
│                                     │
│ [View Details] [Contact Property]   │
└─────────────────────────────────────┘
```

**Credit Wallet:**
```
💰 Your Credit Wallet
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Balance:     380 credits
Total Earned:      700 credits
Total Spent:       320 credits
Expiring in 30d:   0 credits

Recent Transactions:
• Jan 12, 10:35 AM - Spent 320 credits
  Booking #1234 confirmed (Barcelona)
  New balance: 380 credits
```

---

## Summary of Complete Flow

### Timeline Overview

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  STAFF                     SYSTEM                  OWNER    │
│    │                         │                       │      │
│    │ 1. Create Invitation    │                       │      │
│    ├────────────────────────>│                       │      │
│    │                         │                       │      │
│    │                         │ 2. Send Email         │      │
│    │                         ├──────────────────────>│      │
│    │                         │                       │      │
│    │                         │   3. Register         │      │
│    │                         │<──────────────────────┤      │
│    │                         │                       │      │
│    │                         │   4. Convert to       │      │
│    │                         │      Credits          │      │
│    │                         │<──────────────────────┤      │
│    │                         │                       │      │
│    │                         │ 5. Credits Deposited  │      │
│    │                         ├──────────────────────>│      │
│    │                         │                       │      │
│    │                         │   6. Browse           │      │
│    │                         │      Marketplace      │      │
│    │                         │<──────────────────────┤      │
│    │                         │                       │      │
│    │                         │   7. Book with        │      │
│    │                         │      Credits          │      │
│    │                         │<──────────────────────┤      │
│    │                         │                       │      │
│    │ 8. Approval Notification│                       │      │
│    │<────────────────────────┤                       │      │
│    │                         │                       │      │
│    │ 9. Approve Booking      │                       │      │
│    ├────────────────────────>│                       │      │
│    │                         │                       │      │
│    │                         │ 10. Confirmation      │      │
│    │                         ├──────────────────────>│      │
│    │                         │                       │      │
└─────────────────────────────────────────────────────────────┘
```

### Key Endpoints Used

**Staff (Backend):**
```
POST   /api/staff/invitations/create-owner-invitation
GET    /api/staff/invitations/my-invitations
GET    /api/hotel-staff/rooms
POST   /api/staff/bookings/approve-credit-booking/:id
```

**Owner (Backend):**
```
GET    /api/staff/invitations/verify/{token}
POST   /api/staff/invitations/accept-invitation
POST   /api/auth/register (with invitation_token)
GET    /api/timeshare/night-credits
GET    /api/credits/wallet
GET    /api/marketplace/search
POST   /api/bookings/create-with-credits
GET    /api/owner/bookings
```

### Frontend Pages Involved

**Staff Portal:**
- `/staff/create-owner-invitation`
- `/staff/bookings`
- `/staff/invitations`

**Owner Portal:**
- `/staff/invitation/{token}` (public)
- `/register` (with invitation)
- `/owner/dashboard`
- `/owner/credits`
- `/marketplace`
- `/marketplace/booking/:propertyId/:roomId`
- `/owner/bookings`

### Database Tables Modified

**During Invitation Creation:**
- `owner_invitations` (INSERT)

**During Acceptance:**
- `users` (UPDATE role to 'owner')
- `weeks` (INSERT)
- `night_credits` (INSERT)
- `credit_transactions` (INSERT)
- `user_credit_wallets` (UPDATE)

**During Booking:**
- `bookings` (INSERT with pending status)
- `credit_transactions` (INSERT reservation)

**During Approval:**
- `bookings` (UPDATE to confirmed)
- `credit_transactions` (UPDATE to completed)
- `user_credit_wallets` (UPDATE balance)

---

## Testing Checklist

### Staff Testing
- [ ] Staff can login and access invitation creation
- [ ] Staff can select rooms from their property only
- [ ] Staff can set dates and room types
- [ ] Invitation link is generated correctly
- [ ] Email is sent (if configured)
- [ ] Staff can view pending invitations
- [ ] Staff can cancel unused invitations

### Owner Testing
- [ ] Invitation link works (not expired)
- [ ] Registration form pre-fills email
- [ ] Owner can choose booking vs credits
- [ ] Credits are deposited correctly
- [ ] Credit balance shows on dashboard
- [ ] Owner can browse marketplace
- [ ] Credit cost is calculated correctly
- [ ] Owner can create booking with credits
- [ ] Owner receives confirmation email

### Staff Approval Testing
- [ ] Staff sees pending credit requests
- [ ] Availability conflicts are detected
- [ ] Staff can approve with notes
- [ ] Credits are deducted on approval
- [ ] Booking status updates correctly
- [ ] Owner receives approval notification

### Integration Testing
- [ ] End-to-end flow completes successfully
- [ ] Credits balance updates in real-time
- [ ] Email notifications work
- [ ] Transaction history is accurate
- [ ] No credit double-spending
- [ ] Proper error handling throughout

---

## Troubleshooting

### Common Issues

**Issue 1: Invitation Link Expired**
```
Error: "Invitation has expired"
Solution: Staff must create a new invitation
```

**Issue 2: Insufficient Credits**
```
Error: "Insufficient credits for this booking"
Solution: Owner needs to:
- Convert more weeks to credits
- Choose a cheaper room/shorter stay
- Use hybrid payment (credits + card)
```

**Issue 3: Room Not Available**
```
Error: "Room not available for selected dates"
Solution: 
- Choose different dates
- Select different room type
- Staff must update room availability
```

**Issue 4: Booking Stuck in Pending**
```
Status: "Pending approval" for > 48h
Solution:
- Contact property staff
- Staff may be unavailable
- Check staff dashboard for alerts
```

### Support Contacts

**For Staff Issues:**
- Admin: admin@secretworldhotels.com
- Support: support@secretworldhotels.com

**For Owner Issues:**
- Help Center: help.secretworldhotels.com
- Live Chat: Available in owner portal

---

## Additional Resources

**Related Documentation:**
- `NIGHT_CREDITS_EXPLAINED.md` - Credit system details
- `CREDIT_SYSTEM_API.md` - API documentation
- `TESTING_GUIDE.md` - Testing procedures
- `INTEGRATION_TEST_GUIDE.md` - Integration testing

**Video Tutorials:**
- Staff Invitation Creation (Coming soon)
- Owner Registration Process (Coming soon)
- Credit-Based Booking Flow (Coming soon)

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-12 | 1.0 | Initial complete guide created |

---

**End of Guide**

For questions or feedback, contact: dev-team@secretworldhotels.com

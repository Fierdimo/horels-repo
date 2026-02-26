# SW2 - Timeshare & Hotel Marketplace Platform

Complete platform for timeshare management and hotel marketplace with integrated Stripe payments.
> live demo: http://78.111.67.191/

---

## 📋 Project Structure

```
hotels/
├── backend/          # Node.js/Express/TypeScript API
├── frontend/         # React/TypeScript/Vite web application
└── README.md         # This file
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+**
- **npm or yarn**
- **MariaDB/MySQL**
- **Stripe Account** (test mode for development)

### Installation

```bash
# Clone the repository
git clone https://github.com/sworldDev/hotels.git
cd hotels

# Install backend dependencies
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration

# Install frontend dependencies
cd ../frontend
npm install
cp .env.example .env
# Edit .env with your configuration
```

### Database Setup

```bash
cd backend
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all
```

### Running the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
Backend runs on: http://localhost:3000

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Frontend runs on: http://localhost:5173

---

## 📚 Documentation

- **[Backend Documentation](./backend/README-BACKEND.md)** - API, database, Stripe integration
- **[Frontend Documentation](./frontend/README.md)** - Components, routing, state management
- **[API Documentation](./backend/API_DOCUMENTATION.md)** - Complete API reference
- **[Credit System Analysis](./CREDIT_SYSTEM_ANALYSIS.md)** - Detailed credit system documentation
- **[PMS Architecture](./ROOMS_PMS_ARCHITECTURE.md)** - PMS integration patterns

---

## 🎯 Features

### Marketplace & Payments
- ✅ Public hotel room marketplace
- ✅ Complete Stripe payment integration
- ✅ Saved payment methods for returning users
- ✅ User profile management with auto-fill
- ✅ 3D Secure / SCA authentication
- ✅ Webhook integration for payment status updates

### Timeshare Management
- ✅ Week ownership and management
- ✅ P2P exchanges between owners
- ✅ **Variable Credit System** - RCI/Interval-style valuation
- ✅ Credit deposits with 6-month expiration
- ✅ Hybrid payments (credits + cash top-up)
- ✅ Flexible booking with dynamic pricing
- ✅ **Owner Invitation System** - Invite new owners via email
- ✅ **Staff Approval Workflow** - Bookings require staff confirmation
- ✅ Automated email notifications via Mailgun

### Guest Features
- ✅ Token-based quick access
- ✅ Service requests
- ✅ Booking management
- ✅ Real-time notifications

### Administration
- ✅ Multi-property management
- ✅ User management and approval workflows
- ✅ Activity logs and monitoring
- ✅ Platform settings configuration
- ✅ Room and property management
- ✅ Property tier management (DIAMOND, GOLD, SILVER+, STANDARD)
- ✅ Seasonal calendar configuration (RED/WHITE/BLUE periods)
- ✅ Credit pricing and rate management
- ✅ **Owner invitation management** - Create and send invitations
- ✅ **Booking approval system** - Review and approve owner invitations
- ✅ **Email integration** - Automated notifications via Mailgun

---

## 💳 Credit System

The platform implements a sophisticated credit-based booking system inspired by RCI/Interval International:

### Credit Calculation Formula
```
Credits = [Base Season Value] × [Location Multiplier] × [Room Type Multiplier]
```

### Season Base Values
- **RED** (High Season): 1000 credits
- **WHITE** (Mid Season): 600 credits
- **BLUE** (Low Season): 300 credits

### Property Tiers & Multipliers
- **DIAMOND**: 1.5× (Premium properties)
- **GOLD HIGH**: 1.3×
- **GOLD**: 1.2×
- **SILVER PLUS**: 1.1×
- **STANDARD**: 1.0× (Base properties)

### Room Type Multipliers
- **Standard**: 1.0× (Base rooms)
- **Superior**: 1.2×
- **Deluxe**: 1.5×
- **Suite**: 2.0×
- **Presidential**: 3.0×

### Key Features
- ⏱️ **6-month expiration** from deposit date
- 💱 **1:1 Credit-to-Euro ratio** (admin configurable)
- 🔄 **Hybrid payments** - Use credits + cash for upgrades
- 📊 **Week claim system** - Users can claim ownership of legacy weeks
- ⚖️ **Inter-property settlements** - Automated financial reconciliation
- 📝 **Full audit trail** - All credit movements tracked
- 🏨 **Cross-property redemption** - Use credits in any PMS-integrated hotel

### Cross-Property Credit Model

**Current Implementation:**
The system allows users to deposit weeks at one property and redeem credits at any other property in the network. This follows the RCI/Interval International exchange model where credits are "universal currency" across the entire portfolio.

**Settlement Logic:**
- **Internal Properties** (PMS-integrated hotels): Compensated through internal accounting reconciliation tracked in `inter_property_settlements` table
- Credits deposited at Property A can be redeemed at Property B
- System tracks originating vs receiving properties for monthly settlement reports
- No real cash flow between properties - purely accounting adjustments

**Future Considerations (Pending Client Decision):**
- **External Network Integration**: If external hotels join the network, implementation will require:
  - Pre-negotiated net rates with external properties
  - Outbound payment system (Stripe Connect or bank transfers)
  - Revenue model based on: swap fees (€99), top-up payments, net rate markup
  - Liquidity management for monthly external settlements
- **Current Scope**: System designed for internal group properties only
- **Decision Required**: How to handle monetary settlements if external properties are added

### Database Tables
The system includes 11 new optimized tables:
- `platform_settings` - Dynamic system configuration
- `property_tiers` - Property classification and multipliers
- `room_type_multipliers` - Room upgrade pricing
- `seasonal_calendar` - Date-based season definitions
- `user_credit_wallets` - User balance tracking
- `credit_transactions` - All credit movements (high-volume optimized)
- `credit_booking_costs` - Dynamic pricing per property/season
- `ancillary_services` - Add-on services (spa, dining, etc.)
- `booking_ancillary_services` - Service-booking relationships
- `week_claim_requests` - Week ownership verification
- `inter_property_settlements` - Cross-property payment tracking
- `setting_change_log` - Configuration audit trail

### Performance Optimizations
- 🚀 **7 strategic indexes** on `credit_transactions` for sub-second queries
- 📈 **Composite indexes** for complex multi-column searches
- 🔒 **Row-level locking** for concurrent wallet updates
- 💾 **Denormalized balances** to avoid expensive SUM() operations
- 📊 **Query-optimized data types** (ENUM, DECIMAL, TINYINT)

---

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js with TypeScript
- **Database**: MySQL/MariaDB with Sequelize ORM
- **Payments**: Stripe API (Payment Intents, Customers, Webhooks)
- **Authentication**: JWT
- **Testing**: Vitest

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS
- **State Management**: Zustand + TanStack Query
- **Routing**: React Router 6
- **Payments**: Stripe Elements
- **i18n**: react-i18next (EN, ES, DE, FR)

---

## 🔐 Environment Variables

### Backend (.env)
```env
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173

DB_HOST=localhost
DB_PORT=3306
DB_NAME=sw2_db
DB_USER=root
DB_PASSWORD=your_password

JWT_SECRET=your_jwt_secret

STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email Configuration - Mailgun
MAILGUN_API_KEY=your-mailgun-api-key-here
MAILGUN_DOMAIN=your-mailgun-domain.mailgun.org
MAILGUN_URL=https://api.mailgun.net
EMAIL_FROM=noreply@your-domain.com
EMAIL_FROM_NAME=Timeshare Exchange Platform
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3000/api
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

---

## 📦 Build & Deployment

### Backend
```bash
cd backend
npm run build
npm start
```

### Frontend
```bash
cd frontend
npm run build
# Serves from dist/ folder
```

---

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test
```

### Frontend Tests
```bash
cd frontend
npm test
```

---

## 📈 Development Status

### ✅ Completed Features
- Complete Stripe payment integration (marketplace bookings)
- User profile management and saved payment methods
- Public marketplace with room browsing and booking
- Timeshare week management and P2P exchanges
- **Variable credit system with dynamic valuation** (December 2025)
- **Owner invitation system with staff approval workflow** (December 2025)
- **Email integration via Mailgun** (December 2025)
- Multi-language support (EN, ES)
- User authentication and authorization
- Admin dashboard with user management
- PMS integration framework (Mews, Cloudbeds, ResNexus)
- Property tier management and seasonal calendars
- Week claim workflow with admin approval
- Inter-property financial settlements

### 🚧 In Progress
- Enhanced reporting and analytics
- Mobile app integration (React Native)
- Additional PMS connectors
- Advanced search and filters

### 📋 Planned Features
- Multi-currency support
- Advanced booking rules
- Loyalty program integration
- SMS notifications

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📝 License

This project is proprietary software. All rights reserved.

---

## 📧 Support

For support and questions, please contact the development team.

---

## 🎯 Recent Updates

### Owner Invitation System with Staff Approval (December 30, 2025)
**Complete workflow for owners to invite new members:**

- ✅ **OwnerInvitation Model** - Track invitation status and metadata
- ✅ **Email Integration** - Automated emails via Mailgun API
- ✅ **Unique Registration Links** - Token-based invitation acceptance
- ✅ **Staff Approval Workflow** - Bookings pending_approval status
- ✅ **Dashboard Updates** - Owner dashboard shows all booking types
- ✅ **Stats Classification** - Separate counts for invitations vs marketplace
- ✅ **Recent Activity** - Combined view of weeks and bookings
- ✅ **Staff Management** - Review and approve/reject bookings

### Key Features:
- **Owner Portal**: Create invitations with property/season selection
- **Email Notifications**: Automatic welcome emails with registration links
- **Staff Review**: Dedicated page for pending booking approvals
- **Unified Credits**: Single credit system for all booking types
- **Dashboard Stats**: Accurate counting of weeks + invitation bookings + marketplace bookings

### Database:
- `owner_invitations` - Invitation tracking (pending/sent/registered/expired)
- `bookings` - Extended metadata with booking_type field
- Modified dashboard endpoints to count all booking sources

### Dynamic PMS Product Integration (December 27, 2025)
**Complete refactoring of guest services to use real-time PMS products:**

- ✅ **ProductSyncService** - Automatic sync from Mews Products API
- ✅ **Parallel Sync** - Rooms and products sync simultaneously for optimal UX
- ✅ **Dynamic Service Display** - Guest services based on property's PMS configuration
- ✅ **Availability Checks** - Hide service buttons when no products configured
- ✅ **8 Product Categories** - Breakfast, Cleaning, Minibar, Parking, Spa, Excursion, Transport, Other
- ✅ **Multi-language Support** - Complete translations in 5 languages (ES, EN, FR, DE, IT)
- ✅ **Database Schema Fix** - Corrected AncillaryService columns (price_credits, price_euros)
- ✅ **Staff Product Management** - View and sync products from /staff/products
- ✅ **Public API Endpoint** - GET /api/public/properties/:propertyId/products

### Key Features:
- **PMS-Only Architecture**: No hardcoded services, everything from PMS catalog
- **Property-Specific**: Each property shows only its configured products
- **Real-time Sync**: Staff can trigger manual sync anytime
- **Guest Experience**: Seamless service requests with live product availability

### Variable Credit System Implementation (December 25, 2025)
**Major architectural upgrade from simple night credits to RCI/Interval-style variable valuation:**

- ✅ **Credit Calculation Engine** - Dynamic formula: Base × Location × Room Type
- ✅ **5 Property Tiers** - From DIAMOND (1.5×) to STANDARD (1.0×)
- ✅ **Seasonal Calendar** - RED/WHITE/BLUE periods per property
- ✅ **Room Type Multipliers** - Standard to Presidential Suite pricing
- ✅ **6-Month Expiration** - Automatic credit expiration tracking
- ✅ **Hybrid Payments** - Credits + cash top-up for upgrades
- ✅ **Week Claim System** - Users can claim legacy week ownership
- ✅ **Inter-Property Settlements** - Automated financial reconciliation
- ✅ **Full Audit Trail** - All configuration changes logged
- ✅ **Performance Optimized** - 7 strategic indexes on high-volume tables

### Database Migrations (15 new migrations)
- Dropped legacy `night_credits`, `fees`, `night_credit_requests` tables
- Created 11 new optimized credit system tables
- Modified `properties` (tier_id, credit flags)
- Modified `weeks` (deposit tracking, season snapshots)
- Modified `bookings` (payment_method: CREDITS/EUROS/HYBRID/P2P_SWAP)

### Stripe Payment Integration (Earlier December 2025)
- Implemented complete payment flow with Payment Intents API
- Added support for saved payment methods (Stripe Customers)
- Integrated 3D Secure authentication
- Setup webhook handlers for real-time payment status updates
- Added platform fees (10% commission from PlatformSetting)

### User Profiles
- Added user profile management (firstName, lastName, phone, address)
- Implemented profile auto-fill in booking forms
- Added option to save information for future bookings

### Developer Experience
- Updated READMEs with complete documentation
- Added test mode pricing (€10/night) for development
- Improved TypeScript types and error handling
- Optimized build configuration
- **Clean migration system** - Production-ready, no correction migrations
- Reorganized repository as monorepo structure

---

**Built with ❤️ for the timeshare and hospitality industry**

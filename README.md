# SW2 - Timeshare & Hotel Marketplace Platform

Complete platform for timeshare management and hotel marketplace with integrated Stripe payments.

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
- ✅ Night credit conversion system
- ✅ Flexible booking with credits

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
- Night credit system with approval workflow
- Multi-language support (EN, ES)
- User authentication and authorization
- Admin dashboard with user management
- PMS integration framework (Mews, Cloudbeds, ResNexus)

### 🚧 In Progress
- Enhanced reporting and analytics
- Mobile app integration (React Native)
- Additional PMS connectors
- Advanced search and filters

### 📋 Planned Features
- Multi-currency support
- Email notifications
- Advanced booking rules
- Loyalty program integration

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

## 🔄 Recent Updates (December 2025)

### Stripe Payment Integration
- Implemented complete payment flow with Payment Intents API
- Added support for saved payment methods (Stripe Customers)
- Integrated 3D Secure authentication
- Setup webhook handlers for real-time payment status updates

### User Profiles
- Added user profile management (firstName, lastName, phone, address)
- Implemented profile auto-fill in booking forms
- Added option to save information for future bookings

### Database Schema
- Added `stripe_customer_id` to users table
- Added `payment_intent_id`, `payment_status`, `guest_phone` to bookings table
- Created migrations for all new fields

### Developer Experience
- Updated READMEs with complete documentation
- Added test mode pricing (€10/night) for development
- Improved TypeScript types and error handling
- Optimized build configuration
- Reorganized repository as monorepo structure

---

**Built with ❤️ for the timeshare and hospitality industry**

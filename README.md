# JCB Cleaning Services

Cleaning-service booking system with an admin dashboard and business analytics
(descriptive, predictive, prescriptive).

- **frontend/** React + Vite (port 3000)
- **backend/** Express.js API (port 5000)
- **Database:** Neon (PostgreSQL)

## Setup

1. Backend
   ```
   cd backend
   cp .env.example .env     # then put your Neon connection string in DATABASE_URL
   npm install
   npm run dev
   ```
   On first start the tables are created and an admin and a demo customer are added
   (see `.env.example`).
2. Frontend
   ```
   cd frontend
   npm install
   npm run dev
   ```
   Open http://localhost:3000

## Sample data

```
cd backend
npm run seed              # a few sample customers and bookings
npm run seed:analytics    # 12 months of simulated data (5 variables, 50+ rows each)
```

## Features

- Landing page, sign in / sign up with password rules, dark and light mode
- Customer: book a service, my bookings, profile with photo, notifications
- Admin: bookings, services, customers, contact messages
- Analytics: descriptive, predictive and prescriptive dashboards and a case study page

# Arshi Enterprises

A full-stack business finance management system built for **Arshi Enterprises**. Manage revenue, track dues, monitor expenses, and access role-based reporting — all from a single dashboard.

## Tech Stack

| Layer    | Technology                              |
|----------|-----------------------------------------|
| Frontend | React 18, Vite, Tailwind CSS, Axios     |
| Backend  | Node.js, Express, MongoDB, Mongoose     |
| Auth     | JWT (JSON Web Tokens), bcrypt     
| Deploy   | Vercel (frontend) + Render (backend)    |

## Features

- 🔐 **Role-Based Access** — Admin, Executive, Expense-Only, and Staff panels
- 📊 **Dashboard** — Revenue, expense, and due summaries at a glance
- 💰 **Income & Expense Tracking** — Full CRUD with tagging support
- 📋 **Due Management** — Track outstanding payments per client
- 📄 **Report Export** — Download income/expense reports as PDF or Excel
- 🔍 **Search & Filter** — Vehicle number search, IMEI tracking, date filters
- 👤 **User Management** — Admin can create/manage staff accounts

## Project Structure

```
Arshi-enterprises/
├── backend/
│   ├── server.js              # Express entry point
│   ├── src/
│   │   ├── config/            # Database connection
│   │   ├── controllers/       # Route handlers
│   │   ├── middleware/      |
| Reports  | ExcelJS (PDF & Excel export)            |         # Auth & role middleware
│   │   ├── models/            # Mongoose schemas
│   │   ├── routes/            # API route definitions
│   │   ├── services/          # Business logic
│   │   └── utils/             # Helpers (admin seed, etc.)
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── context/           # Auth context provider
│   │   ├── pages/             # Page-level components
│   │   ├── utils/             # Frontend utilities
│   │   ├── api.js             # Axios instance
│   │   └── App.jsx            # Router & layout
│   ├── .env.example
│   └── package.json
├── render.yaml                # Render deployment config
└── .gitignore
```

## Getting Started

### Prerequisites

- **Node.js** v18+
- **MongoDB** running locally (or an Atlas URI)

### 1. Clone the repo

```bash
git clone https://github.com/rohitstudy70-arch/Arshi-enterprises.git
cd Arshi-enterprises
```

### 2. Setup Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your MongoDB URI, JWT secret, and admin credentials
```

### 3. Setup Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env if your backend runs on a different port
```

### 4. Run Development Servers

**Option A — Run both together (from backend dir):**
```bash
cd backend
npm run dev
```

**Option B — Run separately:**
```bash
# Terminal 1: Backend
cd backend
npm run dev:server

# Terminal 2: Frontend
cd frontend
npm run dev
```

The frontend runs at `http://localhost:5173` and the backend API at `http://localhost:4000`.

## Environment Variables

### Backend (`backend/.env`)

| Variable         | Description                    | Example                            |
|------------------|--------------------------------|------------------------------------|
| `NODE_ENV`       | Environment mode               | `development`                      |
| `PORT`           | Server port                    | `4000`                             |
| `MONGODB_URI`    | MongoDB connection string      | `mongodb://127.0.0.1:27017/authdb` |
| `JWT_SECRET`     | Secret key for JWT signing     | *(min 32 chars, keep secret!)*     |
| `JWT_EXPIRES_IN` | Token expiry duration          | `7d`                               |
| `ADMIN_USERNAME` | Default admin username         | `admin`                            |
| `ADMIN_PASSWORD` | Default admin password         | *(use a strong password!)*         |
| `FRONTEND_URL`   | Frontend URL for CORS          | `http://localhost:5173`            |

### Frontend (`frontend/.env`)

| Variable       | Description       | Example                        |
|----------------|-------------------|--------------------------------|
| `VITE_API_URL` | Backend API URL   | `http://localhost:4000/api`    |

## API Endpoints

| Method | Endpoint               | Description              | Auth |
|--------|------------------------|--------------------------|------|
| POST   | `/api/auth/login`      | Login                    | No   |
| GET    | `/api/dashboard`       | Dashboard stats          | Yes  |
| CRUD   | `/api/incomes`         | Income management        | Yes  |
| CRUD   | `/api/expenses`        | Expense management       | Yes  |
| CRUD   | `/api/expense-tags`    | Expense tag management   | Yes  |
| GET    | `/api/reports/*`       | PDF/Excel report export  | Yes  |
| CRUD   | `/api/due`             | Due tracking             | Yes  |
| CRUD   | `/api/payments`        | Payment management       | Yes  |

## Deployment

- **Frontend** → Deployed on [Vercel](https://vercel.com) (config: `frontend/vercel.json`)
- **Backend** → Deployed on [Render](https://render.com) (config: `render.yaml`)

## License

ISC

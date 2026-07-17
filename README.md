# 🏫 School Management System

A full-stack school report card management system built for Ghanaian JHS schools following the GES grading standard. Manage students, teachers, classes, subjects, scores, and generate term report cards — all from a clean web interface.

---

## ✨ Features

- **Admin Panel** — manage academic years, terms, classes, subjects, teachers, students, grading scales, and report card workflows
- **Teacher Panel** — enter scores per subject and class, track grading progress
- **Report Cards** — auto-generate term report cards with GES A1–F9 grading
- **Cloud Database** — backed by [Neon](https://neon.tech) serverless PostgreSQL
- **Local DB support** — switch between cloud and local Postgres with a single env variable

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TailwindCSS, shadcn/ui, Framer Motion |
| API Server | Node.js, Express 5, Pino |
| Database | PostgreSQL (Neon cloud / local) |
| ORM | Drizzle ORM |
| Validation | Zod |
| Package Manager | pnpm (monorepo) |

---

## 📋 Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/) v20 or later
- [pnpm](https://pnpm.io/installation) v9 or later
- A PostgreSQL database — either:
  - **Cloud (recommended):** [Neon free tier](https://neon.tech)
  - **Local:** PostgreSQL 15+ running on your machine

---

## 🚀 Running Locally

### 1. Clone the repository

```bash
git clone https://github.com/kwameampomah/School_Management_System.git
cd School_Management_System
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Open `.env` and set:

```env
# Choose: cloud (Neon) or local (your machine)
DB_MODE=cloud

# Cloud — get your connection string from https://console.neon.tech
CLOUD_DATABASE_URL=postgresql://<user>:<password>@<host>/neondb?sslmode=require

# Local — your local Postgres
LOCAL_DATABASE_URL=postgresql://postgres:<password>@localhost:5432/school_report

# Generate a strong secret: openssl rand -hex 64
SESSION_SECRET=<your-session-secret>

PORT=8085
VITE_PORT=5173
BASE_PATH=/
NODE_ENV=development
HTTPS=false
```

### 4. Push the database schema

```bash
export $(grep -v '^#' .env | xargs)
pnpm --filter @workspace/db push
```

### 5. Seed the database (optional but recommended)

Populates the database with:
- Admin and teacher accounts
- 3 classes (JHS 1, 2, 3) with 24 students
- 10 GES subjects, grading scale, and sample scores

```bash
pnpm --filter @workspace/scripts seed
```

### 6. Start the API server

Open a terminal and run:

```bash
export $(grep -v '^#' .env | xargs)
pnpm --filter @workspace/api-server dev
```

The API server will start at **http://localhost:8085**

### 7. Start the frontend

Open a **second terminal** and run:

```bash
export $(grep -v '^#' .env | xargs)
pnpm --filter @workspace/school-report dev
```

The frontend will start at **http://localhost:5173**

---

## 🔐 Default Login Credentials

> These are only created after running the seed script (step 5).

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@school.gh` | `admin123` |
| **Teacher** | `teacher@school.gh` | `teacher123` |

---

## 📁 Project Structure

```
School_Management_System/
├── artifacts/
│   ├── api-server/        # Express API server
│   └── school-report/     # React frontend
├── lib/
│   ├── db/                # Drizzle ORM schema & database connection
│   ├── api-spec/          # OpenAPI spec
│   ├── api-zod/           # Zod-validated API types (generated)
│   └── api-client-react/  # React Query API client (generated)
├── scripts/
│   └── src/seed.ts        # Database seed script
├── .env.example           # Environment variable template
├── .neon/project.json     # Neon cloud project link
└── pnpm-workspace.yaml    # Monorepo workspace config
```

---

## 🔄 Switching Between Cloud and Local Database

Edit `DB_MODE` in your `.env` file — no code changes needed:

```env
DB_MODE=cloud   # → connects to Neon (CLOUD_DATABASE_URL)
DB_MODE=local   # → connects to your local PostgreSQL (LOCAL_DATABASE_URL)
```

Remember to re-run `pnpm --filter @workspace/db push` and the seed script when switching to a fresh database.

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first.

---

## 📄 License

MIT

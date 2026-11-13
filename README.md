# AI & API FinOps Platform

A cost, quota, and rate-limit monitoring platform for LLMs and external APIs (OpenAI, Anthropic, DeepSeek, Custom API). Built as a modular monolith powered by **Next.js 16**, **PostgreSQL 17**, **Drizzle ORM**, **Redis**, and **BullMQ**.

## System Architecture

The project is organized into isolated layers to ensure high throughput, end-to-end type safety, and straightforward scaling:

- **Frontend & Rendering:** Built with **Next.js 16 (App Router)** using `output: "standalone"`, Partial Prerendering (PPR), `<Suspense>` streaming boundaries, and Zod-validated Server Actions.
- **Authentication & Security:** Powered by **Better-Auth** with Redis `secondaryStorage` for low-latency session validation, strict user-scoped queries to prevent IDOR, and SHA-256 hashing for API keys.
- **Analytics Module (`modules/finops/`):** Repository layer executing SQL aggregations via Drizzle (`sum`, `count`, grouping by date and environment) backed by Redis caching (`TTL 60s`).
- **High-Throughput Ingestion & Queues (`app/api/v1/ingest` + `worker.ts`):** REST ingestion gateway with Redis key metadata caching, atomic Hard Limit enforcement (`429 Too Many Requests`), and asynchronous job processing via **BullMQ** in a dedicated `worker` container.
- **Data Layer (`shared/db/`):** **PostgreSQL 17** with modular **Drizzle ORM** schemas, storing all monetary values as integer `microUsd` (`$1.00 = 1_000_000`) to eliminate floating-point precision issues.

### Project Structure

```text
├── app/
│   ├── api/
│   │   ├── auth/[...all]/     # Better-Auth endpoints
│   │   └── v1/ingest/         # Token usage telemetry ingestion gateway
│   ├── dashboard/             # Protected dashboard (KPIs, 7/30/90d charts, quota table)
│   └── login/                 # Sign-in and registration page
├── components/                # UI components (Shadcn UI, Recharts, TanStack Table)
├── modules/finops/            # Analytics repository, Server Actions, and BullMQ queues
├── shared/
│   ├── auth/                  # Server and client Better-Auth configuration
│   ├── db/                    # Postgres connection, modular Drizzle schemas, and seeder
│   └── redis/                 # ioredis client singleton
├── worker.ts                  # Background BullMQ queue worker
├── Dockerfile                 # Multi-stage build for web and worker services
├── docker-compose.prod.yml    # 6-service orchestration (postgres, redis, migrator, web, worker, caddy)
└── deploy.sh                  # One-command deployment script
```

---

## Local Development

### 1. Infrastructure & Dependencies

Install dependencies and start local **PostgreSQL 17** and **Redis 7** containers:

```bash
npm install
docker compose -f docker-compose.dev.yml up -d
```

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://dev:devpassword@localhost:5432/app_db
REDIS_URL=redis://localhost:6379
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=your_random_32_chars_secret_key
```

### 2. Database Setup

Push the Drizzle schema to PostgreSQL and (after registering your first user via the UI) seed 90 days of sample telemetry:

```bash
npm run db:push
npm run db:seed
```

### 3. Start Server & Worker

Run the Next.js development server and the background queue worker in two separate terminals:

```bash
# Terminal 1: Next.js Dev Server
npm run dev

# Terminal 2: BullMQ Background Worker
npm run worker:dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Production Deployment (Podman / Docker)

The entire stack is packaged into a multi-stage container image and configured for one-command deployment (including automatic secret generation, Drizzle schema migrations, and SELinux volume labeling for Fedora/RHEL).

### Clone & Deploy

```bash
git clone git@github.com:v-ain/ai-app.git
cd ai-app
chmod +x deploy.sh
./deploy.sh
```

The script generates `.env.prod`, builds the images, and starts 6 services: `postgres`, `redis`, `migrator`, `web`, `worker`, and the `caddy` reverse proxy. Once running, the application is accessible at **`http://localhost:8080`**.

---

## Ingestion API Usage

Create a new pipeline in the dashboard (**Add Pipeline**), copy the generated `sk-fin-...` secret key, and send token usage events:

```bash
curl -X POST http://localhost:8080/api/v1/ingest \
  -H "Authorization: Bearer sk-fin-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "inputTokens": 15000,
    "outputTokens": 4200
  }'
```

- **`202 Accepted`** — Payload validated, cost calculated in micro-USD, and job queued in Redis (BullMQ).
- **`429 Too Many Requests`** — Pipeline has reached or exceeded its configured **Hard Limit**.

<div align="center">

# Service A ↔ Service B — Observability Playground

Two NestJS microservices wired together with MongoDB, Redis Stack, and a shared telemetry layer to showcase resilient data ingestion, search, and reporting.

</div>

## ✨ What You Get

- **Service A** ingests product data (via API fetch or file upload), persists to MongoDB with rich indexing, and exposes search APIs.
- **Service B** listens to every API interaction through Redis TimeSeries pub/sub, stores structured logs, and exports PDF analytics with embedded charts.
- **Shared Library** centralises configuration, database connections, Redis TimeSeries clients, decorators, and schemas for both services.
- **Docker Compose** brings up MongoDB, Redis Stack (with RedisInsight UI), and both services with a single command.

> Bonus challenges noted in the brief (e.g. Go/gRPC report service) are intentionally skipped.

## 🏗️ System Topology

```text
┌───────────┐      TrackApi decorator      ┌──────────┐
│ Service A │ ───────────────────────────▶ │ Redis TS │
│ (ingest)  │                              │  Pub/Sub │
└───────────┘                              └────┬─────┘
	│ Mongo writes & search queries             │ events
	▼                                           ▼
┌──────────┐                              ┌───────────┐
│ MongoDB  │◀─ Share schemas & indexes ─▶ │ Service B │
└──────────┘                              │ (logs)    │
                                          │ PDF/Charts│
                                          └───────────┘
```

### Key Components

| Layer                         | Highlights                                                                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `libs/shared`                 | Global `SharedModule` bootstrapping config, Mongo connections, Redis TimeSeries clients/interceptors, and Mongoose schemas.                                                                                  |
| Service A (`apps/service-a`)  | `DataImportModule` handles remote fetch ➜ JSON/XLSX file generation ➜ bulk import. `ProductsModule` delivers indexed search with pagination. All controllers decorated with `@TrackApi()` to emit telemetry. |
| Service B (`apps/service-b`)  | `LogsService` subscribes to Redis pub/sub, stores enriched logs in Mongo, and powers reporting endpoints. `ReportsService` aggregates Redis + Mongo data into chart-rich PDFs.                               |
| Docker (`docker-compose.yml`) | MongoDB, Redis Stack (incl. RedisInsight), Service A & B with shared volumes for `/data` and `/reports`.                                                                                                     |

## 🚀 Getting Started

### 1. Prerequisites

- Node.js ≥ 20
- npm ≥ 10
- Docker & Docker Compose

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Files

Generate the default `.env.*` files (development, production, test) using the provided helper:

```bash
./setup.sh
```

`SharedModule` reads `NODE_ENV` to load `.env.${NODE_ENV}`. For local dev, set `NODE_ENV=development`.

### 4. Run the Stack with Docker

```bash
docker-compose up --build
```

Services will be available by default at:

- Service A API: http://localhost:3000
- Service B API: http://localhost:3001
- RedisInsight UI: http://localhost:5540

### 5. Local Development (optional)

```bash
npm run start:dev:service-a
npm run start:dev:service-b
# or both together
npm run start:dev:all
```

> Ensure MongoDB & Redis are reachable (via Docker or local installs). The shared module expects them at the hosts defined in `.env.development`.

### 6. Tests

```bash
# For unit tests
npm run test
# For E2E tests
npm run test:e2e:all
```

Unit tests cover controllers/services across both apps and the Redis TimeSeries utility layer. Jest configuration lives in `package.json`.

## 📚 Swagger API Docs

Each service exposes Swagger UI once running:

- Service A: http://localhost:3000/api
- Service B: http://localhost:3001/api

The docs describe routes for data import, product search, log querying, and report generation with request/response schemas.

## 🧩 Feature Highlights

### Service A

- **Programmatic data fetch** from DummyJSON (`DataImportService.fetchAndSaveData`) with JSON/XLSX outputs stored under `/data` (shared volume).
- **Robust upload pipeline** accepting JSON/XLS/XLSX/CSV, using streaming parsers, upserts, and summarised import stats.
- **Optimised search endpoints** with compound/text indexes (`ProductSchema`) and paginated responses.
- **Telemetry decorator** ensures every controller action publishes an API event to Redis TimeSeries.

### Service B

- **Real-time log ingestion** via `RedisTimeSeriesService.subscribe('all')`, normalising events and persisting in Mongo with query-friendly indexes.
- **Flexible querying APIs** (`LogsController`) with rich filters (service, type, duration/status ranges, date windows) and pagination metadata.
- **Analytics reports** combining Redis metrics and Mongo aggregates into PDF exports with charts (Chart.js via `chartjs-node-canvas`) and detailed summaries.

### Shared Library

- Environment-driven configuration with Nest ConfigModule.
- Mongo connection factory + reusable schemas for products/logs.
- Redis TimeSeries service encapsulating TS.CREATE/ADD/RANGE commands, pub/sub wiring, and `@TrackApi` interceptor.

## 📂 Data & Reports

- `data/` — fetched files and upload staging area (mounted into Service A container).
- `reports/` — generated PDFs from Service B (mounted into Service B container).
- Both folders are git-ignored but mounted via Docker for persistence during local testing.

## 🧪 Manual QA Checklist

1. `POST /data-import/fetch-and-save?format=json&limit=50`
2. `POST /data-import/upload-and-import` with sample JSON/XLSX/CSV file
3. `GET /products/search?search=laptop&page=1&limit=20`
4. Monitor RedisInsight (`api:events:*` channels) to confirm real-time events
5. `GET /logs` endpoints to filter by service/type/time window
6. `GET /reports/pdf` to download a charted PDF export

## 🛠️ Handy Scripts

| Command                      | Description                                       |
| ---------------------------- | ------------------------------------------------- |
| `npm run docker:up`          | Start MongoDB + Redis Stack (used by `npm test`). |
| `npm run docker:down`        | Tear down containers.                             |
| `npm run start:dev:all`      | Run both services with hot reload.                |
| `npm run test:e2e:service-a` | Execute Service A E2E suite (Jest).               |
| `npm run test:e2e:service-b` | Execute Service B E2E suite (Jest).               |

## Video Of Usage

https://github.com/user-attachments/assets/feb5f38e-3713-4c1a-9a7a-cf6cba2474a6

---

Crafted with NestJS, Redis Stack, MongoDB, and a pinch of PDF artistry. Enjoy exploring! ✨

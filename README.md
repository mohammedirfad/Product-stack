# Secure Product Catalog Assignment

Full-stack product catalog assignment implemented with two separate servers:

- **Backend API:** Express.js on `http://localhost:4000`
- **Frontend UI:** React + Vite on `http://localhost:3001`
- **Cache/rate limiting:** Redis when available, automatic in-memory fallback when Redis is not running
- **API docs:** Swagger UI on `http://localhost:4000/api-docs`

The app follows the assignment requirements: authenticated product CRUD, paginated product listing, debounced search/filtering, loading/success/error states, OpenAPI/Swagger docs, Postman collection, tests, Docker, Redis caching/rate limiting, modal forms, inline validation, and secure API practices.

## Project Structure

```text
backend/              Express API, auth, rate limit, Redis cache, Swagger
frontend/             React UI with product cards/table and toast errors
docs/                 Design doc, OpenAPI/Postman artifacts
tests/                Backend integration and frontend utility tests
data/                 Local runtime JSON data
docker-compose.yml    API + React web + Redis
```

## Install

```powershell
cd C:\Users\Quantum\Desktop\MObs-2
npm install
```

## Run Locally

Open two terminals.

Terminal 1, backend API:

```powershell
cd C:\Users\Quantum\Desktop\MObs-2
$env:API_PORT="4000"
$env:FRONTEND_URL="http://localhost:3001"
$env:JWT_SECRET="replace-with-at-least-32-random-characters"
npm run start:api
```

Terminal 2, React frontend:

```powershell
cd C:\Users\Quantum\Desktop\MObs-2
$env:VITE_API_URL="http://localhost:4000"
npm run start:web
```

Open:

```text
http://localhost:3001
```

Default login:

```text
Email: admin@example.com
Password: ChangeMe123!
```

## What To Do In The UI

1. Open `http://localhost:3001`.
2. Login with the admin credentials above.
3. After login, products appear only inside the protected dashboard.
4. Products show as glassmorphism cards with local product artwork.
5. Use search, category, stock, and sort controls to test debounced server-side filtering.
6. Only three categories are available: `Electronics`, `Home`, and `Fashion`.
7. Use the grid/table toggle to switch between card listing and admin table listing.
8. Click `Add` to open the create-product modal.
9. Click `Edit` to open the edit-product modal.
10. Click `Delete` to open a confirmation modal; product is deleted only after confirmation.
11. Form validation appears below each field. Browser default `required` popups are not used.
12. Backend/API errors show as toast notifications in the top-right corner.

## API, Swagger, OpenAPI, Postman

Backend API:

```text
http://localhost:4000
```

Swagger UI:

```text
http://localhost:4000/api-docs
```

OpenAPI JSON:

```text
http://localhost:4000/openapi.json
```

Postman collection:

```text
docs/postman_collection.json
```

Import the Postman collection, run `Login`, and it will save the JWT token for the product requests.

## Main API Endpoints

```text
POST   /api/auth/login
GET    /api/products
GET    /api/products/:id
POST   /api/products
PUT    /api/products/:id
DELETE /api/products/:id
GET    /health
GET    /api-docs
GET    /openapi.json
```

All `/api/products` routes require:

```text
Authorization: Bearer <jwt-token>
```

## Redis Caching

Set Redis URL:

```powershell
$env:REDIS_URL="redis://localhost:6379"
```

If Redis is not running, the API logs a warning and uses an in-memory cache so local review still works.

Redis is used for both product caching and rate-limit counters when available.

Cached:

- Product list responses
- Product detail responses

Invalidated on:

- Product create
- Product update
- Product delete

## Security And Scaling

- JWT auth protects all product reads and writes.
- Passwords use bcrypt hashing.
- Express JSON body size is capped.
- Helmet security headers are enabled.
- CORS is restricted to `FRONTEND_URL`.
- Rate limiting protects auth and product APIs.
- Redis-backed cache improves list/detail response time.
- Repository layer can be replaced with Postgres/MongoDB without changing route contracts.
- UI uses React state rendering, not unsafe HTML injection.
- Errors are normalized and shown through toast notifications.

## Tests

```powershell
npm test
```

Current coverage includes:

- Login success/failure behavior
- Product auth protection
- Product create/update/delete/search validation
- Swagger/OpenAPI route availability
- Frontend product query/form/currency utilities
- Frontend inline validation through Jest

Jest frontend tests:

```powershell
npm.cmd run test:jest
```

Playwright e2e test setup:

```powershell
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Note: Playwright browser download may take time because it downloads Chromium. The e2e spec is included at `tests/e2e/product-dashboard.spec.js`.

## Docker Bonus

Run API, React frontend, and Redis together:

```powershell
docker compose up --build
```

Then open:

```text
Frontend: http://localhost:3001
Swagger:  http://localhost:4000/api-docs
API:      http://localhost:4000
Redis:    localhost:6379
```

## Environment Variables

| Name | Default | Purpose |
| --- | --- | --- |
| `API_PORT` | `4000` | Backend API port |
| `FRONTEND_URL` | `http://localhost:3001` | Allowed CORS origin |
| `VITE_API_URL` | `http://localhost:4000` | React frontend API base URL |
| `JWT_SECRET` | development fallback | JWT signing secret |
| `JWT_EXPIRES_IN` | `1h` | Token lifetime |
| `ADMIN_EMAIL` | `admin@example.com` | Seed admin email |
| `ADMIN_PASSWORD` | `ChangeMe123!` | Seed admin password |
| `REDIS_URL` | empty | Redis connection URL |
| `DATA_DIR` | `./data` | Local JSON data directory |

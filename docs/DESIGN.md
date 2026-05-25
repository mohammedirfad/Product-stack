# Product Catalog Design Document

## Architecture

The project is split into two servers:

- **React frontend** on `http://localhost:3001`
- **Express API** on `http://localhost:4000`

The frontend authenticates through the API, stores the JWT in `sessionStorage`, and sends `Authorization: Bearer <token>` for catalog modifications. Product data is stored using a repository pattern with JSON file storage, and cached using Redis when available.

The React UI features:
- A modern glassmorphism dashboard theme (Outfit/Inter typography).
- Responsive grid layouts with card/table toggles.
- Modal create/edit flows.
- Inline form validation.
- Upload dropzones with image previews.
- Dynamic toast notifications.

---

## API Structure

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/login` | No | Login and receive a JWT |
| `GET` | `/api/products` | **No (Public)** | Paginated product list with search/filter/sort (Default: 10 items) |
| `GET` | `/api/products/:id` | **No (Public)** | Fetch detailed properties of a single product |
| `POST` | `/api/products/upload` | **Yes (Admin)** | Upload product image and receive the static URL path |
| `POST` | `/api/products` | **Yes (Admin)** | Add a new product to the catalog |
| `PUT` | `/api/products/:id` | **Yes (Admin)** | Edit an existing product |
| `DELETE` | `/api/products/:id` | **Yes (Admin)** | Delete a product from the catalog |
| `GET` | `/health` | No | API health, cache status, and uptime |
| `GET` | `/api-docs` | No | Interactive Swagger UI API documentation |
| `GET` | `/openapi.json` | No | Raw OpenAPI 3.1.0 document |

---

## Authentication & Authorization

- **JWT Authentication**: The API uses JWT Bearer tokens. Passwords are hashed using `bcryptjs`. JWTs include user details and standard claims (issuer, subject, expiration).
- **Public vs Admin Routes**:
  - `GET` routes (`/api/products` and `/api/products/:id`) are public to allow front-facing consumer applications to display the catalog.
  - Modifying operations (`POST`, `PUT`, `DELETE`, and `/upload`) require a valid administrator JWT token passed in the `Authorization` header.

---

## Request And Response Examples

### 1. Login (POST)
- **Endpoint**: `/api/auth/login`
- **Description**: Authenticate admin credentials.
- **Request**:
  ```bash
  curl -X POST http://localhost:4000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@example.com","password":"ChangeMe123!"}'
  ```
- **Response**:
  ```json
  {
    "tokenType": "Bearer",
    "token": "eyJhbGciOi...",
    "user": {
      "id": "1",
      "email": "admin@example.com",
      "name": "Administrator"
    }
  }
  ```

### 2. List Products (GET - Public)
- **Endpoint**: `/api/products`
- **Description**: Fetch products with optional filtering/pagination.
- **Request**:
  ```bash
  curl "http://localhost:4000/api/products?search=watch&page=1&pageSize=10&sortBy=price&sortOrder=asc"
  ```
- **Response**:
  ```json
  {
    "items": [
      {
        "id": "2",
        "name": "PulseTrack AMOLED Watch",
        "sku": "ELEC-PULSETRACK-42",
        "category": "Electronics",
        "price": 179,
        "stock": 22,
        "imageUrl": "/products/wearable-kit.svg",
        "description": "AMOLED fitness smartwatch with SpO2 tracking.",
        "active": true,
        "createdAt": "2026-05-24T00:00:00Z",
        "updatedAt": "2026-05-24T00:00:00Z"
      }
    ],
    "page": 1,
    "pageSize": 10,
    "total": 1,
    "totalPages": 1,
    "facets": {
      "categories": ["Electronics", "Home", "Fashion"],
      "visibleStock": 22,
      "visibleValue": 3938
    }
  }
  ```

### 3. Image Upload (POST - Admin Only)
- **Endpoint**: `/api/products/upload`
- **Description**: Upload a local image file.
- **Request**:
  ```bash
  curl -X POST http://localhost:4000/api/products/upload \
    -H "Authorization: Bearer <token>" \
    -F "image=@/path/to/product.png"
  ```
- **Response**:
  ```json
  {
    "imageUrl": "/uploads/958c73d6-98aa-434b-b38f-2d27f43d6d87.png"
  }
  ```

### 4. Create Product (POST - Admin Only)
- **Endpoint**: `/api/products`
- **Request**:
  ```bash
  curl -X POST http://localhost:4000/api/products \
    -H "Authorization: Bearer <token>" \
    -H "Content-Type: application/json" \
    -d '{"name":"Desk Lamp","sku":"HOME-LAMP-100","category":"Home","price":39.99,"stock":50,"description":"LED desk lamp.","imageUrl":"/uploads/958c73d6-98aa-434b-b38f-2d27f43d6d87.png"}'
  ```

---

## Validation Rules

- `name`: Required, 2-120 characters.
- `sku`: Required, unique, 2-64 characters. Must match `/^[A-Z0-9][A-Z0-9-_.]*$/i` pattern.
- `category`: Required, normalized to one of `Electronics`, `Home`, or `Fashion`.
- `imageUrl`: Optional relative local assets or uploaded paths (e.g. `/uploads/file.png`).
- `image upload`: File size must not exceed 5MB. Permitted extensions: `.jpg`, `.jpeg`, `.png`, `.webp`, `.svg`, `.gif`.
- `description`: Optional, maximum 500 characters.
- `price`: Numeric, range: `0` to `1,000,000`.
- `stock`: Integer, range: `0` to `10,000,000`.
- `pageSize`: Default 10, capped at 50 records.

---

## Performance & Cache Controls

- **Search Indexing**: Normalizes and tokenizes text internally to build text-search indexes in the JSON repository.
- **Caching Mechanism**: Product list and details are cached (defaults: 30s list, 60s details).
- **Redis Cache Layer**: Utilizes Redis when `REDIS_URL` is set; falls back to an in-memory storage client locally.
- **Cache Invalidation**: Any write action (`POST`, `PUT`, `DELETE`) invalidates product caches immediately to keep views up-to-date.
- **Helmet Policies**: Sets `Cross-Origin-Resource-Policy: cross-origin` so static image assets can be requested by frontend apps.

---

## Step-by-Step Hosting Guide

This guide describes how to deploy the API (Backend) and static files (Frontend) to production.

### Option A: Hosting via Docker Compose (Single Server/VPS)
Best for hosting the full stack together on virtual private servers (AWS EC2, DigitalOcean, Linode).

1. **Prerequisites**: Ensure Docker and Docker Compose are installed on the target machine.
2. **Setup Environment**: Create a production `.env` file in the root directory:
   ```env
   API_PORT=4000
   NODE_ENV=production
   FRONTEND_URL=https://yourdomain.com
   JWT_SECRET=super-secret-random-key-at-least-32-chars
   ADMIN_EMAIL=admin@yourdomain.com
   ADMIN_PASSWORD=SecurePassword99!
   DATA_DIR=./data
   REDIS_URL=redis://redis:6379
   ```
3. **Run Services**: Start the containers in detached daemon mode:
   ```bash
   docker compose up -d --build
   ```
   Docker Compose builds the images and sets up persistent named volumes for the uploads directory and Redis data.

---

### Option B: Cloud Hosting (Render, Heroku, or Fly.io)
Best for separate managed environments.

#### 1. Backend API (Render)
1. Sign in to [Render](https://render.com) and create a **Web Service**.
2. Connect this repository and set the following parameters:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm run start:api`
3. Configure Environment Variables in Render:
   - `NODE_ENV`: `production`
   - `API_PORT`: `10000` (or let Render assign a port automatically)
   - `FRONTEND_URL`: URL of your frontend (e.g. `https://your-app.vercel.app`)
   - `JWT_SECRET`: Generate a secure 32+ character random string.
   - `ADMIN_EMAIL` and `ADMIN_PASSWORD`: Your admin credentials.
   - `DATA_DIR`: `./data` (For image persistence, mount a **Render Disk** to `/app/data`).
4. (Optional) Create a **Render Redis** instance and paste the connection string as `REDIS_URL` in the API env settings.

#### 2. Frontend client (Vercel / Netlify / Render Static)
The frontend is a static single-page app (SPA). It can be hosted on Vercel, Netlify, or Github Pages for free.

1. Create a **Static Project** on Vercel or Netlify.
2. Connect your repository.
3. Configure settings:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build:web` (or `vite build --config vite.config.js`)
   - **Output Directory**: `dist`
4. Set Environment Variables:
   - `VITE_API_URL`: The URL of your deployed Backend API (e.g. `https://your-api.onrender.com`).
5. Deploy. The service builds the static files, packages the endpoint URL, and serves them globally via CDN.

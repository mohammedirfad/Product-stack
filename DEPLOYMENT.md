# Deployment Guide: Render & Vercel

This guide covers deploying the full-stack app to Render (backend + frontend) and optionally Vercel (frontend).

## Environment Variables Required

### Backend (Render Web Service)
Set these in Render dashboard → Environment:

```
PORT=10000
API_PORT=10000
JWT_SECRET=<your-strong-secret-at-least-32-characters>
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=ChangeMe123!
FRONTEND_URL=https://<your-frontend>.onrender.com
NODE_ENV=production
REDIS_URL= (leave blank or set to Redis provider URL)
```

### Frontend (Render Static Site)
Set in Render dashboard → Environment:

```
VITE_API_URL=https://<your-backend>.onrender.com
```

### Frontend (Vercel)
Set in Vercel dashboard → Settings → Environment Variables:

```
VITE_API_URL=https://<your-backend>.onrender.com
```

---

## Step 1: Push to GitHub ✅

```powershell
cd C:\Users\Quantum\Desktop\MObs-2
git add .
git commit -m "Deployment ready: fix start command and add deployment configs"
git push origin main
```

---

## Step 2: Deploy Backend on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New** → **Web Service**
3. Connect your GitHub repo
4. Fill in:
   - **Name**: `mobs-backend` (or any name)
   - **Root Directory**: `/` (repo root)
   - **Environment**: Node
   - **Region**: Choose closest to you
   - **Branch**: main
   - **Build Command**: `npm install`
   - **Start Command**: `npm run start:api`
   - **Health Check Path**: `/health` (optional, improves uptime)
5. Scroll down to **Environment** section
6. Add these environment variables (click **Add Environment Variable**):
   - `PORT` = `10000`
   - `API_PORT` = `10000`
   - `JWT_SECRET` = generate a 32+ character random string (use [this generator](https://www.random.org/strings/?num=1&len=32&digits=on&upperalpha=on&loweralpha=on&unique=on&format=html&rnd=new))
   - `ADMIN_EMAIL` = `admin@example.com`
   - `ADMIN_PASSWORD` = `ChangeMe123!`
   - `FRONTEND_URL` = leave as `http://localhost:3001` for now (update after frontend is deployed)
   - `NODE_ENV` = `production`
   - `REDIS_URL` = leave blank (optional Redis step below)
7. Click **Create Web Service**
8. Wait for build (2-3 min). Confirm in logs no `.env: not found` error.
9. Copy your backend URL from dashboard (e.g., `https://mobs-backend.onrender.com`)

### Verify Backend Works
- Open `https://mobs-backend.onrender.com/health` → should return `OK` or `{"status":"ok"}`
- Open `https://mobs-backend.onrender.com/api-docs` → should show Swagger docs

---

## Step 3: Deploy Frontend on Render (Static Site)

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New** → **Static Site**
3. Connect the same GitHub repo
4. Fill in:
   - **Name**: `mobs-frontend` (or any name)
   - **Root Directory**: `/` (repo root)
   - **Branch**: main
   - **Build Command**: `npm install && npm run build:web`
   - **Publish Directory**: `frontend/dist`
5. Scroll to **Environment** and add:
   - `VITE_API_URL` = `https://mobs-backend.onrender.com` (use your backend URL from step 2)
6. Click **Create Static Site**
7. Wait for build (2-3 min)
8. Copy your frontend URL (e.g., `https://mobs-frontend.onrender.com`)

### Update Backend CORS
- Go back to backend Web Service
- Edit **Environment**
- Change `FRONTEND_URL` to your frontend URL (e.g., `https://mobs-frontend.onrender.com`)
- **Save** (redeploys backend automatically)

### Verify Frontend Works
- Open `https://mobs-frontend.onrender.com`
- Login with `admin@example.com` / `ChangeMe123!`
- Confirm products load and can add/edit/delete

---

## Step 4: Deploy Frontend on Vercel (Optional Alternative)

Use Vercel **only if** you want an extra frontend deployment or preview environment. Backend stays on Render.

### Option A: Point Vercel to `frontend/` folder
1. Go to [Vercel](https://vercel.com)
2. Click **Add New** → **Project**
3. Import your GitHub repo
4. Fill in:
   - **Project Name**: `mobs-frontend` (or any name)
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Under **Environment Variables**, add:
   - `VITE_API_URL` = `https://mobs-backend.onrender.com`
6. Click **Deploy**
7. After deploy (1-2 min), Vercel gives you a URL (e.g., `https://mobs-frontend-xi.vercel.app`)

**Note**: Vercel's build runs at root, so you may need a workaround. If this fails, use **Option B**.

### Option B: Keep Frontend on Render, Skip Vercel
- If Vercel setup is complex, hosting both on Render works fine.
- Frontend on Render = simpler monorepo setup.

---

## Step 5: Optional - Add Redis Caching on Render

Redis improves performance by caching product lists.

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New** → **Redis**
3. Fill in:
   - **Name**: `mobs-redis` (or any name)
   - **Region**: same as backend
4. Click **Create Redis**
5. Copy the **Internal Database URL** (looks like `redis://...`)
6. Go to backend Web Service → Edit **Environment**
7. Update `REDIS_URL` = `redis://...` (paste the URL from step 5)
8. **Save** (redeploys backend)

Backend will now use Redis cache. Logs should show `Connected to Redis` if successful.

---

## Step 6: Troubleshooting

| Issue | Solution |
|-------|----------|
| `.env: not found` on Render | ✅ Fixed! Use `npm run start:api` (no `--env-file`). Set vars in Render dashboard. |
| CORS error in browser console | Verify backend `FRONTEND_URL` env var matches deployed frontend URL exactly |
| `JWT_SECRET must be at least 32 characters` | Generate a 32+ char secret and set in Render env |
| Products don't load | Open browser DevTools → Network. Check API request URL and response status. |
| Static site rebuild not triggered | Manually trigger in Render dashboard → Static Site → Manual Deploy |
| Login fails | Confirm `ADMIN_EMAIL` and `ADMIN_PASSWORD` match in backend env vars |

---

## Step 7: Custom Domain (Optional)

1. Go to Render dashboard → Web Service (backend)
2. Click **Settings** → **Custom Domains**
3. Add your domain (e.g., `api.example.com`)
4. Follow DNS instructions
5. Repeat for Static Site frontend (e.g., `example.com`)
6. Update `FRONTEND_URL` in backend to use custom domain

---

## All Done! 🎉

**Backend**: `https://mobs-backend.onrender.com`
**Frontend**: `https://mobs-frontend.onrender.com`  
**Optional Vercel Frontend**: `https://mobs-frontend-*.vercel.app`

---

## Local Development Setup

To work locally before deploying:

```powershell
# 1. Install dependencies
npm install

# 2. Terminal 1 - Backend API
$env:JWT_SECRET = "dev-secret-at-least-32-characters-long"
npm run dev:api

# 3. Terminal 2 - Frontend
$env:VITE_API_URL = "http://localhost:4000"
npm run dev:web

# 4. Open browser
# http://localhost:3001
# Login: admin@example.com / ChangeMe123!
```

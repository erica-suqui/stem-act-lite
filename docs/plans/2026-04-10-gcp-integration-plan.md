# GCP Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy the STEM-ACT Next.js frontend and FastAPI backend to GCP using Cloud Run, Cloud SQL, and Cloud Storage, with CI/CD via Cloud Build.

**Architecture:** Subdomain split — Next.js at `app.stemact.org` (Cloud Run), FastAPI at `api.stemact.org` (Cloud Run), PostgreSQL migrated to Cloud SQL, flyer uploads on Cloud Storage. WordPress plugin updated to link to the new subdomain. No iframe, no PHP API calls.

**Tech Stack:** Next.js 14 (App Router), FastAPI, SQLAlchemy, PostgreSQL, Docker, Cloud Run, Cloud SQL, Cloud Storage, Cloud Build, Artifact Registry, Secret Manager.

---

## Prerequisites (client handles)

Before starting, confirm the client has:
- [ ] Created a GCP project and noted the **Project ID**
- [ ] Enabled billing
- [ ] Created a Cloud SQL PostgreSQL instance and noted the **connection name** (format: `project:region:instance`)
- [ ] Created an Artifact Registry Docker repository (e.g., `stemact-images`)
- [ ] Granted the team **Editor** or appropriate IAM roles

You will need `gcloud` CLI installed and authenticated: `gcloud auth login && gcloud config set project YOUR_PROJECT_ID`

---

## Task 1: Dockerize the FastAPI Backend

**Files:**
- Create: `stemApp/backend/Dockerfile`
- Create: `stemApp/backend/.dockerignore`

**Step 1: Create the Dockerfile**

```dockerfile
# stemApp/backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

**Step 2: Create .dockerignore**

```
__pycache__
*.pyc
.env
.env.*
*.egg-info
.venv
venv
```

**Step 3: Build and verify locally**

```bash
cd stemApp/backend
docker build -t stemact-backend:local .
docker run --rm -p 8080:8080 \
  -e DATABASE_URL="postgresql://stemact_user:stemact_pass@host.docker.internal:5433/stemact" \
  -e CORS_ALLOW_ORIGINS="http://localhost:3000" \
  stemact-backend:local
```

Expected: FastAPI starts at `http://localhost:8080`. Visit `http://localhost:8080/docs` — Swagger UI should load.

**Step 4: Commit**

```bash
git add stemApp/backend/Dockerfile stemApp/backend/.dockerignore
git commit -m "feat: add Dockerfile for FastAPI backend"
```

---

## Task 2: Dockerize the Next.js Frontend

**Files:**
- Create: `stemApp/Dockerfile.nextjs`
- Create: `stemApp/.dockerignore`

**Step 1: Create the Dockerfile**

```dockerfile
# stemApp/Dockerfile.nextjs
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
```

**Step 2: Enable standalone output in Next.js config**

Edit `stemApp/next.config.js`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
};

module.exports = nextConfig;
```

**Step 3: Create .dockerignore**

```
node_modules
.next
.env
.env.*
```

**Step 4: Build and verify locally**

```bash
cd stemApp
docker build -f Dockerfile.nextjs -t stemact-frontend:local .
docker run --rm -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL="http://localhost:8080" \
  stemact-frontend:local
```

Expected: Next.js app loads at `http://localhost:3000`.

**Step 5: Commit**

```bash
git add stemApp/Dockerfile.nextjs stemApp/.dockerignore stemApp/next.config.js
git commit -m "feat: add Dockerfile for Next.js frontend with standalone output"
```

---

## Task 3: Push Images to Artifact Registry

**Prerequisite:** Client has created an Artifact Registry repository. Get the registry hostname — format: `REGION-docker.pkg.dev/PROJECT_ID/REPO_NAME`

**Step 1: Authenticate Docker to Artifact Registry**

```bash
gcloud auth configure-docker REGION-docker.pkg.dev
```

Expected: `Docker configuration file updated.`

**Step 2: Tag and push backend image**

```bash
cd stemApp/backend
docker build -t REGION-docker.pkg.dev/PROJECT_ID/stemact-images/backend:latest .
docker push REGION-docker.pkg.dev/PROJECT_ID/stemact-images/backend:latest
```

**Step 3: Tag and push frontend image**

```bash
cd stemApp
docker build -f Dockerfile.nextjs -t REGION-docker.pkg.dev/PROJECT_ID/stemact-images/frontend:latest .
docker push REGION-docker.pkg.dev/PROJECT_ID/stemact-images/frontend:latest
```

Expected: Both images visible in GCP Console → Artifact Registry.

---

## Task 4: Store Secrets in Secret Manager

**Files:** No code changes — GCP Console / gcloud commands only.

**Step 1: Enable Secret Manager API**

```bash
gcloud services enable secretmanager.googleapis.com
```

**Step 2: Create secrets**

```bash
# Database URL (Cloud SQL format — see Task 5 for the full connection string)
echo -n "postgresql+psycopg2://stemact_user:STRONG_PASSWORD@/stemact?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME" \
  | gcloud secrets create DATABASE_URL --data-file=-

# CORS origins
echo -n "https://app.stemact.org,https://stemact.org" \
  | gcloud secrets create CORS_ALLOW_ORIGINS --data-file=-

# GCS bucket name
echo -n "stemact-uploads" \
  | gcloud secrets create GCS_BUCKET_NAME --data-file=-

# App base URL
echo -n "https://app.stemact.org/" \
  | gcloud secrets create APP_BASE_URL --data-file=-
```

**Step 3: Verify**

```bash
gcloud secrets list
```

Expected: All 4 secrets listed.

---

## Task 5: Migrate Database to Cloud SQL

**Files:** No code changes needed — SQLAlchemy already uses `DATABASE_URL` env var.

**Step 1: Get Cloud SQL connection name**

```bash
gcloud sql instances describe INSTANCE_NAME --format="value(connectionName)"
```

Note the output — format: `PROJECT_ID:REGION:INSTANCE_NAME`.

**Step 2: Create the database and user on Cloud SQL**

In GCP Console → Cloud SQL → your instance → Databases: create `stemact` database.
In GCP Console → Cloud SQL → your instance → Users: create `stemact_user` with a strong password.

**Step 3: Install Cloud SQL Auth Proxy locally and connect**

```bash
# Download Cloud SQL Auth Proxy
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.15.2/cloud-sql-proxy.linux.amd64
chmod +x cloud-sql-proxy

# Run proxy
./cloud-sql-proxy PROJECT_ID:REGION:INSTANCE_NAME --port=5434
```

**Step 4: Run existing migrations against Cloud SQL**

In a new terminal:

```bash
cd stemApp/db
DATABASE_URL="postgresql://stemact_user:STRONG_PASSWORD@127.0.0.1:5434/stemact" \
  psql -f schema.sql
```

Then run any migration scripts in `stemApp/db/migrations/` in order.

**Step 5: Verify**

```bash
psql "postgresql://stemact_user:STRONG_PASSWORD@127.0.0.1:5434/stemact" -c "\dt"
```

Expected: Tables listed (users, events, organizations, etc.)

---

## Task 6: Deploy FastAPI Backend to Cloud Run

**Step 1: Enable required APIs**

```bash
gcloud services enable run.googleapis.com sqladmin.googleapis.com
```

**Step 2: Grant Cloud Run service account access to secrets and Cloud SQL**

```bash
# Get the default compute service account
SA="$(gcloud projects describe PROJECT_ID --format='value(projectNumber)')-compute@developer.gserviceaccount.com"

# Grant Secret Manager access
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:$SA" \
  --role="roles/secretmanager.secretAccessor"

# Grant Cloud SQL access
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:$SA" \
  --role="roles/cloudsql.client"
```

**Step 3: Deploy backend to Cloud Run**

```bash
gcloud run deploy stemact-backend \
  --image=REGION-docker.pkg.dev/PROJECT_ID/stemact-images/backend:latest \
  --platform=managed \
  --region=REGION \
  --allow-unauthenticated \
  --add-cloudsql-instances=PROJECT_ID:REGION:INSTANCE_NAME \
  --set-secrets=DATABASE_URL=DATABASE_URL:latest,CORS_ALLOW_ORIGINS=CORS_ALLOW_ORIGINS:latest,GCS_BUCKET_NAME=GCS_BUCKET_NAME:latest,APP_BASE_URL=APP_BASE_URL:latest
```

**Step 4: Verify**

```bash
gcloud run services describe stemact-backend --region=REGION --format="value(status.url)"
```

Visit the URL + `/docs` — Swagger UI should load. Hit the health endpoint if one exists.

---

## Task 7: Deploy Next.js Frontend to Cloud Run

**Step 1: Create a secret for the API URL**

```bash
echo -n "https://api.stemact.org" \
  | gcloud secrets create NEXT_PUBLIC_API_URL --data-file=-
```

**Step 2: Deploy frontend to Cloud Run**

```bash
gcloud run deploy stemact-frontend \
  --image=REGION-docker.pkg.dev/PROJECT_ID/stemact-images/frontend:latest \
  --platform=managed \
  --region=REGION \
  --allow-unauthenticated \
  --set-secrets=NEXT_PUBLIC_API_URL=NEXT_PUBLIC_API_URL:latest
```

**Step 3: Verify**

```bash
gcloud run services describe stemact-frontend --region=REGION --format="value(status.url)"
```

Visit the URL — the STEM-ACT app should load.

---

## Task 8: Configure Custom Domains (Subdomains)

**Prerequisite:** Client controls DNS for `stemact.org`.

**Step 1: Map `api.stemact.org` to backend**

```bash
gcloud run domain-mappings create \
  --service=stemact-backend \
  --domain=api.stemact.org \
  --region=REGION
```

Follow the output instructions — it will give you DNS records to add (CNAME or A record).

**Step 2: Map `app.stemact.org` to frontend**

```bash
gcloud run domain-mappings create \
  --service=stemact-frontend \
  --domain=app.stemact.org \
  --region=REGION
```

**Step 3: Client adds DNS records**

Hand the client the DNS records from steps 1 and 2. Cloud Run handles SSL certificates automatically once DNS propagates (up to 24h).

**Step 4: Verify after DNS propagates**

```bash
curl -I https://api.stemact.org/docs
curl -I https://app.stemact.org
```

Expected: `HTTP/2 200` for both.

---

## Task 9: Update Google OAuth Redirect URIs

**Step 1: Go to Google Cloud Console → APIs & Services → Credentials**

Find the OAuth 2.0 Client ID used by STEM-ACT.

**Step 2: Add new authorized redirect URIs**

Add:
- `https://app.stemact.org/api/auth/callback/google`
- `https://app.stemact.org/login`

Keep the existing `localhost` URIs for local development.

**Step 3: Save and verify**

Log into the app at `https://app.stemact.org` using Google OAuth — full login flow should complete.

---

## Task 10: Set Up Cloud Build CI/CD

**Files:**
- Create: `cloudbuild.yaml` (repo root)

**Step 1: Create Cloud Build config**

```yaml
# cloudbuild.yaml
steps:
  # Build and push backend
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - build
      - -t
      - '${_REGION}-docker.pkg.dev/$PROJECT_ID/stemact-images/backend:$COMMIT_SHA'
      - -t
      - '${_REGION}-docker.pkg.dev/$PROJECT_ID/stemact-images/backend:latest'
      - stemApp/backend
      - -f
      - stemApp/backend/Dockerfile

  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', '--all-tags', '${_REGION}-docker.pkg.dev/$PROJECT_ID/stemact-images/backend']

  # Deploy backend
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - run
      - deploy
      - stemact-backend
      - --image=${_REGION}-docker.pkg.dev/$PROJECT_ID/stemact-images/backend:$COMMIT_SHA
      - --region=${_REGION}
      - --platform=managed

  # Build and push frontend
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - build
      - -t
      - '${_REGION}-docker.pkg.dev/$PROJECT_ID/stemact-images/frontend:$COMMIT_SHA'
      - -t
      - '${_REGION}-docker.pkg.dev/$PROJECT_ID/stemact-images/frontend:latest'
      - stemApp
      - -f
      - stemApp/Dockerfile.nextjs

  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', '--all-tags', '${_REGION}-docker.pkg.dev/$PROJECT_ID/stemact-images/frontend']

  # Deploy frontend
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - run
      - deploy
      - stemact-frontend
      - --image=${_REGION}-docker.pkg.dev/$PROJECT_ID/stemact-images/frontend:$COMMIT_SHA
      - --region=${_REGION}
      - --platform=managed

substitutions:
  _REGION: us-east1

options:
  logging: CLOUD_LOGGING_ONLY
```

**Step 2: Enable Cloud Build API and connect repo**

```bash
gcloud services enable cloudbuild.googleapis.com
```

In GCP Console → Cloud Build → Triggers → Connect Repository → select your GitHub repo.

**Step 3: Create a trigger**

In GCP Console → Cloud Build → Triggers → Create Trigger:
- Event: Push to branch
- Branch: `^main$`
- Config: Cloud Build configuration file (`cloudbuild.yaml`)

**Step 4: Grant Cloud Build permission to deploy Cloud Run**

```bash
CB_SA="$(gcloud projects describe PROJECT_ID --format='value(projectNumber)')@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:$CB_SA" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:$CB_SA" \
  --role="roles/iam.serviceAccountUser"
```

**Step 5: Test the trigger**

Push a trivial commit to `main` (e.g., add a comment). Watch GCP Console → Cloud Build → History for the build.

Expected: Build completes successfully, new revision deployed to both Cloud Run services.

**Step 6: Commit**

```bash
git add cloudbuild.yaml
git commit -m "feat: add Cloud Build CI/CD pipeline"
```

---

## Task 11: Update WordPress Plugin Nav Links

**Context:** The WordPress plugin lives on the client's WordPress site (not in this repo). This task is a config change, not a code change.

**Step 1: Log into WordPress admin**

Navigate to Plugins → STEM-ACT Plugin → Settings (or wherever navigation links are configured).

**Step 2: Update all links pointing to the old app URL**

Replace any `localhost` or staging URLs with:
- App: `https://app.stemact.org`
- API (if referenced in plugin): `https://api.stemact.org`

**Step 3: Verify**

Visit `stemact.org` → click the link to the app → should land on `https://app.stemact.org` and load correctly.

---

## Verification Checklist

After all tasks are complete:

- [ ] `https://api.stemact.org/docs` loads Swagger UI
- [ ] `https://app.stemact.org` loads the STEM-ACT app
- [ ] Google OAuth login works end-to-end
- [ ] Flyer upload works (file lands in Cloud Storage bucket)
- [ ] Event submission and approval workflow works
- [ ] Push to `main` triggers Cloud Build and auto-deploys both services
- [ ] WordPress site links correctly to `app.stemact.org`

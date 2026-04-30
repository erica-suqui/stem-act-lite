# GCP Integration Design — Subdomain Split

**Date:** 2026-04-10
**Status:** Approved

## Overview

Deploy STEM-ACT on GCP using a subdomain split architecture. WordPress remains on its existing host and links to the GCP-hosted app. The Next.js frontend and FastAPI backend run as separate Cloud Run services.

## Architecture

```
stemact.org (WordPress — existing host)
    └── WordPress plugin: nav links → app.stemact.org

app.stemact.org  →  Cloud Run (Next.js)
api.stemact.org  →  Cloud Run (FastAPI)
                        └── Cloud SQL (PostgreSQL)
                        └── Cloud Storage (flyer uploads)

Artifact Registry  ← Docker images built by Cloud Build
Secret Manager     ← DB credentials, API keys
```

## Section 1: Compute & Hosting

- Next.js deployed as a Docker container to Cloud Run at `app.stemact.org`
- FastAPI deployed as a separate Docker container to Cloud Run at `api.stemact.org`
- Cloud Run auto-scales to zero when idle — cost-efficient for low-traffic usage
- Each service is independently deployable

## Section 2: Data & Storage

- **Cloud SQL (PostgreSQL)** — managed instance replacing the current Docker DB. Automated backups. FastAPI connects via Cloud SQL Auth Proxy (no public DB exposure).
- **Cloud Storage** — replaces local file storage for flyer uploads. FastAPI generates signed URLs for secure upload/download. Files never pass through the server.

## Section 3: CI/CD & Secrets

- **Cloud Build** — triggers on push to `main`, builds Docker images, pushes to Artifact Registry, deploys to Cloud Run
- **Artifact Registry** — stores versioned Docker images for Next.js and FastAPI
- **Secret Manager** — stores DB connection string, Cloud Storage credentials, API keys. Cloud Run pulls secrets at runtime — nothing hardcoded or committed to git

## Section 4: WordPress Integration

- WordPress plugin adds nav links/buttons pointing to `app.stemact.org`
- No iframe, no PHP calling the API — clean navigation only
- Client configures DNS: `app.` and `api.` subdomains pointed to Cloud Run service URLs
- Google OAuth redirect URIs updated in Google Cloud Console to include the new domain

## Client Responsibilities

- Provision GCP project and enable billing
- Configure DNS subdomains (`app.stemact.org`, `api.stemact.org`)
- Update Google OAuth authorized redirect URIs

## GCP Services Required

| Service | Purpose |
|---|---|
| Cloud Run | Host Next.js and FastAPI containers |
| Cloud SQL | Managed PostgreSQL |
| Cloud Storage | Flyer file uploads |
| Artifact Registry | Docker image storage |
| Cloud Build | CI/CD pipeline |
| Secret Manager | Runtime secrets |

-- 2026-03-12-geocoordinates.sql
-- Add geocoordinate columns to events table for Leaflet map pins.
-- Both columns are nullable — geocoding failure never blocks event approval.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS lat          DOUBLE PRECISION NULL,
  ADD COLUMN IF NOT EXISTS lng          DOUBLE PRECISION NULL,
  ADD COLUMN IF NOT EXISTS geocoded_at  TIMESTAMPTZ NULL;
